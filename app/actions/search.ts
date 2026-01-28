"use server";

import { detectIntent } from "@/app/lib/ai/genai";
import { webSearch, imageSearch, summarizeItems } from "@/app/lib/ai/search";
import { youtubeSearch, YouTubeVideo } from "@/app/lib/ai/youtube";
import { fetchWeatherForCity, WeatherItem } from "@/app/lib/weather";
import { cookies } from "next/headers";
import { mem0AddTurn, mem0SearchForContext, type Mem0Operation } from "@/app/lib/mem0";
import { GroqClient } from "@/app/lib/ai/groq/groq-client";

function looksLikeRefersToPreviousResults(q: string): boolean {
  const raw = (q || "").trim().toLowerCase();
  if (!raw) return false;
  if (raw.length > 120) return false;
  if (!/\b(this|that|it|them|these|those|above|here|there)\b/.test(raw)) return false;
  return true;
}

function extractLocationsFromQuery(q: string): string[] {
  const trimmed = (q || "").trim();
  if (!trimmed) return [];
  const lowered = trimmed.toLowerCase();
  const parts: string[] = [];
  const inIdx = lowered.indexOf(" in ");
  const forIdx = lowered.indexOf(" for ");
  const atIdx = lowered.indexOf(" at ");
  let tail = "";
  if (inIdx >= 0) tail = trimmed.slice(inIdx + 4);
  else if (forIdx >= 0) tail = trimmed.slice(forIdx + 5);
  else if (atIdx >= 0) tail = trimmed.slice(atIdx + 4);
  if (tail) {
    tail.split(/,| and /i).map((x) => x.trim()).filter(Boolean).forEach((t) => parts.push(t));
  }
  if (!parts.length) {
    if (!/\d/.test(trimmed)) parts.push(trimmed);
  }
  return Array.from(new Set(parts)).slice(0, 4);
}

export type DynamicSearchResult = {
  type: "text" | "search";
  content?: string;
  mem0Ops?: Mem0Operation[];
  data?: {
    searchQuery: string;
    overallSummaryLines: string[];
    webItems: { link: string; title: string; summaryLines: string[]; imageUrl?: string }[];
    mediaItems: { src: string; alt?: string }[];
    weatherItems: WeatherItem[];
    youtubeItems?: YouTubeVideo[];
    shouldShowTabs: boolean;
    mapLocation?: string;
    googleMapsKey?: string;
  };
};

export type PerformSearchOptions = {
  context?: string[];
  userId?: string | null;
  sessionId?: string | null;
};

export type MemoryWindowTurn = {
  role: "user" | "assistant";
  type: "text" | "search";
  text: string;
  search?: { searchQuery?: string; overallSummary?: string[] };
};

export type MemoryWindowInput = {
  windowKey: string;
  turns: MemoryWindowTurn[];
  userId?: string | null;
  sessionId?: string | null;
};

export type MemoryExtractionResult = {
  windowKey: string;
  permanentFacts: string[];
  conversationSummary: string | null;
};

function extractJsonObject(raw: string): unknown {
  const text = String(raw ?? "").trim();
  if (!text) return null;
  const first = text.indexOf("{");
  const last = text.lastIndexOf("}");
  const candidate = first >= 0 && last > first ? text.slice(first, last + 1) : text;
  try {
    return JSON.parse(candidate);
  } catch {
    return null;
  }
}

function normalizeMemoryFacts(value: unknown): string[] {
  const arr = Array.isArray(value) ? value : [];
  const cleaned = arr
    .map((item) => String(item ?? "").trim())
    .filter(Boolean)
    .map((item) => item.slice(0, 200));
  return Array.from(new Set(cleaned)).slice(0, 10);
}

function normalizeSummary(value: unknown): string | null {
  const text = String(value ?? "").trim();
  if (!text) return null;
  return text.slice(0, 400);
}

export async function extractMemoryFromWindow(
  input: MemoryWindowInput
): Promise<MemoryExtractionResult> {
  const windowKey = String(input?.windowKey ?? "");
  const turns = Array.isArray(input?.turns) ? input.turns : [];
  if (!windowKey || turns.length === 0) {
    return { windowKey, permanentFacts: [], conversationSummary: null };
  }

  const hasGroqKey = Boolean(process.env.GROQ_API_KEY || process.env.OPEN_AI_API_KEY);
  if (!hasGroqKey) {
    return { windowKey, permanentFacts: [], conversationSummary: null };
  }

  const compactTurns = turns.map((t) => ({
    role: t.role,
    type: t.type,
    text: String(t.text ?? "").slice(0, 500),
    search: t.search
      ? {
          searchQuery: t.search.searchQuery ? String(t.search.searchQuery).slice(0, 200) : undefined,
          overallSummary: Array.isArray(t.search.overallSummary)
            ? t.search.overallSummary.map((s) => String(s ?? "").slice(0, 200)).filter(Boolean).slice(0, 3)
            : undefined,
        }
      : undefined,
  }));

  const systemInstruction = {
    parts: [
      {
        text:
          "You extract memory from a short conversation window. Return only strict JSON with keys " +
          '"permanent_facts" (array of short strings) and "conversation_summary" (short string). ' +
          "Only include facts explicitly stated by the user. If nothing is suitable, return empty array and empty string.",
      },
    ],
  };

  const userText = `ConversationWindow: ${JSON.stringify({ turns: compactTurns })}`;

  const result = await GroqClient.getInstance().generateContent("openai/gpt-oss-120b", userText, {
    systemInstruction,
  });

  const parsed = extractJsonObject(result?.text ?? "");
  const permanentFacts = normalizeMemoryFacts(
    (parsed as any)?.permanent_facts ?? (parsed as any)?.permanentFacts
  );
  const conversationSummary = normalizeSummary(
    (parsed as any)?.conversation_summary ?? (parsed as any)?.conversationSummary
  );

  if (input?.userId && permanentFacts.length > 0) {
    await mem0AddTurn(
      permanentFacts.map((fact) => ({ role: "user", content: fact })),
      { userId: input.userId, sessionId: input.sessionId ?? undefined },
      { category: "permanent_memory", source: "groq", window_key: windowKey }
    );
  }

  return { windowKey, permanentFacts, conversationSummary };
}

export async function performDynamicSearch(
  query: string,
  options?: PerformSearchOptions
): Promise<DynamicSearchResult> {
  const trimmed = (query || "").trim();
  if (!trimmed) return { type: "text", content: "" };

  const jar = await cookies();
  const aiProvider = jar.get("ai_provider")?.value === "gemini" ? "gemini" : "groq";

  const baseContext = options?.context ?? [];

  let askCloudyContext: any = null;
  if (Array.isArray(baseContext)) {
    const marker = baseContext.find(
      (c) => typeof c === "string" && c.trim().startsWith("AskCloudyContext:")
    );
    if (marker) {
      const raw = marker.replace(/^AskCloudyContext:\s*/i, "");
      try {
        askCloudyContext = JSON.parse(raw);
      } catch {
        askCloudyContext = null;
      }
    }
  }

  const isAskCloudy = Boolean(askCloudyContext && askCloudyContext.kind === "ask_cloudy_context");

  const mem0Ops: Mem0Operation[] = [];

  const lowerForMem = trimmed.toLowerCase();
  const isNameQuery =
    /(\bmy name\b|\bwhat is my name\b|\bwhat'?s my name\b|\bwhats my name\b|\bwho am i\b|\bdo you remember my name\b|\bremember my name\b|\bdo you know my name\b)/i.test(lowerForMem);
  const isRecallQuery =
    /\bwhat do you remember\b/.test(lowerForMem) ||
    /\bwhat do you know\b/.test(lowerForMem) ||
    /\bwhat do you know about me\b/.test(lowerForMem) ||
    /\bwhat have i told you\b/.test(lowerForMem);
  const memQuery = isNameQuery ? "name" : isRecallQuery ? "profile preferences history" : trimmed;

  const memContextResult =
    options?.userId && process.env.MEM0_API_KEY && !isAskCloudy
      ? await mem0SearchForContext(memQuery, { userId: options.userId, sessionId: options.sessionId ?? undefined })
      : { lines: [], used: false };

  if (memContextResult.used) {
    mem0Ops.push("search");
  }

  const memContext = memContextResult.lines;

  const combinedContext = [...baseContext, ...memContext];

  const intent = await detectIntent(trimmed, combinedContext, aiProvider);

  if (!intent.shouldShowTabs) {
    const raw = intent.overallSummaryLines;
    const lines = Array.isArray(raw) ? raw.filter(Boolean) : [];
    const content = lines.length > 0 ? lines.join(" ") : "Cloudy could not generate a summary for this query.";

    if (options?.userId) {
      mem0Ops.push("add");
      void mem0AddTurn(
        [
          { role: "user", content: trimmed },
          { role: "assistant", content },
        ],
        { userId: options.userId, sessionId: options.sessionId ?? undefined },
        { category: "conversation", mode: "text" }
      );
    }

    return {
      type: "text",
      content,
      mem0Ops,
    };
  }

  let searchQuery = intent.searchQuery ?? trimmed;
  if (isAskCloudy) {
    const selected = (askCloudyContext && (askCloudyContext as any).selected) || null;
    const link =
      selected && typeof selected.link === "string"
        ? (selected.link as string).trim()
        : "";
    const title =
      selected && typeof selected.title === "string"
        ? (selected.title as string).trim()
        : "";
    const text =
      selected && typeof selected.text === "string"
        ? (selected.text as string).trim()
        : "";
    if (link) {
      searchQuery = link;
    } else {
      const combined = `${title} ${text}`.trim();
      if (combined) {
        searchQuery = combined;
      }
    }
  }
  let overallSummaryLines = intent.overallSummaryLines;

  const [rawWebItems, mediaItems, weatherItems, youtubeItems] = await Promise.all([
    webSearch(searchQuery),
    imageSearch(searchQuery),
    (async () => {
      const lower = searchQuery.toLowerCase();
      const isWeather = /(weather|forecast|temperature|rain|snow|thunder|wind|humidity)\b/.test(lower);
      if (isWeather) {
        const locs = extractLocationsFromQuery(searchQuery);
        if (locs.length) {
          return Promise.all(locs.map((city) => fetchWeatherForCity(city)));
        }
      }
      return [];
    })(),
    (async () => {
      if (intent.youtubeQuery) {
        return youtubeSearch(intent.youtubeQuery);
      }
      return [];
    })(),
  ]);

  let webItems: { link: string; title: string; summaryLines: string[]; imageUrl?: string }[] = [];

  if (rawWebItems.length > 0) {
    const s = await summarizeItems(rawWebItems, searchQuery, aiProvider);
    if (s.overallSummaryLines.length > 0) {
      overallSummaryLines = s.overallSummaryLines;
    }
    webItems = rawWebItems.map((it, idx) => {
      const found = s.summaries.find((x) => x.index === idx);
      const lines = Array.isArray(found?.summary_lines) && found.summary_lines.length
        ? found.summary_lines.slice(0, 3)
        : [it.snippet || ""].filter(Boolean).slice(0, 1);
      const normalized = [lines[0] ?? "", lines[1] ?? "", lines[2] ?? ""];
      return { link: it.link, title: it.title, summaryLines: normalized, imageUrl: it.imageUrl };
    });
  } else if (!overallSummaryLines.length) {
    overallSummaryLines = ["No results found.", ""];
  }

  const summaryText = overallSummaryLines.filter(Boolean).join(" ");

  if (options?.userId) {
    mem0Ops.push("add");
    void mem0AddTurn(
      [
        { role: "user", content: trimmed },
        { role: "assistant", content: summaryText || `Search results for: ${searchQuery}` },
      ],
      { userId: options.userId, sessionId: options.sessionId ?? undefined },
      { category: "search", mode: "tabs" }
    );
  }

  return {
    type: "search",
    mem0Ops,
    data: {
      searchQuery,
      overallSummaryLines,
      webItems,
      mediaItems,
      weatherItems,
      youtubeItems,
      shouldShowTabs: true,
      mapLocation: intent.mapLocation,
      googleMapsKey: process.env.GOOGLE_MAP_API_KEY,
    },
  };
}

export type WebTabData = {
  overallSummaryLines: string[];
  webItems: { link: string; title: string; summaryLines: string[]; imageUrl?: string }[];
};

export async function fetchWebTabData(searchQuery: string): Promise<WebTabData> {
  const q = (searchQuery || "").trim();
  if (!q) return { overallSummaryLines: [], webItems: [] };

  const jar = await cookies();
  const aiProvider = jar.get("ai_provider")?.value === "gemini" ? "gemini" : "groq";

  const rawWebItems = await webSearch(q);
  if (!rawWebItems.length) return { overallSummaryLines: ["No results found.", ""], webItems: [] };

  const s = await summarizeItems(rawWebItems, q, aiProvider);
  const overallSummaryLines = s.overallSummaryLines.length ? s.overallSummaryLines : [];
  const webItems = rawWebItems.map((it, idx) => {
    const found = s.summaries.find((x) => x.index === idx);
    const lines = Array.isArray(found?.summary_lines) && found.summary_lines.length
      ? found.summary_lines.slice(0, 3)
      : [it.snippet || ""].filter(Boolean).slice(0, 1);
    const normalized = [lines[0] ?? "", lines[1] ?? "", lines[2] ?? ""];
    return { link: it.link, title: it.title, summaryLines: normalized, imageUrl: it.imageUrl };
  });

  return { overallSummaryLines, webItems };
}

export async function fetchMediaTabData(searchQuery: string): Promise<{ src: string; alt?: string }[]> {
  const q = (searchQuery || "").trim();
  if (!q) return [];
  return imageSearch(q);
}

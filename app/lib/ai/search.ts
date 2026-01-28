import { GeminiClient } from "./gemini-client";
import { GroqClient } from "./groq/groq-client";

type RawItem = { link: string; title: string; snippet?: string; imageUrl?: string };
type SummItem = { index: number; summary_lines: string[] };

type WebSearchOptions = {
  num?: number;
  cx?: string;
  safe?: "active" | "off" | "high" | "medium";
};

type ImageSearchOptions = {
  num?: number;
  cx?: string;
  safe?: "active" | "off" | "high" | "medium";
};

function extractJson(s: string) {
  const start = s.indexOf("{");
  const end = s.lastIndexOf("}");
  if (start !== -1 && end !== -1 && end > start) {
    try {
      return JSON.parse(s.slice(start, end + 1));
    } catch {
      return null;
    }
  }
  return null;
}

export async function webSearch(query: string, options: WebSearchOptions = {}): Promise<RawItem[]> {
  const trimmed = (query ?? "").trim();
  if (!trimmed) return [];

  const apiKey = process.env.GOOGLE_API_KEY;
  const cxEnv = process.env.GOOGLE_CX || process.env.GOOGLE_CSE_ID;
  const cx = options.cx || cxEnv;
  if (!apiKey || !cx) {
    console.error("[ai:webSearch] Missing GOOGLE_API_KEY or GOOGLE_CX");
    return [];
  }

  const requestedNum = typeof options.num === "number" ? options.num : 10;
  const num = Math.min(Math.max(requestedNum, 1), 10);
  const url = new URL("https://www.googleapis.com/customsearch/v1");
  url.searchParams.set("key", apiKey);
  url.searchParams.set("cx", cx);
  url.searchParams.set("q", trimmed);
  url.searchParams.set("num", String(num));
  if (options.safe) url.searchParams.set("safe", options.safe);

  try {
    const res = await fetch(url.toString(), { next: { revalidate: 120 } });
    if (!res.ok) {
      console.error("[ai:webSearch] Non-OK response", res.status, res.statusText);
      return [];
    }
    const json = await res.json();
    const items = Array.isArray(json.items) ? json.items : [];
    const rawItems: RawItem[] = items.slice(0, num).map((item: any) => ({
      link: item.link,
      title: item.title,
      snippet: item.snippet,
      imageUrl: item.pagemap?.cse_image?.[0]?.src || item.pagemap?.cse_thumbnail?.[0]?.src,
    }));
    return rawItems;
  } catch (err) {
    console.error("[ai:webSearch] Error calling Custom Search API", err);
    return [];
  }
}

export async function imageSearch(
  query: string,
  options: ImageSearchOptions = {}
): Promise<{ src: string; alt?: string }[]> {
  const trimmed = (query ?? "").trim();
  if (!trimmed) return [];

  const apiKey = process.env.GOOGLE_API_KEY;
  const cxEnv = process.env.GOOGLE_CX || process.env.GOOGLE_CSE_ID;
  const cx = options.cx || cxEnv;
  if (!apiKey || !cx) {
    console.error("[ai:imageSearch] Missing GOOGLE_API_KEY or GOOGLE_CX");
    return [];
  }

  const requestedNum = typeof options.num === "number" ? options.num : 10;
  const num = Math.min(Math.max(requestedNum, 1), 10);
  const url = new URL("https://www.googleapis.com/customsearch/v1");
  url.searchParams.set("key", apiKey);
  url.searchParams.set("cx", cx);
  url.searchParams.set("q", trimmed);
  url.searchParams.set("searchType", "image");
  url.searchParams.set("num", String(num));
  if (options.safe) url.searchParams.set("safe", options.safe);

  try {
    const res = await fetch(url.toString(), { next: { revalidate: 120 } });
    if (!res.ok) {
      console.error("[ai:imageSearch] Non-OK response", res.status, res.statusText);
      return [];
    }
    const json = await res.json();
    const items = Array.isArray(json.items) ? json.items : [];
    const mapped = (items as Array<{ link: string; title?: string }>).slice(0, num).map((i) => ({
      src: i.link,
      alt: i.title,
    }));
    return mapped;
  } catch (err) {
    console.error("[ai:imageSearch] Error calling Custom Search API", err);
    return [];
  }
}

export async function summarizeItems(
  items: RawItem[],
  query?: string,
  providerOverride?: "gemini" | "groq"
): Promise<{ overallSummaryLines: string[]; summaries: SummItem[] }> {
  if (!Array.isArray(items) || !items.length) {
    return { overallSummaryLines: [], summaries: [] };
  }

  const hasGroqKey = Boolean(process.env.GROQ_API_KEY || process.env.OPEN_AI_API_KEY);
  const hasGeminiKey = Boolean(process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY);
  const provider = (providerOverride || process.env.AI_PROVIDER || (hasGroqKey ? "groq" : "gemini")).toLowerCase();

  if (!(hasGroqKey || hasGeminiKey)) {
    return { overallSummaryLines: [], summaries: [] };
  }

  const trimmedItems = items.slice(0, 10);
  const trimmedQuery = (query ?? "").toString().trim();

  try {
    const prompt =
      `You are answering the user query: "${trimmedQuery || "N/A"}" using web search results. ` +
      "Return strictly valid compact JSON with keys overall_summary_lines and items. " +
      "overall_summary_lines must be an array of at most two very short plain-text lines " +
      "that directly answer the user's query using only the information implied by the results. " +
      "Write the answer as if you are responding directly to the user, not describing \"results\" in general. " +
      "When possible, briefly mention which result supports the answer, such as a site name or article title. " +
      "items must be an array of objects {index, summary_lines}, where index is the zero-based " +
      "index into the original results array, and summary_lines is an array of up to three very short " +
      "plain-text lines summarizing that specific result. " +
      `Use this data: ${JSON.stringify(trimmedItems)}`;

    const resp =
      provider === "groq" && hasGroqKey
        ? await GroqClient.getInstance().generateContent("openai/gpt-oss-120b", prompt)
        : await GeminiClient.getInstance().generateContent("gemini-2.5-flash", prompt);

    const parsed = extractJson(resp?.text || "");
    const overallSummaryLines: string[] = Array.isArray(parsed?.overall_summary_lines)
      ? parsed.overall_summary_lines.slice(0, 2)
      : [];
    const summaries: SummItem[] = Array.isArray(parsed?.items) ? parsed.items : [];
    return { overallSummaryLines, summaries };
  } catch (err) {
    console.error("[ai:summarizeItems] Error summarizing items", err);
    return { overallSummaryLines: [], summaries: [] };
  }
}

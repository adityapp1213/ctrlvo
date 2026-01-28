"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import { useUser } from "@clerk/nextjs";
import { AIInput, type AIInputSubmitMeta } from "@/components/ui/ai-input";
import { cn } from "@/lib/utils";
import { WeatherWidget } from "@/components/ui/weather-widget";
import {
  Conversation,
  ConversationContent,
  ConversationScrollButton,
} from "@/components/ai-elements/conversation";
import {
  Message,
  MessageContent,
} from "@/components/ai-elements/message";
import { AtomLogo } from "@/components/logo";
import {
  fetchMediaTabData,
  fetchWebTabData,
  performDynamicSearch,
  extractMemoryFromWindow,
  type MemoryWindowTurn,
  type DynamicSearchResult,
} from "@/app/actions/search";
import { SearchResultsBlock } from "@/components/search-results-block";
import { SearchResultItem } from "@/components/search-result-item";
import { YouTubeVideo } from "@/app/lib/ai/youtube";
import { CheckCircle2, Globe, Loader2, Mic, PlayIcon, Quote, Search } from "lucide-react";
import { VideoList } from "@/components/video-list";
import { Browser, BrowserTab } from "@/components/ui/browser";
import { getChatSession, saveChatSession, type PinnedItem } from "@/app/lib/chat-store";

import { MapBlock } from "@/components/map-block";

// Ensure this component is imported only on client side or handling it correctly
// Since SearchResultsBlock is a client component, it's fine.

type AskCloudyContext = {
  selectedText: string;
  source: "conversation" | "web" | "youtube" | "other";
  link?: string;
  title?: string;
  searchQuery?: string;
  messageRole?: "user" | "assistant";
  messageId?: number | string;
};

type ChatMessage = {
  id: number;
  role: "user" | "assistant";
  content: string;
  isVoice?: boolean;
  type?: "text" | "search";
  data?: DynamicSearchResult["data"];
  mem0Ops?: import("@/app/lib/mem0").Mem0Operation[];
  askCloudy?: AskCloudyContext | null;
};

type SearchConversationShellProps = {
  tab: string;
  searchQuery: string;
  shouldShowTabs: boolean;
  overallSummaryLines: string[];
  webItems: { link: string; title: string; summaryLines: string[]; imageUrl?: string }[];
  mediaItems: { src: string; alt?: string }[];
  isWeatherQuery?: boolean;
  weatherItems?: Array<{
    city: string;
    latitude?: number;
    longitude?: number;
    data?: {
      city: string;
      temperature: number;
      weatherType: "clear" | "clouds" | "rain" | "snow" | "thunderstorm" | "mist" | "unknown";
      dateTime: string;
      isDay: boolean;
    } | null;
    error?: string | null;
  }>;
  youtubeItems?: YouTubeVideo[];
  mapLocation?: string;
  googleMapsKey?: string;
};

type AIInputFooterProps = {
  onSubmit?: (value: string, meta?: AIInputSubmitMeta) => void;
  inputValue?: string;
  onInputChange?: (value: string) => void;
  onSpeechProcessingChange?: (isProcessing: boolean) => void;
  askCloudyOverlayText?: string | null;
  onClearAskCloudyOverlay?: () => void;
};

function normalizeExternalUrl(value: string | undefined) {
  const raw = (value ?? "").trim().replace(/^['"`]+|['"`]+$/g, "");
  if (!raw) return null;
  try {
    const u = new URL(raw);
    if (u.protocol !== "http:" && u.protocol !== "https:") return null;
    return u.toString();
  } catch {
    return null;
  }
}

export function AIInputFooter({
  onSubmit,
  inputValue,
  onInputChange,
  onSpeechProcessingChange,
  askCloudyOverlayText,
  onClearAskCloudyOverlay,
}: AIInputFooterProps) {
  const router = useRouter();

  const handleSubmit = (value: string, meta?: AIInputSubmitMeta) => {
    const q = (value || "").trim();
    if (!q) return;
    if (onSubmit) {
      onSubmit(q, meta);
      return;
    }
    router.push(`/home/search?q=${encodeURIComponent(q)}&tab=results`);
  };

  return (
    <div className="absolute bottom-0 left-0 right-0 z-50 w-full bg-background/80 backdrop-blur-md border-t supports-[backdrop-filter]:bg-background/60 py-4">
      <div className="max-w-3xl mx-auto px-4">
        <div className="relative">
          {askCloudyOverlayText && (
            <div className="absolute -top-7 left-0 right-0 flex items-center justify-between text-xs px-3">
              <div className="inline-flex items-center gap-2 max-w-full">
                <span className="text-muted-foreground">↩</span>
                <span className="truncate text-muted-foreground">
                  “{askCloudyOverlayText}”
                </span>
              </div>
              <button
                type="button"
                onClick={onClearAskCloudyOverlay}
                className="ml-2 text-muted-foreground hover:text-foreground"
              >
                ×
              </button>
            </div>
          )}
          <AIInput
            className="animate-[fade-scale_0.2s_ease-out]"
            onSubmit={handleSubmit}
            value={inputValue}
            onValueChange={onInputChange}
            onSpeechProcessingChange={onSpeechProcessingChange}
          />
        </div>
      </div>
    </div>
  );
}

export function SearchConversationShell(props: SearchConversationShellProps) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const chatId = searchParams.get("chatId");
  const voiceParam = searchParams.get("voice") === "1";
  
  const rootRef = useRef<HTMLDivElement | null>(null);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(chatId);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const { user } = useUser();
  const userId = user?.id ?? null;
  
  // Browser state
  const [browserTabs, setBrowserTabs] = useState<BrowserTab[]>([]);
  const [activeTabId, setActiveTabId] = useState<string | null>(null);
  const [chatInputValue, setChatInputValue] = useState("");
  const [isChatLoading, setIsChatLoading] = useState(false);
  const [isSpeechProcessing, setIsSpeechProcessing] = useState(false);
  const [chatLoadingQuery, setChatLoadingQuery] = useState<string>("");
  const pendingSpeakTextRef = useRef<string | null>(null);
  const pendingSpeakShouldSpeakRef = useRef<boolean>(false);
  const lastSpokenKeyRef = useRef<string>("");
  const [activeInputSource, setActiveInputSource] = useState<AIInputSubmitMeta["source"] | null>(null);
  const [speakNonce, setSpeakNonce] = useState(0);
  const [pinnedItems, setPinnedItems] = useState<PinnedItem[]>([]);
  const [conversationMemory, setConversationMemory] = useState<string[]>([]);
  const [memoryWindowKey, setMemoryWindowKey] = useState<string | null>(null);
  const [askCloudySelection, setAskCloudySelection] = useState<{
    text: string;
    top: number;
    left: number;
    meta: AskCloudyContext;
  } | null>(null);
  const [askCloudyContext, setAskCloudyContext] = useState<AskCloudyContext | null>(null);

  // Content state
  const [contentState, setContentState] = useState({
     searchQuery: props.searchQuery,
     shouldShowTabs: props.shouldShowTabs,
     overallSummaryLines: props.overallSummaryLines,
     webItems: props.webItems,
     mediaItems: props.mediaItems,
     isWeatherQuery: props.isWeatherQuery,
     weatherItems: props.weatherItems ?? [],
     youtubeItems: props.youtubeItems ?? [],
     mapLocation: props.mapLocation,
     googleMapsKey: props.googleMapsKey,
     tab: props.tab,
     pinnedItems: [] as PinnedItem[],
  });

  useEffect(() => {
      if (chatId) {
         if (!userId) return;
         const session = getChatSession(userId, chatId);
        if (session) {
           setActiveSessionId(session.id);
           setMessages(session.messages as ChatMessage[]);
           setBrowserTabs(session.browserTabs);
           setActiveTabId(session.activeTabId);
           setPinnedItems(session.pinnedItems ?? []);
           setConversationMemory(session.conversationMemory ?? []);
           setMemoryWindowKey(session.memoryWindowKey ?? null);
           setContentState({
               searchQuery: session.searchQuery,
               shouldShowTabs: session.shouldShowTabs,
               overallSummaryLines: session.overallSummaryLines,
               webItems: session.webItems,
               mediaItems: session.mediaItems,
               isWeatherQuery: session.isWeatherQuery,
               weatherItems: session.weatherItems,
               youtubeItems: session.youtubeItems,
               mapLocation: session.mapLocation,
               googleMapsKey: session.googleMapsKey,
               tab: session.tab,
               pinnedItems: session.pinnedItems ?? [],
            });
            return;
         } else if (props.searchQuery) {
             // Session missing, retry as fresh search
             router.replace(`/home/search?q=${encodeURIComponent(props.searchQuery)}&tab=${props.tab}`);
             return;
         } else {
            setActiveSessionId(null);
            setMessages([]);
            setBrowserTabs([]);
            setActiveTabId(null);
            setConversationMemory([]);
            setMemoryWindowKey(null);
            const url = `/home/search`;
            window.history.replaceState({ ...window.history.state, as: url, url }, "", url);
            return;
         }
      }
      
      if (props.searchQuery && !chatId && userId) {
        const newId = Date.now().toString();
        setActiveSessionId(newId);
        const newUrl = `/home/search?q=${encodeURIComponent(props.searchQuery)}&tab=${props.tab}&chatId=${newId}`;
        window.history.replaceState({ ...window.history.state, as: newUrl, url: newUrl }, "", newUrl);
        return;
     }

     if (!chatId && !props.searchQuery) {
        setActiveSessionId(null);
        setMessages([]);
        setBrowserTabs([]);
        setActiveTabId(null);
        setConversationMemory([]);
        setMemoryWindowKey(null);
        setContentState({
             searchQuery: "",
             shouldShowTabs: false,
             overallSummaryLines: [],
             webItems: [],
             mediaItems: [],
             isWeatherQuery: false,
             weatherItems: [],
             youtubeItems: [],
             mapLocation: undefined,
             googleMapsKey: undefined,
             tab: "results",
             pinnedItems: [],
         });
         setPinnedItems([]);
     }
  }, [chatId, userId, props.searchQuery, props.tab]);

  useEffect(() => {
     if (!userId) return;
     if (!activeSessionId) return;
     if (messages.length === 0 && !contentState.searchQuery) return;
     saveChatSession(userId, {
        id: activeSessionId,
        title: contentState.searchQuery || "New Chat",
        timestamp: Date.now(),
        messages: messages as any,
        browserTabs,
        activeTabId,
        ...contentState,
        pinnedItems,
        conversationMemory,
        memoryWindowKey,
     });
  }, [
     userId,
     activeSessionId,
     messages,
     browserTabs,
     activeTabId,
     contentState,
     pinnedItems,
     conversationMemory,
     memoryWindowKey,
  ]);

  const { searchQuery, shouldShowTabs, overallSummaryLines, webItems, mediaItems, isWeatherQuery, weatherItems, youtubeItems, mapLocation, googleMapsKey, tab } = contentState;
  const primaryTab: "results" | "media" = tab === "media" ? "media" : "results";

  useEffect(() => {
    const q = (searchQuery || "").trim();
    if (!q) return;
    if (isChatLoading) return;

    let toSpeak = "";
    if (Array.isArray(youtubeItems) && youtubeItems.length > 0) {
      toSpeak = `Here are your vids on ${q}`;
    } else if (shouldShowTabs) {
      toSpeak = overallSummaryLines.filter(Boolean).join(" ");
      if (!toSpeak.trim() && Array.isArray(webItems) && webItems.length > 0) {
        const top = webItems[0];
        toSpeak = [top.title, top.summaryLines?.[0]].filter(Boolean).join(". ");
      }
    } else {
      toSpeak = overallSummaryLines.filter(Boolean).join(" ");
    }

    toSpeak = (toSpeak || "").trim();
    if (!toSpeak) return;
    const mode = Array.isArray(youtubeItems) && youtubeItems.length > 0 ? "yt" : shouldShowTabs ? "tabs" : "text";
    const key = `initial:${q}:${mode}:${toSpeak.slice(0, 80)}`;
    if (lastSpokenKeyRef.current === key) return;
    lastSpokenKeyRef.current = key;
    pendingSpeakShouldSpeakRef.current = voiceParam;
    pendingSpeakTextRef.current = toSpeak;

    if (voiceParam && typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      params.delete("voice");
      const qs = params.toString();
      const nextUrl = qs ? `/home/search?${qs}` : "/home/search";
      window.history.replaceState(
        { ...window.history.state, as: nextUrl, url: nextUrl },
        "",
        nextUrl
      );
    }
  }, [isChatLoading, overallSummaryLines, searchQuery, shouldShowTabs, voiceParam, webItems, youtubeItems]);

  useEffect(() => {
    if (isSpeechProcessing) setActiveInputSource("voice");
  }, [isSpeechProcessing]);

  const prefetchRef = useRef<{ query: string; web: boolean; media: boolean } | null>(null);
  const [bootStatus, setBootStatus] = useState<{ query: string; webDone: boolean; mediaDone: boolean }>(() => {
    const q = (props.searchQuery || "").trim();
    return {
      query: q,
      webDone: props.webItems.length > 0,
      mediaDone: props.mediaItems.length > 0,
    };
  });

  useEffect(() => {
    const q = (searchQuery || "").trim();
    if (!q) {
      setBootStatus({ query: "", webDone: true, mediaDone: true });
      return;
    }
    setBootStatus((prev) => {
      if (prev.query === q) return prev;
      return { query: q, webDone: webItems.length > 0, mediaDone: mediaItems.length > 0 };
    });
  }, [searchQuery, webItems.length, mediaItems.length]);

  useEffect(() => {
    const handleSelectionCheck = () => {
      const root = rootRef.current;
      if (!root) return;
      if (typeof window === "undefined") return;
      const sel = window.getSelection();
      if (!sel || sel.isCollapsed || sel.rangeCount === 0) {
        setAskCloudySelection(null);
        return;
      }
      const text = sel.toString().trim();
      if (!text) {
        setAskCloudySelection(null);
        return;
      }
      const range = sel.getRangeAt(0);
      const container =
        range.commonAncestorContainer.nodeType === Node.ELEMENT_NODE
          ? (range.commonAncestorContainer as Element)
          : range.commonAncestorContainer.parentElement;
      if (!container || !root.contains(container)) {
        setAskCloudySelection(null);
        return;
      }
      let current: HTMLElement | null =
        container instanceof HTMLElement ? container : container.parentElement;
      let meta: AskCloudyContext = {
        selectedText: text,
        source: "other",
      };
      while (current && root.contains(current)) {
        const ds = current.dataset;
        if (ds && ds.cloudyKind) {
          const kind = ds.cloudyKind as AskCloudyContext["source"];
          meta = {
            selectedText: text,
            source:
              kind === "conversation" || kind === "web" || kind === "youtube"
                ? kind
                : "other",
            link: ds.cloudyLink,
            title: ds.cloudyTitle,
            searchQuery: ds.cloudySearchQuery,
            messageRole:
              ds.cloudyRole === "user" || ds.cloudyRole === "assistant"
                ? ds.cloudyRole
                : undefined,
            messageId: ds.cloudyMessageId,
          };
          break;
        }
        current = current.parentElement;
      }
      const rect = range.getBoundingClientRect();
      const top = rect.top - 40;
      const left = rect.left + rect.width / 2;
      setAskCloudySelection({
        text,
        top,
        left,
        meta,
      });
    };

    const handleMouseUp = () => {
      setTimeout(handleSelectionCheck, 0);
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setAskCloudySelection(null);
        setAskCloudyContext(null);
        if (typeof window !== "undefined") {
          const sel = window.getSelection();
          sel?.removeAllRanges();
        }
        return;
      }
      setTimeout(handleSelectionCheck, 0);
    };

    document.addEventListener("mouseup", handleMouseUp);
    document.addEventListener("keyup", handleKeyUp);
    document.addEventListener("touchend", handleMouseUp);

    return () => {
      document.removeEventListener("mouseup", handleMouseUp);
      document.removeEventListener("keyup", handleKeyUp);
      document.removeEventListener("touchend", handleMouseUp);
    };
  }, []);

  useEffect(() => {
    const q = (searchQuery || "").trim();
    if (!shouldShowTabs || !q) return;
    if (isWeatherQuery) return;
    if (Array.isArray(youtubeItems) && youtubeItems.length > 0) return;

    if (!prefetchRef.current || prefetchRef.current.query !== q) {
      prefetchRef.current = { query: q, web: false, media: false };
    }

    let cancelled = false;
    const state = prefetchRef.current;

    void (async () => {
      if (!state || state.web || webItems.length > 0) return;
      state.web = true;
      let data: { overallSummaryLines: string[]; webItems: { link: string; title: string; summaryLines: string[]; imageUrl?: string }[] } = {
        overallSummaryLines: [],
        webItems: [],
      };
      try {
        data = await fetchWebTabData(q);
      } catch {
        data = { overallSummaryLines: [], webItems: [] };
      }
      if (cancelled) return;
      setContentState((prev) => {
        if ((prev.searchQuery || "").trim() !== q) return prev;
        if (prev.webItems.length > 0) return prev;
        return { ...prev, overallSummaryLines: data.overallSummaryLines, webItems: data.webItems };
      });
      setBootStatus((prev) => ((prev.query || "").trim() === q ? { ...prev, webDone: true } : prev));
    })();

    void (async () => {
      if (!state || state.media || mediaItems.length > 0) return;
      state.media = true;
      let items: { src: string; alt?: string }[] = [];
      try {
        items = await fetchMediaTabData(q);
      } catch {
        items = [];
      }
      if (cancelled) return;
      setContentState((prev) => {
        if ((prev.searchQuery || "").trim() !== q) return prev;
        if (prev.mediaItems.length > 0) return prev;
        return { ...prev, mediaItems: items };
      });
      setBootStatus((prev) => ((prev.query || "").trim() === q ? { ...prev, mediaDone: true } : prev));
    })();

    return () => {
      cancelled = true;
    };
  }, [shouldShowTabs, searchQuery, isWeatherQuery, youtubeItems, webItems.length, mediaItems.length]);

  const sources = (() => {
    const hosts: string[] = [];
    for (const it of webItems) {
      try {
        const h = new URL(it.link).hostname.replace(/^www\\./i, "");
        if (h && !hosts.includes(h)) hosts.push(h);
      } catch {}
      if (hosts.length >= 6) break;
    }
    return hosts;
  })();

  const showBootOverlay =
    shouldShowTabs &&
    Boolean((searchQuery || "").trim()) &&
    !isWeatherQuery &&
    !(Array.isArray(youtubeItems) && youtubeItems.length > 0) &&
    ((bootStatus.query || "").trim() === (searchQuery || "").trim()) &&
    (!bootStatus.webDone || !bootStatus.mediaDone);

  const handlePrimaryTabChange = (nextTab: "results" | "media") => {
    setContentState((prev) => ({ ...prev, tab: nextTab }));
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    if (searchQuery) params.set("q", searchQuery);
    params.set("tab", nextTab);
    if (activeSessionId) params.set("chatId", activeSessionId);
    const qs = params.toString();
    const newUrl = qs ? `/home/search?${qs}` : "/home/search";
    window.history.replaceState(
      { ...window.history.state, as: newUrl, url: newUrl },
      "",
      newUrl
    );
  };

  const handleAddToChat = (text: string) => {
    setChatInputValue((prev) => {
      const prefix = prev ? prev + "\n\n" : "";
      return prefix + `> ${text}`;
    });
  };

  const handleLinkClick = (url: string, title: string) => {
    // Check if tab already exists
    const existingTab = browserTabs.find((t) => t.url === url);
    if (existingTab) {
      setActiveTabId(existingTab.id);
      return;
    }

    const newTab: BrowserTab = {
      id: Date.now().toString(),
      url,
      title,
    };
    
    setBrowserTabs((prev) => [...prev, newTab]);
    setActiveTabId(newTab.id);
  };

  const handleCloseTab = (id: string) => {
    setBrowserTabs((prev) => {
      const newTabs = prev.filter((t) => t.id !== id);
      if (newTabs.length === 0) {
        setActiveTabId(null);
      } else if (activeTabId === id) {
        setActiveTabId(newTabs[newTabs.length - 1].id);
      }
      return newTabs;
    });
  };

  const handleCloseBrowser = () => {
    setBrowserTabs([]);
    setActiveTabId(null);
  };

  const handleTogglePinItem = (item: PinnedItem) => {
    setPinnedItems((prev) => {
      const idx = prev.findIndex((p) => p.id === item.id && p.kind === item.kind);
      if (idx >= 0) {
        return prev.filter((_, i) => i !== idx);
      }
      return [...prev, item];
    });
  };

  // playingVideoId moved to VideoList component

  const CARTESIA_VERSION = "2025-04-16";
  const CARTESIA_VOICE_ID = "a167e0f3-df7e-4d52-a9c3-f949145efdab";

  const humanizeCartesiaTranscript = useCallback((text: string) => {
    const raw = (text || "").trim();
    if (!raw) return raw;

    const hasEmotion = /<emotion\s+value\s*=\s*["'][^"']+["']\s*\/?>/i.test(raw);
    const inferEmotion = (t: string) => {
      const lower = t.toLowerCase();
      if (lower.includes("sorry") || lower.includes("apolog")) return "apologetic";
      if (lower.includes("thank") || lower.includes("grateful")) return "grateful";
      if (lower.includes("wow") || lower.includes("awesome") || lower.includes("amazing") || lower.includes("great") || /!/.test(t))
        return "excited";
      if (t.trim().endsWith("?")) return "curious";
      if (lower.includes("scared") || lower.includes("afraid")) return "scared";
      if (lower.includes("angry") || lower.includes("mad")) return "angry";
      return "content";
    };

    const emotion = inferEmotion(raw);
    let out = hasEmotion ? raw : `<emotion value="${emotion}" />${raw}`;

    if (!/\[laughter\]/i.test(out) && emotion === "excited") {
      const serious = /\b(error|failed|cannot|can't|unable|sorry)\b/i.test(raw);
      if (!serious) {
        const firstPunct = out.slice(0, 200).search(/[.!?]/);
        if (firstPunct >= 0) {
          out =
            out.slice(0, firstPunct + 1) +
            " [laughter]<break time=\"200ms\"/>" +
            out.slice(firstPunct + 1).replace(/^\s+/, "");
        }
      }
    }

    if (!/\(ahem\)|\*cough\*/i.test(out)) {
      const lower = raw.toLowerCase();
      if (lower.startsWith("actually") || lower.startsWith("well,") || lower.startsWith("so,")) {
        out = out.replace(/^(\s*<emotion[^>]*\/>\s*)/i, `$1(ahem)<break time="200ms"/>`);
      }
    }

    out = out.replace(/([.!?])\s+(?=[A-Z0-9])/g, `$1<break time="250ms"/>`);
    out = out.replace(/,\s+(?=[^\s<])/g, `,<break time="150ms"/>`);
    out = out.replace(/:\s+(?=[^\s<])/g, `:<break time="200ms"/>`);

    out = out.replace(/(?:<break time="[^"]+"\/>){2,}/g, (m) => m.match(/<break time="[^"]+"\/>/)?.[0] ?? m);
    return out.trim();
  }, []);

  const unlockAudio = useCallback(async () => {
    const w = window as unknown as {
      __atomAudioUnlocked?: boolean;
      __atomAudioContext?: AudioContext;
      webkitAudioContext?: typeof AudioContext;
    };
    if (w.__atomAudioUnlocked) return;
    w.__atomAudioUnlocked = true;
    try {
      const Ctx = window.AudioContext || (window as any).webkitAudioContext;
      if (!Ctx) return;
      const ctx: AudioContext = w.__atomAudioContext ?? new Ctx();
      w.__atomAudioContext = ctx;
      if (ctx.state === "suspended") await ctx.resume();
      const gain = ctx.createGain();
      gain.gain.value = 0;
      gain.connect(ctx.destination);
      const src = ctx.createBufferSource();
      src.buffer = ctx.createBuffer(1, 1, ctx.sampleRate);
      src.connect(gain);
      src.start(0);
      src.stop(0);
    } catch {}
  }, []);

  const speakWithSpeechSynthesis = useCallback((text: string) => {
    const trimmed = (text || "").trim();
    if (!trimmed) return;
    if (!("speechSynthesis" in window) || typeof SpeechSynthesisUtterance === "undefined") return;
    try {
      window.speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(trimmed);
      u.lang = "en-US";
      window.speechSynthesis.speak(u);
    } catch {}
  }, []);

  const getCartesiaAccessToken = useCallback(async (): Promise<string> => {
    const w = window as unknown as {
      __atomCartesiaAccessTokenCache?: { token: string; expiresAt: number };
    };
    const cached = w.__atomCartesiaAccessTokenCache;
    if (cached && Date.now() < cached.expiresAt - 10_000) return cached.token;

    const resp = await fetch("/api/cartesia/access-token", { method: "GET" });
    if (!resp.ok) throw new Error("cartesia_access_token_failed");
    const data = (await resp.json()) as { token: string; expiresAt: number };
    w.__atomCartesiaAccessTokenCache = { token: data.token, expiresAt: data.expiresAt };
    return data.token;
  }, []);

  const speakWithCartesia = useCallback(
    async (text: string) => {
      const trimmed = (text || "").trim();
      if (!trimmed) return;
      try {
        const transcript = humanizeCartesiaTranscript(trimmed);
        const token = await getCartesiaAccessToken();

        const ttsResp = await fetch("https://api.cartesia.ai/tts/bytes", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Cartesia-Version": CARTESIA_VERSION,
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            transcript,
            model_id: "sonic-3",
            voice: { mode: "id", id: CARTESIA_VOICE_ID },
            output_format: {
              container: "wav",
              encoding: "pcm_s16le",
              sample_rate: 44100,
            },
          }),
        });

        if (!ttsResp.ok) throw new Error("cartesia_tts_failed");

        const bytes = await ttsResp.arrayBuffer();
        const blob = new Blob([bytes], { type: "audio/wav" });
        const url = URL.createObjectURL(blob);

        const w = window as unknown as { __atomCartesiaAudio?: HTMLAudioElement };
        if (w.__atomCartesiaAudio) {
          w.__atomCartesiaAudio.pause();
          w.__atomCartesiaAudio.src = "";
          w.__atomCartesiaAudio.load();
        }

        const audio = new Audio(url);
        audio.muted = false;
        audio.volume = 1;
        w.__atomCartesiaAudio = audio;
        audio.onended = () => URL.revokeObjectURL(url);
        await unlockAudio();
        await audio.play();
      } catch {
        speakWithSpeechSynthesis(trimmed);
      }
    },
    [getCartesiaAccessToken, humanizeCartesiaTranscript, speakWithSpeechSynthesis, unlockAudio]
  );

  const handleChatSubmit = async (value: string, meta?: AIInputSubmitMeta) => {
    const trimmed = (value || "").trim();
    if (!trimmed) return;

    const askCtx = askCloudyContext;
    if (askCtx) {
      setAskCloudyContext(null);
    }

    const source: AIInputSubmitMeta["source"] = meta?.source ?? "text";
    const isVoice = source === "voice";

    const messagesForContext: ChatMessage[] = (() => {
      const hasSearchMessage = messages.some((m) => m.type === "search" && m.data);
      const q = (searchQuery || "").trim();
      const hasInitialSearch =
        Boolean(q) &&
        (shouldShowTabs ||
          (Array.isArray(webItems) && webItems.length > 0) ||
          (Array.isArray(mediaItems) && mediaItems.length > 0) ||
          (Array.isArray(youtubeItems) && youtubeItems.length > 0) ||
          (Array.isArray(weatherItems) && weatherItems.length > 0));
      if (!hasInitialSearch || hasSearchMessage) return messages;
      const syntheticSearch: ChatMessage = {
        id: -1,
        role: "assistant",
        content: "",
        type: "search",
        data: {
          searchQuery: q,
          overallSummaryLines,
          webItems,
          mediaItems,
          weatherItems,
          youtubeItems,
          shouldShowTabs,
          mapLocation,
          googleMapsKey,
        },
      };
      return [syntheticSearch, ...messages];
    })();

    const historyContext = messagesForContext
      .filter((m) => {
        const hasContent = typeof m.content === "string" && m.content.trim().length > 0;
        const isSearch = m.type === "search" && m.data;
        return hasContent || isSearch;
      })
      .slice(-50)
      .map((m) => {
        const prefix = m.role === "user" ? "User" : "Assistant";
        if (m.type === "search" && m.data) {
          const summary = m.data.overallSummaryLines?.filter(Boolean).join(" ") || "Search results";
          return `${prefix}: (Search for "${m.data.searchQuery}") ${summary.slice(0, 500)}`;
        }
        const body = (m.content || "").trim().slice(0, 500);
        return `${prefix}: ${body}`;
      });

    const pinnedContext = pinnedItems.slice(-10).map((p) => {
      const kindLabel = p.kind === "youtube" ? "video" : "page";
      const summary = (p.summary || "").trim().slice(0, 200);
      return `Pinned ${kindLabel}: ${p.title}${summary ? ` - ${summary}` : ""}`;
    });

    const maxWindowMessages = 6;
    const recentMessages = [...messagesForContext]
      .filter((m) => typeof m.content === "string" || (m.type === "search" && m.data))
      .slice(-maxWindowMessages);

    let lastSearchIndex = -1;
    for (let i = messagesForContext.length - 1; i >= 0; i -= 1) {
      const m = messagesForContext[i];
      if (m.type === "search" && m.data) {
        lastSearchIndex = i;
        break;
      }
    }

    let lastSearchData: DynamicSearchResult["data"] | null = null;
    if (lastSearchIndex >= 0) {
      const turnsSinceSearch = messagesForContext.length - lastSearchIndex - 1;
      if (turnsSinceSearch <= maxWindowMessages) {
        const msg = messagesForContext[lastSearchIndex];
        if (msg.type === "search" && msg.data) {
          lastSearchData = msg.data;
        }
      }
    }

    let structuredConversationContext: string | null = null;
    try {
      const conv = {
        kind: "conversation_context",
        window_size: maxWindowMessages,
        turns: recentMessages.map((m) => {
          const base = {
            role: m.role,
            type: m.type ?? "text",
            text: (m.content || "").toString().slice(0, 500),
          };
          if (m.type === "search" && m.data) {
            return {
              ...base,
              search: {
                searchQuery: m.data.searchQuery,
                overallSummary: m.data.overallSummaryLines?.slice(0, 3) ?? [],
              },
            };
          }
          return base;
        }),
        latest_search: lastSearchData
          ? {
              searchQuery: lastSearchData.searchQuery,
              overallSummary: lastSearchData.overallSummaryLines?.slice(0, 3) ?? [],
              webItems: lastSearchData.webItems
                .slice(0, 5)
                .map((it) => ({
                  link: it.link,
                  title: it.title,
                  summaryLines: it.summaryLines.slice(0, 3),
                })),
              youtubeItems: (lastSearchData.youtubeItems ?? [])
                .slice(0, 5)
                .map((yt) => ({
                  id: yt.id,
                  title: yt.title,
                  channelTitle: yt.channelTitle,
                  url: `https://www.youtube.com/watch?v=${yt.id}`,
                })),
            }
          : null,
        memory: {
          summaries: conversationMemory.slice(-10),
        },
      };
      structuredConversationContext = JSON.stringify(conv);
    } catch {
      structuredConversationContext = null;
    }

    let structuredContext: string | null = null;
    if (askCtx) {
      const lastUser = [...messages]
        .slice()
        .reverse()
        .find((m) => m.role === "user");
      const lastAssistant = [...messages]
        .slice()
        .reverse()
        .find((m) => m.role === "assistant");
      const structured = {
        kind: "ask_cloudy_context",
        selected: {
          text: askCtx.selectedText,
          source: askCtx.source,
          link: askCtx.link ?? null,
          title: askCtx.title ?? null,
          search_query: askCtx.searchQuery ?? null,
          message_role: askCtx.messageRole ?? null,
          message_id: askCtx.messageId ?? null,
        },
        last_turn: {
          user: lastUser
            ? {
                role: lastUser.role,
                text: lastUser.content,
                type: lastUser.type ?? "text",
              }
            : null,
          assistant: lastAssistant
            ? {
                role: lastAssistant.role,
                text:
                  lastAssistant.type === "search" && lastAssistant.data
                    ? lastAssistant.data.overallSummaryLines
                        ?.filter(Boolean)
                        .join(" ")
                    : lastAssistant.content,
                type: lastAssistant.type ?? "text",
                search:
                  lastAssistant.type === "search" && lastAssistant.data
                    ? {
                        searchQuery: lastAssistant.data.searchQuery,
                        topWebResult:
                          lastAssistant.data.webItems &&
                          lastAssistant.data.webItems.length > 0
                            ? lastAssistant.data.webItems[0]
                            : null,
                        mapLocation: lastAssistant.data.mapLocation ?? null,
                      }
                    : null,
              }
            : null,
        },
        pinned_items: pinnedItems.slice(-10).map((p) => ({
          kind: p.kind,
          title: p.title,
          link: p.link ?? null,
          summary: (p.summary || "").slice(0, 500),
        })),
      };
      try {
        structuredContext = JSON.stringify(structured);
      } catch {
        structuredContext = null;
      }
    }

    void unlockAudio();
    const baseId = Date.now();
    setChatInputValue("");
    setIsChatLoading(true);
    setChatLoadingQuery(trimmed);
    setActiveInputSource(source);

    setMessages((prev) => [
      ...prev,
      {
        id: baseId,
        role: "user",
        content: trimmed,
        isVoice,
        askCloudy: askCtx ?? null,
      },
    ]);

    try {
      if (userId && activeSessionId && recentMessages.length === maxWindowMessages) {
        const memoryTurns: MemoryWindowTurn[] = recentMessages.map((m) => {
          const base = {
            role: m.role,
            type: (m.type ?? "text") as "text" | "search",
            text: (m.content || "").toString().slice(0, 500),
          };
          if (m.type === "search" && m.data) {
            return {
              ...base,
              search: {
                searchQuery: m.data.searchQuery,
                overallSummary: m.data.overallSummaryLines?.slice(0, 3) ?? [],
              },
            };
          }
          return base;
        });
        const nextWindowKey = JSON.stringify(
          memoryTurns.map((t) => ({
            role: t.role,
            type: t.type,
            text: t.text,
            searchQuery: t.search?.searchQuery ?? "",
          }))
        );
        if (nextWindowKey && nextWindowKey !== memoryWindowKey) {
          void (async () => {
            const result = await extractMemoryFromWindow({
              windowKey: nextWindowKey,
              turns: memoryTurns,
              userId,
              sessionId: activeSessionId,
            });
            if (result.windowKey) {
              setMemoryWindowKey(result.windowKey);
            }
            const summary = result.conversationSummary ?? "";
            if (summary) {
              setConversationMemory((prev) => {
                const next = [...prev, summary];
                return Array.from(new Set(next)).slice(-20);
              });
            }
          })();
        }
      }
      let baseContext: string[] = [];
      if (structuredContext) {
        baseContext = [`AskCloudyContext: ${structuredContext}`];
        if (structuredConversationContext) {
          baseContext.push(`ConversationContext: ${structuredConversationContext}`);
        }
      } else {
        baseContext = [...historyContext, ...pinnedContext];
        if (structuredConversationContext) {
          baseContext.push(`ConversationContext: ${structuredConversationContext}`);
        }
      }
      const result = await performDynamicSearch(trimmed, {
        context: [...baseContext, `User: ${trimmed.slice(0, 500)}`],
        userId: userId ?? undefined,
        sessionId: activeSessionId ?? undefined,
      });
      
      if (result.type === "search" && result.data) {
        if (result.data.youtubeItems && result.data.youtubeItems.length > 0) {
          pendingSpeakShouldSpeakRef.current = isVoice;
          pendingSpeakTextRef.current = `Here are your vids on ${result.data.searchQuery || trimmed}`;
        } else {
          pendingSpeakShouldSpeakRef.current = isVoice;
          pendingSpeakTextRef.current = result.data.overallSummaryLines.filter(Boolean).join(" ");
        }

        setMessages((prev) => [
          ...prev,
          {
            id: baseId + 1,
            role: "assistant",
            content: "", // Content is empty for search blocks
            type: "search",
            data: result.data,
            mem0Ops: result.mem0Ops,
          },
        ]);
      } else {
        // Handle text response
        const text = result.content || "I'm not sure how to respond to that.";
        pendingSpeakShouldSpeakRef.current = isVoice;
        pendingSpeakTextRef.current = text;
        setMessages((prev) => [
          ...prev,
          {
            id: baseId + 1,
            role: "assistant",
            content: text,
            type: "text",
            mem0Ops: result.mem0Ops,
          },
        ]);
      }
    } catch (err) {
      pendingSpeakShouldSpeakRef.current = isVoice;
      pendingSpeakTextRef.current = "There was an error processing your request. Please try again.";
      setMessages((prev) => [
        ...prev,
        {
          id: baseId + 1,
          role: "assistant",
          content: "There was an error processing your request. Please try again.",
        },
      ]);
    } finally {
      setIsChatLoading(false);
      setActiveInputSource(null);
    }
  };

  useEffect(() => {
    const text = (pendingSpeakTextRef.current || "").trim();
    if (!text) return;
    const shouldSpeak = pendingSpeakShouldSpeakRef.current;
    pendingSpeakTextRef.current = null;
    pendingSpeakShouldSpeakRef.current = false;
    if (!shouldSpeak) return;
    let raf1 = 0;
    let raf2 = 0;
    raf1 = window.requestAnimationFrame(() => {
      raf2 = window.requestAnimationFrame(() => {
        void speakWithCartesia(text);
      });
    });
    return () => {
      if (raf1) window.cancelAnimationFrame(raf1);
      if (raf2) window.cancelAnimationFrame(raf2);
    };
  }, [messages, searchQuery, speakWithCartesia]);

  const showVoiceOverlay = isSpeechProcessing || activeInputSource === "voice";
  const pinnedIds = pinnedItems.map((p) => p.id);

  const handleAskCloudyClick = () => {
    if (!askCloudySelection) return;
    setAskCloudyContext({
      ...askCloudySelection.meta,
      selectedText: askCloudySelection.text,
    });
    setAskCloudySelection(null);
    if (typeof window !== "undefined") {
      const sel = window.getSelection();
      sel?.removeAllRanges();
    }
  };

  return (
    <div
      ref={rootRef}
      className="flex flex-row flex-1 w-full min-h-0 relative bg-background overflow-hidden"
    >
      {askCloudySelection && (
        <button
          type="button"
          className="fixed z-[80] -translate-x-1/2 rounded-full bg-black text-white dark:bg-white dark:text-black px-3 py-1 text-xs shadow-md flex items-center gap-1 hover:bg-zinc-800 dark:hover:bg-zinc-200 transition-colors"
          style={{ top: askCloudySelection.top, left: askCloudySelection.left }}
          onClick={handleAskCloudyClick}
        >
          <Quote className="w-3 h-3" />
          <span>Ask Cloudy</span>
        </button>
      )}
      {(isChatLoading || isSpeechProcessing) && (
        <div className="absolute inset-0 z-[70] bg-white/90 dark:bg-black/80 backdrop-blur-sm">
          {showVoiceOverlay ? (
            <div className="h-full w-full flex flex-col">
              <div className="px-6 pt-10">
                <div className="flex items-center gap-3 text-blue-600 dark:text-blue-400">
                  <Mic className="w-5 h-5" />
                  <div className="text-lg font-semibold truncate">{isSpeechProcessing ? "Transcribing…" : "Thinking…"}</div>
                </div>
              </div>
              <div className="px-6 pt-10 space-y-6 flex-1">
                <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400 font-semibold">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <div>{isSpeechProcessing ? "Transcribing…" : "Thinking…"}</div>
                </div>
              </div>
            </div>
          ) : (
            <div className="h-full w-full flex flex-col">
              <div className="px-6 pt-10">
                <div className="flex items-center gap-3 text-blue-600 dark:text-blue-400">
                  <Search className="w-5 h-5" />
                  <div className="text-lg font-semibold truncate">{isChatLoading ? chatLoadingQuery : "Transcribing…"}</div>
                </div>
              </div>
              <div className="px-6 pt-10 space-y-6 flex-1">
                <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400 font-semibold">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <div>{isChatLoading ? "Thinking…" : "Transcribing…"}</div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
      {showBootOverlay && (
        <div className="absolute inset-0 z-[60] bg-white/90 dark:bg-black/80 backdrop-blur-sm">
          <div className="h-full w-full flex flex-col">
            <div className="px-6 pt-10">
              <div className="flex items-center gap-3 text-blue-600 dark:text-blue-400">
                {voiceParam ? <Mic className="w-5 h-5" /> : <Search className="w-5 h-5" />}
                <div className="text-lg font-semibold truncate">{searchQuery}</div>
              </div>
            </div>

            <div className="px-6 pt-10 space-y-6 flex-1">
              <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400 font-semibold">
                <Loader2 className="w-4 h-4 animate-spin" />
                <div>
                  Reading {sources.length || 6} web pages
                </div>
              </div>
              <div className="space-y-1 text-blue-600/90 dark:text-blue-300/90">
                {(sources.length ? sources : Array.from({ length: 6 }).map((_, i) => `source-${i + 1}.com`)).map((s) => (
                  <div key={s} className="text-sm truncate">{s}</div>
                ))}
              </div>

              <div className="pt-6 space-y-2 text-neutral-800 dark:text-neutral-100">
                <div className="flex items-center gap-2 text-sm">
                  <CheckCircle2 className={cn("w-4 h-4", bootStatus.webDone ? "text-emerald-500" : "text-neutral-400")} />
                  <div className={cn(bootStatus.webDone ? "opacity-100" : "opacity-70")}>Step 1: Fetching results</div>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <CheckCircle2 className={cn("w-4 h-4", bootStatus.mediaDone ? "text-emerald-500" : "text-neutral-400")} />
                  <div className={cn(bootStatus.mediaDone ? "opacity-100" : "opacity-70")}>Step 2: Fetching media</div>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <CheckCircle2 className={cn("w-4 h-4", bootStatus.webDone && bootStatus.mediaDone ? "text-emerald-500" : "text-neutral-400")} />
                  <div className={cn(bootStatus.webDone && bootStatus.mediaDone ? "opacity-100" : "opacity-70")}>Step 3: Finalizing</div>
                </div>
              </div>
            </div>

            <div className="px-6 pb-10">
              <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400 font-semibold">
                <Globe className="w-5 h-5" />
                <div>Making a website for you!</div>
              </div>
            </div>
          </div>
        </div>
      )}
      <div className={cn(
        "flex flex-col h-full transition-all duration-300 ease-in-out relative",
        browserTabs.length > 0 ? "w-1/3 min-w-[350px] border-r" : "w-full"
      )}>
        <div className="flex-1 w-full min-h-0 relative">
          <Conversation className="w-full h-full overflow-y-auto">
            <ConversationContent className="max-w-5xl mx-auto px-4 pt-6 pb-32">
              <Message from="user" className="ml-auto">
                <div className="flex items-start gap-3 w-full flex-row-reverse">
                  {user?.imageUrl ? (
                    <Image
                      src={user.imageUrl}
                      alt={user.fullName || "User"}
                      width={32}
                      height={32}
                      className="h-8 w-8 rounded-full mt-1 shrink-0"
                    />
                  ) : (
                    <div className="h-8 w-8 rounded-full bg-secondary mt-1 shrink-0" />
                  )}
                  <MessageContent
                    data-cloudy-kind="conversation"
                    data-cloudy-role="user"
                    data-cloudy-message-id="initial-search"
                  >
                    <span className="inline-flex items-center gap-2">
                      {voiceParam && <Mic className="w-4 h-4" />}
                      <span>{searchQuery}</span>
                    </span>
                  </MessageContent>
                </div>
              </Message>

              <Message from="assistant" className="mr-auto">
                <div className="flex items-start gap-3 w-full flex-row">
                  <div className="shrink-0">
                    <AtomLogo size={28} className="text-foreground" />
                  </div>
                  <div className="w-full pt-1">
                  {overallSummaryLines.length > 0 && !shouldShowTabs && (
                    <div className="mb-4">
                      <MessageContent className="mt-1">
                        {overallSummaryLines.filter(Boolean).join(" ")}
                      </MessageContent>
                    </div>
                  )}

                  {mapLocation && (
                     <div className="mb-6">
                        <MessageContent className="mb-2">
                           I found {mapLocation} on the map. You can view it in the side panel.
                        </MessageContent>
                        <MapBlock 
                           location={mapLocation} 
                           onOpenSideMap={() => handleLinkClick(`/home/map-view?location=${encodeURIComponent(mapLocation)}`, `Map: ${mapLocation}`)} 
                        />
                     </div>
                  )}

                  {shouldShowTabs && !youtubeItems?.length && (
                    <div className="flex gap-2 mb-8">
                      <button
                        type="button"
                        onClick={() => handlePrimaryTabChange("results")}
                        className={cn(
                          "px-3 py-1 text-sm font-medium rounded-md transition-colors",
                          primaryTab === "results"
                            ? "bg-black text-white dark:bg-white dark:text-black"
                            : "bg-accent text-muted-foreground hover:bg-accent/80"
                        )}
                      >
                        Results
                      </button>
                      <button
                        type="button"
                        onClick={() => handlePrimaryTabChange("media")}
                        className={cn(
                          "px-3 py-1 text-sm font-medium rounded-md transition-colors",
                          primaryTab === "media"
                            ? "bg-black text-white dark:bg-white dark:text-black"
                            : "bg-accent text-muted-foreground hover:bg-accent/80"
                        )}
                      >
                        Media
                      </button>
                    </div>
                  )}

                  {youtubeItems && youtubeItems.length > 0 ? (
                    <div className="mb-8">
                      <VideoList
                        videos={youtubeItems}
                        onLinkClick={handleLinkClick}
                        onPinItem={handleTogglePinItem}
                        pinnedIds={pinnedIds}
                      />
                    </div>
                  ) : shouldShowTabs && (
                    isWeatherQuery ? (
                      <>
                        <div className="text-sm font-medium mb-2">Weather</div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
                          {(weatherItems || []).map((w, i) => (
                            <div key={i} className="flex justify-center">
                              <WeatherWidget
                                width="18rem"
                                className="w-[18rem]"
                                location={
                                  w.latitude && w.longitude
                                    ? { latitude: w.latitude, longitude: w.longitude }
                                    : undefined
                                }
                                onFetchWeather={async () => {
                                  if (w.data) return w.data;
                                  throw new Error(w.error || "Weather unavailable");
                                }}
                                onError={() => {}}
                                onWeatherLoaded={() => {}}
                              />
                            </div>
                          ))}
                        </div>
                      </>
                    ) : (
                      <>
                        <div className={cn(primaryTab === "results" ? "block" : "hidden")}>
                          {overallSummaryLines.length > 0 && (
                            <div className="mb-6">
                              <MessageContent className="mt-1">
                                {overallSummaryLines.filter(Boolean).join(" ")}
                              </MessageContent>
                            </div>
                          )}
                          <div className="text-sm font-medium mb-3">Search results</div>
                          {webItems.length ? (
                            <div className="grid grid-cols-1 gap-3 mb-8">
                              {webItems.map((item, i) => (
                                <SearchResultItem
                                  key={i}
                                  link={item.link}
                                  title={item.title}
                                  description={item.summaryLines[0]}
                                  imageUrl={item.imageUrl}
                                  onClick={() => handleLinkClick(item.link, item.title)}
                                />
                              ))}
                            </div>
                          ) : (
                            <>
                              {Array.from({ length: 10 }).map((_, i) => (
                                <div key={i} className="space-y-2 mb-8">
                                  <div className="bg-accent w-full rounded-md border px-3 py-2 text-sm">
                                    <div className="h-4 w-full" />
                                  </div>
                                  <div className="bg-accent w-full rounded-md border px-3 py-2 text-sm text-muted-foreground" />
                                  <div className="bg-accent w-full rounded-md border px-3 py-2 text-sm text-muted-foreground" />
                                </div>
                              ))}
                            </>
                          )}
                        </div>

                        <div className={cn(primaryTab === "media" ? "block" : "hidden")}>
                          {mediaItems.length ? (
                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-8">
                              {mediaItems.map((item, i) => {
                                const src = normalizeExternalUrl(item.src);
                                if (!src) return null;
                                return (
                                  <div
                                    key={i}
                                    className="aspect-square bg-accent rounded-md border overflow-hidden flex items-center justify-center"
                                  >
                                    <Image
                                      src={src}
                                      alt={item.alt ?? ""}
                                      width={600}
                                      height={600}
                                      unoptimized
                                      loading={i < 6 ? "eager" : "lazy"}
                                      referrerPolicy="no-referrer"
                                      className="w-full h-full object-cover"
                                    />
                                  </div>
                                );
                              })}
                            </div>
                          ) : (
                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-8">
                              {Array.from({ length: 12 }).map((_, i) => (
                                <div
                                  key={i}
                                  className="aspect-square bg-accent rounded-md border overflow-hidden flex items-center justify-center"
                                >
                                  <div className="w-3/4 h-3/4 bg-muted rounded-md" />
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </>
                    )
                  )}

                  {!shouldShowTabs && (
                    <>
                      {webItems.length ? (
                        <>
                          <div className="text-sm font-medium mb-2">Search results</div>
                          {webItems.map((item, i) => (
                            <div key={i} className="space-y-2 mb-8">
                              <div className="bg-accent w-full rounded-md border px-3 py-2 text-sm">
                                <a
                                  href={item.link}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-blue-600 hover:underline truncate block"
                                  title={item.title}
                                  onClick={(e) => {
                                    e.preventDefault();
                                    handleLinkClick(item.link, item.title);
                                  }}
                                >
                                  {item.title}
                                </a>
                              </div>
                              <div className="bg-accent w-full rounded-md border px-3 py-2 text-sm text-muted-foreground">
                                {item.summaryLines[0]}
                              </div>
                              <div className="bg-accent w-full rounded-md border px-3 py-2 text-sm text-muted-foreground">
                                {item.summaryLines[1]}
                              </div>
                            </div>
                          ))}
                        </>
                      ) : null}
                    </>
                  )}
                </div>
                </div>
              </Message>

              {messages.length > 0 && (
                <div className="mt-6 space-y-4">
                  {messages.map((msg) => (
                    <Message
                      key={msg.id}
                      from={msg.role}
                      className={cn(msg.role === "user" ? "ml-auto" : "mr-auto")}
                    >
                      {msg.type === "search" && msg.data ? (
                        <div className="flex items-start gap-3 w-full flex-row">
                          <div className="shrink-0">
                            <AtomLogo size={28} className="text-foreground" />
                          </div>
                          <div className="w-full pt-1">
                            {msg.data.mapLocation && (
                                <div className="mb-6">
                                    <MessageContent className="mb-2">
                                        I found {msg.data.mapLocation} on the map. You can view it in the side panel.
                                    </MessageContent>
                                    <MapBlock 
                                        location={msg.data.mapLocation} 
                                        onOpenSideMap={() => {
                                          const loc = msg.data?.mapLocation;
                                          if (!loc) return;
                                          handleLinkClick(
                                            `/home/map-view?location=${encodeURIComponent(loc)}`,
                                            `Map: ${loc}`
                                          );
                                        }} 
                                    />
                                </div>
                            )}
                          <SearchResultsBlock
                            searchQuery={msg.data.searchQuery}
                            overallSummaryLines={msg.data.overallSummaryLines}
                            webItems={msg.data.webItems}
                            mediaItems={msg.data.mediaItems}
                              weatherItems={msg.data.weatherItems}
                              youtubeItems={msg.data.youtubeItems}
                              shouldShowTabs={msg.data.shouldShowTabs}
                              onLinkClick={handleLinkClick}
                              onPinItem={handleTogglePinItem}
                            pinnedIds={pinnedIds}
                          />
                        </div>
                      </div>
                    ) : (
                      <>
                        {msg.role === "assistant" ? (
                          <div className="flex items-start gap-3 w-full flex-row">
                            <div className="shrink-0">
                              <AtomLogo size={28} className="text-foreground" />
                            </div>
                            <div className="w-full pt-1">
                              <MessageContent
                                className="mt-1"
                                data-cloudy-kind="conversation"
                                data-cloudy-role={msg.role}
                                data-cloudy-message-id={String(msg.id)}
                              >
                                {msg.content}
                              </MessageContent>
                            </div>
                          </div>
                        ) : (
                          <div className="flex items-start gap-3 w-full flex-row-reverse">
                            {user?.imageUrl ? (
                              <Image
                                src={user.imageUrl}
                                alt={user.fullName || "User"}
                                width={32}
                                height={32}
                                className="h-8 w-8 rounded-full mt-1 shrink-0"
                              />
                            ) : (
                              <div className="h-8 w-8 rounded-full bg-secondary mt-1 shrink-0" />
                            )}
                            <div className="w-full max-w-xl flex flex-col items-end gap-1">
                              {msg.askCloudy?.selectedText && (
                                <div className="max-w-full">
                                  <div className="inline-flex items-center gap-2 rounded-full bg-muted px-3 py-1 text-xs text-muted-foreground">
                                    <span>↩</span>
                                    <span className="truncate max-w-[220px]">
                                      {msg.askCloudy.selectedText}
                                    </span>
                                  </div>
                                </div>
                              )}
                              <MessageContent
                                data-cloudy-kind="conversation"
                                data-cloudy-role={msg.role}
                                data-cloudy-message-id={String(msg.id)}
                              >
                                {msg.content}
                              </MessageContent>
                            </div>
                          </div>
                        )}
                      </>
                    )}
                  </Message>
                ))}
              </div>
              )}
            </ConversationContent>
            <ConversationScrollButton />
          </Conversation>
        </div>
        <AIInputFooter
          onSubmit={handleChatSubmit}
          inputValue={chatInputValue}
          onInputChange={setChatInputValue}
          onSpeechProcessingChange={setIsSpeechProcessing}
          askCloudyOverlayText={askCloudyContext?.selectedText ?? null}
          onClearAskCloudyOverlay={() => setAskCloudyContext(null)}
        />
      </div>

      {/* Browser Panel */}
      {browserTabs.length > 0 && (
        <div className="flex-1 w-full h-full min-w-0 animate-in slide-in-from-right duration-300">
          <Browser
            tabs={browserTabs}
            activeTabId={activeTabId}
            onCloseTab={handleCloseTab}
            onSwitchTab={setActiveTabId}
            onClose={handleCloseBrowser}
            onAddToChat={handleAddToChat}
          />
        </div>
      )}
    </div>
  );
}

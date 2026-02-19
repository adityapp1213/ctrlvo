import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { AppSidebar } from "@/components/ui/sidebar";
import { Header } from "@/components/ui/header-1";
import { detectIntent } from "@/app/lib/ai/genai";
import { webSearch, imageSearch, summarizeItems, summarizeChatAnswerFromWebItems } from "@/app/lib/ai/search";
import { youtubeSearch, YouTubeVideo } from "@/app/lib/ai/youtube";
import { cookies, headers } from "next/headers";
import { logUserRequest } from "@/lib/supabase-server";
import { SearchConversationShell } from "./ai-input-footer";
import { fetchWeatherForCity } from "@/app/lib/weather";
import { shoppingSearch, type ShoppingProduct } from "@/app/lib/serpapi/shopping";

type WeatherType = "clear" | "clouds" | "rain" | "snow" | "thunderstorm" | "mist" | "unknown";
type WeatherData = {
  city: string;
  temperature: number;
  weatherType: WeatherType;
  dateTime: string;
  isDay: boolean;
};
type WeatherItem = {
  city: string;
  latitude?: number;
  longitude?: number;
  data?: WeatherData | null;
  error?: string | null;
};

function mapWeatherType(condition: string): WeatherType {
  const main = (condition || "").toLowerCase();
  if (main.includes("clear")) return "clear";
  if (main.includes("cloud")) return "clouds";
  if (main.includes("rain") || main.includes("drizzle")) return "rain";
  if (main.includes("snow")) return "snow";
  if (main.includes("thunder")) return "thunderstorm";
  if (main.includes("mist") || main.includes("fog") || main.includes("haze")) return "mist";
  return "unknown";
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
    // fall back to entire query as single location token if it looks like a place name (no digits)
    if (!/\d/.test(trimmed)) parts.push(trimmed);
  }
  // normalize duplicates
  return Array.from(new Set(parts)).slice(0, 4);
}

function extractShoppingQuery(q: string): string | null {
  const trimmed = (q || "").trim();
  if (!trimmed) return null;
  if (trimmed.startsWith("Shopping ")) {
    const rest = trimmed.slice(9).trim();
    return rest || null;
  }
  const patterns = [/^shop for\s+(.+)/i, /^shopping for\s+(.+)/i, /^buy\s+(.+)/i, /^purchase\s+(.+)/i];
  for (const pattern of patterns) {
    const match = trimmed.match(pattern);
    if (match && match[1]) {
      const candidate = match[1].trim();
      if (candidate) return candidate;
    }
  }
  return null;
}

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; tab?: string; chatId?: string }>;
}) {
  const { userId } = await auth();
  if (!userId) redirect("/");
  
  const resolvedSearchParams = await searchParams;
  const q = (resolvedSearchParams?.q ?? "").toString();
  const tab = (resolvedSearchParams?.tab ?? "chat").toString();
  const chatId = resolvedSearchParams?.chatId?.toString();
  const jar = await cookies();
  const aiProvider = jar.get("ai_provider")?.value === "gemini" ? "gemini" : "groq";
  const hasQuery = q.trim().length > 0;
  let shouldShowTabs = false;
  let searchQuery = q;

  let overallSummaryLines: string[] = [];
  let summary: string | null = null;
  let webItems: { link: string; title: string; summaryLines: string[]; imageUrl?: string }[] = [];
  let mediaItems: { src: string; alt?: string }[] = [];
  let isWeatherQuery = false;
  let weatherItems: WeatherItem[] = [];
  let youtubeItems: YouTubeVideo[] = [];
  let mapLocation: string | undefined;
  let webSearchQuery: string | null = null;
  let shoppingItems: ShoppingProduct[] = [];

  if (hasQuery) {
    const rawCtx = jar.get("ai_ctx")?.value ?? "[]";
    let ctx: string[] = [];
    try {
      const parsed = JSON.parse(rawCtx);
      if (Array.isArray(parsed)) ctx = parsed.map((x) => String(x)).filter(Boolean);
    } catch {
      ctx = [];
    }
    const shoppingQuery = extractShoppingQuery(q);
    const detectQuery = shoppingQuery || q;
    const result = await detectIntent(detectQuery, ctx, aiProvider);
    shouldShowTabs = result.shouldShowTabs || Boolean(shoppingQuery);
    webSearchQuery = shoppingQuery ? null : result.webSearchQuery ?? null;
    searchQuery = shoppingQuery || result.searchQuery || detectQuery;
    overallSummaryLines = result.overallSummaryLines;
    mapLocation = result.mapLocation;
    const lower = (webSearchQuery ?? "").toLowerCase();
    isWeatherQuery =
      Boolean(webSearchQuery) &&
      /(weather|forecast|temperature|rain|snow|thunder|wind|humidity)\b/.test(lower);
    
    // Check for YouTube intent
    if (result.youtubeQuery) {
       youtubeItems = await youtubeSearch(result.youtubeQuery);
    }

    if (shoppingQuery) {
      shoppingItems = await shoppingSearch(shoppingQuery, { maxResults: 4 });
    }

    const nextCtx = [...ctx, detectQuery].slice(-5);
    try {
      jar.set("ai_ctx", JSON.stringify(nextCtx), { path: "/", httpOnly: true });
    } catch {}
  }

  // Determine active tab - prioritize videos if we have youtube items and no explicit tab
  const activeTab = resolvedSearchParams?.tab ? tab : (mapLocation ? "map" : (youtubeItems.length > 0 ? "videos" : tab));

  const shouldPrefetchTabs =
    hasQuery &&
    shouldShowTabs &&
    !isWeatherQuery &&
    youtubeItems.length === 0 &&
    Boolean(webSearchQuery);

  const webQuery = webSearchQuery ?? null;

  if (shouldPrefetchTabs && webQuery) {
    const [rawItems, images] = await Promise.all([
      webSearch(webQuery),
      imageSearch(webQuery),
    ]);

    mediaItems = images;

    if (rawItems.length > 0) {
      const s = await summarizeItems(rawItems, webQuery, aiProvider);
      overallSummaryLines = s.overallSummaryLines.length
        ? s.overallSummaryLines
        : overallSummaryLines;
      webItems = rawItems.map((it, idx) => {
        const found = s.summaries.find((x) => x.index === idx);
        const lines =
          Array.isArray(found?.summary_lines) && found.summary_lines.length
            ? found.summary_lines.slice(0, 3)
            : [it.snippet || ""].filter(Boolean).slice(0, 1);
        const normalized = [lines[0] ?? "", lines[1] ?? "", lines[2] ?? ""];
        return {
          link: it.link,
          title: it.title,
          summaryLines: normalized,
          imageUrl: it.imageUrl,
        };
      });
      summary = await summarizeChatAnswerFromWebItems(webItems, webQuery, aiProvider);
    } else if (!overallSummaryLines.length) {
      overallSummaryLines = ["No results found.", ""];
    }
  } else if (hasQuery && shouldShowTabs && webQuery) {
    if (activeTab === "results") {
      const rawItems = await webSearch(webQuery);
      if (rawItems.length > 0) {
        const s = await summarizeItems(rawItems, webQuery, aiProvider);
        overallSummaryLines = s.overallSummaryLines.length
          ? s.overallSummaryLines
          : overallSummaryLines;
        webItems = rawItems.map((it, idx) => {
          const found = s.summaries.find((x) => x.index === idx);
          const lines =
            Array.isArray(found?.summary_lines) && found.summary_lines.length
              ? found.summary_lines.slice(0, 3)
              : [it.snippet || ""].filter(Boolean).slice(0, 1);
          const normalized = [lines[0] ?? "", lines[1] ?? "", lines[2] ?? ""];
          return {
            link: it.link,
            title: it.title,
            summaryLines: normalized,
            imageUrl: it.imageUrl,
          };
        });
        summary = await summarizeChatAnswerFromWebItems(webItems, webQuery, aiProvider);
      } else if (!overallSummaryLines.length) {
        overallSummaryLines = ["No results found.", ""];
      }
    } else if (tab === "media") {
      mediaItems = await imageSearch(webQuery);
      if (!mediaItems.length && !overallSummaryLines.length) {
        overallSummaryLines = ["No images found.", ""];
      }
    }
  }

  if (hasQuery && isWeatherQuery && shouldShowTabs && webQuery) {
    const locs = extractLocationsFromQuery(searchQuery);
    if (locs.length) {
      const results = await Promise.all(locs.map((city) => fetchWeatherForCity(city)));
      weatherItems = results;
    } else {
      // If no explicit locations, try single weather for the query itself
      const single = await fetchWeatherForCity(searchQuery);
      weatherItems = [single];
    }
  }

  // Handle Videos tab fetching if we are on videos tab (though we already fetched if intent was youtube)
  // But user might switch to videos tab manually even if intent wasn't youtube initially?
  // Currently youtubeItems are only fetched if intent is youtube.
  // If user clicks "Videos" tab, page reloads with tab=videos.
  // We should fetch youtube items if tab is videos, even if intent didn't say so?
  // Or just rely on youtube intent?
  // Let's rely on intent or if tab is explicitly videos.
  
  if (hasQuery && activeTab === "videos" && shouldShowTabs && youtubeItems.length === 0) {
     youtubeItems = await youtubeSearch(searchQuery);
  }

  if (hasQuery) {
    try {
      const hdrs = await headers();
      const ip = hdrs.get("x-forwarded-for") || hdrs.get("x-real-ip") || null;
      const ua = hdrs.get("user-agent") || null;
      await logUserRequest({
        requestType: "search",
        parameters: { q, tab, searchQuery, shouldShowTabs },
        responseStatus: 200,
        responseData: {
          hasQuery,
          hasWebItems: webItems.length > 0,
          hasMediaItems: mediaItems.length > 0,
          hasYoutubeItems: youtubeItems.length > 0,
          overallSummaryLines,
        },
        ipAddress: ip,
        userAgent: ua,
      });
    } catch {}
  }

  return (
    <main className="h-screen w-full bg-white flex overflow-hidden">
      {/* Desktop: persistent left sidebar */}
      <div className="hidden lg:block h-full shrink-0">
        <AppSidebar />
      </div>

      {/* Mobile / small screens: sidebar in sticky top bar */}
      <div className="flex-1 flex flex-col h-full overflow-hidden">
        <div className="lg:hidden sticky top-0 z-40">
          <AppSidebar />
        </div>

        <section className="flex-1 flex flex-col h-full min-w-0">
          <div className="w-full">
            <Header />
          </div>
          <div className="flex-1 min-h-0">
            <SearchConversationShell
              tab={activeTab}
              searchQuery={searchQuery}
              shouldShowTabs={shouldShowTabs}
              overallSummaryLines={overallSummaryLines}
              summary={summary}
              webItems={webItems}
              mediaItems={mediaItems}
              isWeatherQuery={isWeatherQuery}
              weatherItems={weatherItems}
              youtubeItems={youtubeItems}
              mapLocation={mapLocation}
              googleMapsKey={process.env.GOOGLE_MAP_API_KEY}
              shoppingItems={shoppingItems}
            />
          </div>
        </section>
      </div>
    </main>
  );
}

// Renders AI search results with tabs for results, media, and videos
"use client";

import { useState } from "react";
import Image from "next/image";
import { cn } from "@/lib/utils";
import { WeatherWidget } from "@/components/ui/weather-widget";
import { WeatherItem } from "@/app/lib/weather";
import { VideoList } from "@/components/video-list";
import type { PinnedItem } from "@/app/lib/chat-store";

// Normalizes and validates external URLs used for media thumbnails
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

// Define locally to avoid server-client import issues if any
type YouTubeVideo = {
  id: string;
  title: string;
  description: string;
  thumbnail: string;
  channelTitle: string;
  publishedAt: string;
};

type SearchResultsBlockProps = {
  searchQuery: string;
  overallSummaryLines: string[];
  webItems: { link: string; title: string; summaryLines: string[]; imageUrl?: string }[];
  mediaItems: { src: string; alt?: string }[];
  weatherItems?: WeatherItem[];
  youtubeItems?: YouTubeVideo[];
  shouldShowTabs: boolean;
  onLinkClick?: (url: string, title: string) => void;
  onPinItem?: (item: PinnedItem) => void;
  pinnedIds?: string[];
};

export function SearchResultsBlock({
  searchQuery,
  overallSummaryLines,
  webItems,
  mediaItems,
  weatherItems,
  youtubeItems,
  shouldShowTabs,
  onLinkClick,
  onPinItem,
  pinnedIds,
}: SearchResultsBlockProps) {
  const isVideoMode = youtubeItems && youtubeItems.length > 0;
  const [tab, setTab] = useState(
    isVideoMode ? "videos" : "results"
  );

  return (
    <div className="w-full bg-background rounded-lg border p-4 space-y-4">
      {/* Summary */}
      {overallSummaryLines.length > 0 && (
        <div className="bg-accent rounded-md border px-3 py-2 text-sm">
          {overallSummaryLines.filter(Boolean).join(" ")}
        </div>
      )}

      {shouldShowTabs && !isVideoMode && (
        <div className="flex gap-2">
          <button
            onClick={() => setTab("results")}
            className={cn(
              "px-3 py-1 text-sm font-medium rounded-md transition-colors",
              tab === "results"
                ? "bg-black text-white dark:bg-white dark:text-black"
                : "bg-accent text-muted-foreground hover:bg-accent/80"
            )}
          >
            Results
          </button>
          <button
            onClick={() => setTab("media")}
            className={cn(
              "px-3 py-1 text-sm font-medium rounded-md transition-colors",
              tab === "media"
                ? "bg-black text-white dark:bg-white dark:text-black"
                : "bg-accent text-muted-foreground hover:bg-accent/80"
            )}
          >
            Media
          </button>
        </div>
      )}

      {isVideoMode ? (
        <VideoList
          videos={youtubeItems}
          onLinkClick={onLinkClick}
          onPinItem={onPinItem}
          pinnedIds={pinnedIds}
        />
      ) : shouldShowTabs && tab === "media" ? (
        mediaItems.length ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            {mediaItems.map((item, i) => {
              const src = normalizeExternalUrl(item.src);
              if (!src) return null;
              return (
                <div
                  key={i}
                  className="aspect-square bg-accent rounded-md border overflow-hidden flex items-center justify-center relative"
                >
                  <Image
                    src={src}
                    alt={item.alt ?? ""}
                    fill
                    className="object-cover"
                    loading={i < 6 ? "eager" : "lazy"}
                    unoptimized
                    referrerPolicy="no-referrer"
                  />
                </div>
              );
            })}
          </div>
        ) : (
          <div className="text-sm text-muted-foreground">No images found.</div>
        )
      ) : (
        shouldShowTabs && (
          <div className="space-y-6">
            {weatherItems && weatherItems.length > 0 && (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {weatherItems.map((w, i) => (
                  <div key={i} className="flex justify-center">
                    <WeatherWidget
                      width="100%"
                      className="w-full"
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
            )}

            {webItems.length > 0 ? (
              <div className="space-y-6">
                {webItems.map((item, i) => {
                  const firstSummary = item.summaryLines.find((l) => l && l.trim().length > 0) || "";
                  return (
                    <div
                      key={i}
                      className="space-y-2"
                      data-cloudy-kind="web"
                      data-cloudy-link={item.link}
                      data-cloudy-title={item.title}
                      data-cloudy-summary={firstSummary}
                      data-cloudy-search-query={searchQuery}
                    >
                      <div className="bg-accent w-full rounded-md border px-3 py-2 text-sm">
                        <a
                          href={item.link}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:underline truncate block"
                          title={item.title}
                          onClick={(e) => {
                            if (onLinkClick) {
                              e.preventDefault();
                              onLinkClick(item.link, item.title);
                            }
                          }}
                        >
                          {item.title}
                        </a>
                      </div>
                      {item.summaryLines.map((line, lineIdx) =>
                        line ? (
                          <div
                            key={lineIdx}
                            className="bg-accent w-full rounded-md border px-3 py-2 text-sm text-muted-foreground"
                          >
                            {line}
                          </div>
                        ) : null
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              !weatherItems?.length && (
                <div className="text-sm text-muted-foreground">No results found.</div>
              )
            )}
          </div>
        )
      )}
    </div>
  );
}

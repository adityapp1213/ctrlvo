// Renders AI search results with tabs for results, media, and videos
"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { WeatherWidget } from "@/components/ui/weather-widget";
import { WeatherItem } from "@/app/lib/weather";
import { VideoList } from "@/components/video-list";
import type { PinnedItem } from "@/app/lib/chat-store";
import { SearchResultItem } from "@/components/search-result-item";
import { Response } from "@/app/components/ai-elements/response";

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

function formatDisplayUrl(value: string) {
  try {
    const u = new URL(value);
    const host = u.hostname.replace(/^www\./i, "");
    return `www.${host}`;
  } catch {
    return value;
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

type ShoppingProduct = {
  id: string;
  title: string;
  link: string;
  thumbnailUrl?: string;
  priceText?: string;
  price?: number | null;
  rating?: number | null;
  reviewCount?: number | null;
  source?: string;
  sourceIconUrl?: string;
  descriptionSnippet?: string;
  additionalImageUrls?: string[];
};

type SearchResultsBlockProps = {
  searchQuery: string;
  overallSummaryLines: string[];
  summary?: string | null;
  summaryIsStreaming?: boolean;
  webItems: { link: string; title: string; summaryLines: string[]; imageUrl?: string }[];
  mediaItems: { src: string; alt?: string }[];
  weatherItems?: WeatherItem[];
  youtubeItems?: YouTubeVideo[];
  shoppingItems?: ShoppingProduct[];
  shouldShowTabs: boolean;
  onLinkClick?: (url: string, title: string) => void;
  onPinItem?: (item: PinnedItem) => void;
  pinnedIds?: string[];
  onMediaLoad?: () => void;
};

export function SearchResultsBlock({
  searchQuery,
  overallSummaryLines,
  summary,
  summaryIsStreaming,
  webItems,
  mediaItems,
  weatherItems,
  youtubeItems,
  shoppingItems,
  shouldShowTabs,
  onLinkClick,
  onPinItem,
  pinnedIds,
  onMediaLoad,
}: SearchResultsBlockProps) {
  const isVideoMode = youtubeItems && youtubeItems.length > 0;
  const [tab, setTab] = useState(
    isVideoMode ? "videos" : shouldShowTabs ? "chat" : "results"
  );
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const showSummary = overallSummaryLines.length > 0 && !shouldShowTabs;
  const rawSummaryText = summaryIsStreaming
    ? String(summary ?? "")
    : (summary || "").trim() || overallSummaryLines.filter(Boolean).join(" ");
  const firstParagraph =
    rawSummaryText.split(/\n\s*\n/)[0] || rawSummaryText;
  const trimmedWords = firstParagraph.split(/\s+/).slice(0, 70).join(" ");
  const summaryText = trimmedWords.trim();
  const summaryParagraphs = summaryText
    ? summaryText.split(/\n\s*\n/).filter(Boolean)
    : [];
  const summaryWordSplit = summaryText ? summaryText.split(/\s+/) : [];
  const summarySplitIndex = Math.max(
    1,
    Math.floor(summaryWordSplit.length / 2)
  );
  const summaryFirst =
    summaryParagraphs.length >= 2
      ? summaryParagraphs[0]
      : summaryWordSplit.slice(0, summarySplitIndex).join(" ");
  const summarySecond =
    summaryParagraphs.length >= 2
      ? summaryParagraphs.slice(1).join("\n\n")
      : summaryWordSplit.slice(summarySplitIndex).join(" ");

  const chatMediaItems = mediaItems
    .map((item) => ({ ...item, src: normalizeExternalUrl(item.src) }))
    .filter((item) => Boolean(item.src)) as Array<{
      src: string;
      alt?: string;
    }>;
  const chatMediaItemsLimited = chatMediaItems.slice(0, 3);

  const [mediaIndex, setMediaIndex] = useState(0);
  const mediaTouchStartXRef = useRef<number | null>(null);
  const [shoppingIndex, setShoppingIndex] = useState(0);

  const handleMediaPrev = () => {
    if (!chatMediaItemsLimited.length) return;
    setMediaIndex((prev) =>
      prev === 0 ? chatMediaItemsLimited.length - 1 : prev - 1
    );
  };

  const handleMediaNext = () => {
    if (!chatMediaItemsLimited.length) return;
    setMediaIndex((prev) =>
      prev === chatMediaItemsLimited.length - 1 ? 0 : prev + 1
    );
  };

  const handleMediaTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    const touch = e.touches[0];
    mediaTouchStartXRef.current = touch.clientX;
  };

  const handleMediaTouchEnd = (e: React.TouchEvent<HTMLDivElement>) => {
    if (mediaTouchStartXRef.current == null) return;
    const touch = e.changedTouches[0];
    const dx = touch.clientX - mediaTouchStartXRef.current;
    mediaTouchStartXRef.current = null;
    const threshold = 40;
    if (Math.abs(dx) < threshold) return;
    if (dx < 0) {
      handleMediaNext();
    } else {
      handleMediaPrev();
    }
  };

  const handleShoppingPrev = () => {
    if (!shoppingItems || shoppingItems.length === 0) return;
    setShoppingIndex((prev) =>
      prev === 0 ? shoppingItems.length - 1 : prev - 1
    );
  };

  const handleShoppingNext = () => {
    if (!shoppingItems || shoppingItems.length === 0) return;
    setShoppingIndex((prev) =>
      prev === shoppingItems.length - 1 ? 0 : prev + 1
    );
  };

  const renderSummaryWithCitations = (text: string) => {
    const value = String(text || "");
    if (!value.trim()) return null;

    const parts = value.split(/\[(\d+)\]/g);
    return parts.map((part, idx) => {
      const isIndex = idx % 2 === 1;
      if (!isIndex) {
        const segment = part.trim();
        if (!segment) return null;
        return (
          <div key={`t-${idx}`} className="mb-1 last:mb-0">
            <Response className="prose prose-sm max-w-none dark:prose-invert" parseIncompleteMarkdown={false}>
              {segment}
            </Response>
          </div>
        );
      }
      const sourceIndex = Number(part);
      const item = Number.isFinite(sourceIndex)
        ? webItems[sourceIndex - 1]
        : undefined;
      const label = item?.link ? formatDisplayUrl(item.link) : `[${part}]`;
      if (!item?.link) return <span key={`t-${idx}`}>{label}</span>;
      return (
        <a
          key={`t-${idx}`}
          href={item.link}
          target="_blank"
          rel="noopener noreferrer"
          className="text-blue-600 underline underline-offset-2"
        >
          {label}
        </a>
      );
    });
  };

  return (
    <div className="w-full space-y-4">
      {/* Summary */}
      {showSummary && (
        <div className="bg-accent rounded-md border px-3 py-2 text-sm">
          {renderSummaryWithCitations(
            overallSummaryLines.filter(Boolean).join(" ")
          )}
        </div>
      )}

      {shouldShowTabs && !isVideoMode && (
        <div className="flex gap-2">
          <button
            onClick={() => setTab("chat")}
            className={cn(
              "px-3 py-1 text-sm font-medium rounded-md transition-colors",
              tab === "chat"
                ? "bg-black text-white dark:bg-white dark:text-black"
                : "bg-accent text-muted-foreground hover:bg-accent/80"
            )}
          >
            Chat
          </button>
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
      ) : shouldShowTabs && tab === "chat" ? (
        <>
          {lightboxIndex !== null && chatMediaItemsLimited[lightboxIndex] && (
            <div
              className="fixed inset-0 z-[70] bg-black/90 flex items-center justify-center"
              onClick={() => setLightboxIndex(null)}
            >
              <button
                type="button"
                onClick={() => setLightboxIndex(null)}
                className="absolute top-6 right-6 text-white/80 hover:text-white"
              >
                <X className="w-6 h-6" />
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setLightboxIndex((prev) => {
                    if (prev === null || chatMediaItemsLimited.length === 0)
                      return prev;
                    return (
                      (prev - 1 + chatMediaItemsLimited.length) %
                      chatMediaItemsLimited.length
                    );
                  });
                }}
                className="absolute left-6 text-white/80 hover:text-white"
              >
                <ChevronLeft className="w-8 h-8" />
              </button>
              <div
                className="max-w-5xl w-full px-10"
                onClick={(e) => e.stopPropagation()}
              >
                <img
                  src={chatMediaItemsLimited[lightboxIndex].src}
                  alt={chatMediaItemsLimited[lightboxIndex].alt ?? ""}
                  referrerPolicy="no-referrer"
                  className="w-full max-h-[80vh] object-contain rounded-lg"
                />
              </div>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setLightboxIndex((prev) => {
                    if (prev === null || chatMediaItemsLimited.length === 0)
                      return prev;
                    return (prev + 1) % chatMediaItemsLimited.length;
                  });
                }}
                className="absolute right-6 text-white/80 hover:text-white"
              >
                <ChevronRight className="w-8 h-8" />
              </button>
            </div>
          )}
          <div className="space-y-6">
            {summaryText ? (
              <div className="text-sm">
                {renderSummaryWithCitations(summaryFirst)}
              </div>
            ) : (
              <div className="text-sm text-muted-foreground">
                {summaryIsStreaming ? "Thinking!!" : "No results found."}
              </div>
            )}
            {Array.isArray(shoppingItems) && shoppingItems.length > 0 ? (
              <div className="w-full space-y-3">
                <div className="block md:hidden">
                  {(() => {
                    const index =
                      shoppingIndex < 0 || shoppingIndex >= shoppingItems.length
                        ? 0
                        : shoppingIndex;
                    const item = shoppingItems[index];
                    const src = normalizeExternalUrl(item.thumbnailUrl);
                    return (
                      <div className="relative max-w-md mx-auto">
                        <a
                          href={item.link}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex flex-col rounded-lg border bg-accent/40 hover:bg-accent transition-colors p-3 text-left"
                        >
                          {src && (
                            <div className="relative w-full aspect-square mb-3 rounded-md overflow-hidden bg-background/40">
                              <Image
                                src={src}
                                alt={item.title}
                                fill
                                className="object-contain"
                                sizes="(min-width: 1024px) 200px, 80vw"
                                loading="lazy"
                                unoptimized
                                referrerPolicy="no-referrer"
                              />
                            </div>
                          )}
                          <div className="flex-1 space-y-1">
                            <div className="text-sm font-medium leading-snug line-clamp-2 break-words">
                              {item.title}
                            </div>
                            {item.descriptionSnippet && (
                              <div className="text-xs text-muted-foreground line-clamp-2 break-words">
                                {item.descriptionSnippet}
                              </div>
                            )}
                            {item.priceText && (
                              <div className="text-sm font-semibold">
                                {item.priceText}
                              </div>
                            )}
                            {(item.rating != null || item.reviewCount != null) && (
                              <div className="text-xs text-muted-foreground">
                                {item.rating != null && (
                                  <span>{item.rating.toFixed(1)}</span>
                                )}
                                {item.rating != null && item.reviewCount != null && (
                                  <span> • </span>
                                )}
                                {item.reviewCount != null && (
                                  <span>
                                    {item.reviewCount.toLocaleString()} reviews
                                  </span>
                                )}
                              </div>
                            )}
                            {Array.isArray(item.additionalImageUrls) &&
                              item.additionalImageUrls.length > 0 && (
                                <div className="mt-2 flex gap-1">
                                  {item.additionalImageUrls
                                    .slice(0, 3)
                                    .map((url, i) => {
                                      const extraSrc = normalizeExternalUrl(url);
                                      if (!extraSrc) return null;
                                      return (
                                        <div
                                          key={i}
                                          className="relative h-10 w-10 rounded-md overflow-hidden bg-background/40"
                                        >
                                          <Image
                                            src={extraSrc}
                                            alt={item.title}
                                            fill
                                            className="object-cover"
                                            sizes="40px"
                                            loading="lazy"
                                            unoptimized
                                            referrerPolicy="no-referrer"
                                          />
                                        </div>
                                      );
                                    })}
                                </div>
                              )}
                          </div>
                          {item.source && (
                            <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
                              {item.sourceIconUrl &&
                                normalizeExternalUrl(item.sourceIconUrl) && (
                                  <span className="relative h-4 w-4 overflow-hidden rounded-full bg-background/60">
                                    <Image
                                      src={normalizeExternalUrl(item.sourceIconUrl)!}
                                      alt={item.source}
                                      fill
                                      className="object-contain"
                                      sizes="16px"
                                      loading="lazy"
                                      unoptimized
                                      referrerPolicy="no-referrer"
                                    />
                                  </span>
                                )}
                              <span className="truncate">{item.source}</span>
                            </div>
                          )}
                        </a>
                        {shoppingItems.length > 1 && (
                          <>
                            <button
                              type="button"
                              onClick={handleShoppingPrev}
                              className="absolute left-2 top-1/2 -translate-y-1/2 bg-black/60 text-white rounded-full p-1"
                            >
                              <ChevronLeft className="w-4 h-4" />
                            </button>
                            <button
                              type="button"
                              onClick={handleShoppingNext}
                              className="absolute right-2 top-1/2 -translate-y-1/2 bg-black/60 text-white rounded-full p-1"
                            >
                              <ChevronRight className="w-4 h-4" />
                            </button>
                          </>
                        )}
                      </div>
                    );
                  })()}
                </div>
                <div className="hidden md:block">
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    {shoppingItems.slice(0, 4).map((item, idx) => {
                      const src = normalizeExternalUrl(item.thumbnailUrl);
                      return (
                        <a
                          key={item.id || idx}
                          href={item.link}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex flex-col rounded-lg border bg-accent/40 hover:bg-accent transition-colors p-3 text-left"
                        >
                          {src && (
                            <div className="relative w-full aspect-square mb-3 rounded-md overflow-hidden bg-background/40">
                              <Image
                                src={src}
                                alt={item.title}
                                fill
                                className="object-contain"
                                sizes="(min-width: 1024px) 200px, 33vw"
                                loading="lazy"
                                unoptimized
                                referrerPolicy="no-referrer"
                              />
                            </div>
                          )}
                          <div className="flex-1 space-y-1">
                            <div className="text-sm font-medium leading-snug line-clamp-2 break-words">
                              {item.title}
                            </div>
                            {item.descriptionSnippet && (
                              <div className="text-xs text-muted-foreground line-clamp-2 break-words">
                                {item.descriptionSnippet}
                              </div>
                            )}
                            {item.priceText && (
                              <div className="text-sm font-semibold">
                                {item.priceText}
                              </div>
                            )}
                            {(item.rating != null || item.reviewCount != null) && (
                              <div className="text-xs text-muted-foreground">
                                {item.rating != null && (
                                  <span>{item.rating.toFixed(1)}</span>
                                )}
                                {item.rating != null && item.reviewCount != null && (
                                  <span> • </span>
                                )}
                                {item.reviewCount != null && (
                                  <span>
                                    {item.reviewCount.toLocaleString()} reviews
                                  </span>
                                )}
                              </div>
                            )}
                            {Array.isArray(item.additionalImageUrls) &&
                              item.additionalImageUrls.length > 0 && (
                                <div className="mt-2 flex gap-1">
                                  {item.additionalImageUrls
                                    .slice(0, 3)
                                    .map((url, i) => {
                                      const extraSrc = normalizeExternalUrl(url);
                                      if (!extraSrc) return null;
                                      return (
                                        <div
                                          key={i}
                                          className="relative h-10 w-10 rounded-md overflow-hidden bg-background/40"
                                        >
                                          <Image
                                            src={extraSrc}
                                            alt={item.title}
                                            fill
                                            className="object-cover"
                                            sizes="40px"
                                            loading="lazy"
                                            unoptimized
                                            referrerPolicy="no-referrer"
                                          />
                                        </div>
                                      );
                                    })}
                                </div>
                              )}
                          </div>
                          {item.source && (
                            <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
                              {item.sourceIconUrl &&
                                normalizeExternalUrl(item.sourceIconUrl) && (
                                  <span className="relative h-4 w-4 overflow-hidden rounded-full bg-background/60">
                                    <Image
                                      src={normalizeExternalUrl(item.sourceIconUrl)!}
                                      alt={item.source}
                                      fill
                                      className="object-contain"
                                      sizes="16px"
                                      loading="lazy"
                                      unoptimized
                                      referrerPolicy="no-referrer"
                                    />
                                  </span>
                                )}
                              <span className="truncate">{item.source}</span>
                            </div>
                          )}
                        </a>
                      );
                    })}
                  </div>
                </div>
              </div>
            ) : (
              chatMediaItemsLimited.length > 0 && (
                <div className="w-full">
                  <div className="block md:hidden">
                    <div className="relative max-w-md mx-auto">
                      <div
                        className="aspect-video bg-accent rounded-md border overflow-hidden flex items-center justify-center"
                        onTouchStart={handleMediaTouchStart}
                        onTouchEnd={handleMediaTouchEnd}
                        onClick={() => setLightboxIndex(mediaIndex)}
                      >
                        {chatMediaItemsLimited[mediaIndex] && (
                          <img
                            src={chatMediaItemsLimited[mediaIndex].src}
                            alt={chatMediaItemsLimited[mediaIndex].alt ?? ""}
                            loading="eager"
                            referrerPolicy="no-referrer"
                            className="w-full h-full object-cover"
                            onLoad={onMediaLoad}
                            onError={onMediaLoad}
                          />
                        )}
                        {chatMediaItemsLimited.length > 1 && (
                          <>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleMediaPrev();
                              }}
                              className="absolute left-2 top-1/2 -translate-y-1/2 bg-black/60 text-white rounded-full p-1"
                            >
                              <ChevronLeft className="w-4 h-4" />
                            </button>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleMediaNext();
                              }}
                              className="absolute right-2 top-1/2 -translate-y-1/2 bg-black/60 text-white rounded-full p-1"
                            >
                              <ChevronRight className="w-4 h-4" />
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="hidden md:block">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      {chatMediaItemsLimited.map((item, i) => (
                        <button
                          key={`${item.src}-${i}`}
                          type="button"
                          onClick={() => setLightboxIndex(i)}
                          className="aspect-video bg-accent rounded-md border overflow-hidden flex items-center justify-center"
                        >
                          <img
                            src={item.src}
                            alt={item.alt ?? ""}
                            loading={i < 3 ? "eager" : "lazy"}
                            referrerPolicy="no-referrer"
                            className="w-full h-full object-cover"
                            onLoad={onMediaLoad}
                            onError={onMediaLoad}
                          />
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )
            )}
            {summarySecond ? (
              <div className="text-sm">{renderSummaryWithCitations(summarySecond)}</div>
            ) : null}
          </div>
        </>
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
              <div className="grid grid-cols-1 gap-3" data-cloudy-search-query={searchQuery}>
                {webItems.map((item, i) => {
                  const description = item.summaryLines.find((l) => l && l.trim().length > 0) || "";
                  return (
                    <SearchResultItem
                      key={i}
                      link={item.link}
                      title={item.title}
                      description={description}
                      imageUrl={item.imageUrl}
                      onClick={
                        onLinkClick ? () => onLinkClick(item.link, item.title) : undefined
                      }
                    />
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

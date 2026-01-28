// YouTube video list with inline player and pinning support
"use client";

import { useState } from "react";
import Image from "next/image";
import { PlayIcon, Globe } from "lucide-react";
import { YouTubeVideo } from "@/app/lib/ai/youtube";
import type { PinnedItem } from "@/app/lib/chat-store";

type VideoListProps = {
  videos: YouTubeVideo[];
  onLinkClick?: (url: string, title: string) => void;
  onPinItem?: (item: PinnedItem) => void;
  pinnedIds?: string[];
  searchQuery?: string;
};

export function VideoList({ videos, onLinkClick, onPinItem, pinnedIds, searchQuery }: VideoListProps) {
  const [playingVideoId, setPlayingVideoId] = useState<string | null>(null);

  return (
    <div className="space-y-6">
      {videos.map((video) => (
        <div
          key={video.id}
          className="group"
          data-cloudy-kind="youtube"
          data-cloudy-link={`https://www.youtube.com/watch?v=${video.id}`}
          data-cloudy-title={video.title}
          data-cloudy-summary={video.description}
          data-cloudy-search-query={searchQuery || ""}
        >
          <div
            className="relative w-full aspect-video bg-black rounded-lg overflow-hidden cursor-pointer shadow-sm hover:shadow-md transition-shadow"
            onClick={() => setPlayingVideoId(video.id)}
          >
            {playingVideoId === video.id ? (
              <iframe
                width="100%"
                height="100%"
                src={`https://www.youtube.com/embed/${video.id}?autoplay=1`}
                title={video.title}
                frameBorder="0"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                className="absolute inset-0 w-full h-full"
              />
            ) : (
              <>
                <Image
                  src={video.thumbnail}
                  alt={video.title}
                  fill
                  className="object-cover"
                />
                <div className="absolute inset-0 flex items-center justify-center bg-black/20 group-hover:bg-black/30 transition-colors">
                  <div className="w-16 h-16 bg-red-600 rounded-full flex items-center justify-center shadow-lg transition-transform group-hover:scale-110">
                    <PlayIcon className="w-8 h-8 text-white fill-current" />
                  </div>
                </div>
              </>
            )}
          </div>
          <div className="mt-3">
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2 flex-1">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onPinItem?.({
                      id: video.id,
                      kind: "youtube",
                      title: video.title,
                      link: `https://www.youtube.com/watch?v=${video.id}`,
                      summary: video.description,
                    });
                  }}
                  className={`text-xs px-2 py-1 rounded-full border transition-colors ${
                    pinnedIds?.includes(video.id)
                      ? "bg-black text-white dark:bg-white dark:text-black"
                      : "bg-background text-muted-foreground hover:bg-accent"
                  }`}
                >
                  {pinnedIds?.includes(video.id) ? "Pinned" : "Pin"}
                </button>
                <h3
                  className="font-semibold text-lg leading-tight cursor-pointer hover:text-blue-600 dark:hover:text-blue-400 transition-colors flex-1"
                  onClick={() => setPlayingVideoId(video.id)}
                >
                  {video.title}
                </h3>
              </div>
              {onLinkClick && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onLinkClick(`https://www.youtube.com/embed/${video.id}`, video.title);
                  }}
                  className="p-1.5 hover:bg-muted rounded-md text-muted-foreground hover:text-foreground transition-colors shrink-0"
                  title="Open in Browser"
                >
                  <Globe className="w-4 h-4" />
                </button>
              )}
            </div>
            <div className="flex items-center text-sm text-muted-foreground mt-1 gap-2">
              <span className="font-medium">{video.channelTitle}</span>
              <span>•</span>
              <span>{new Date(video.publishedAt).toLocaleDateString()}</span>
            </div>
            <p className="text-sm text-muted-foreground mt-2 line-clamp-2">
              {video.description}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}

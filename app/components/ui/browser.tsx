"use client";

import { useState, useEffect, useRef } from "react";
import { X, Globe, Plus, ChevronLeft, ChevronRight, RotateCw, Maximize2, Minimize2, ExternalLink, Copy, MessageSquarePlus } from "lucide-react";
import { cn } from "@/lib/utils";
import Image from "next/image";
import { checkEmbeddability } from "@/app/actions/browser";

export type BrowserTab = {
  id: string;
  url: string;
  title: string;
  icon?: string;
};

type EmbedState = "loading" | "success" | "blocked";

function FallbackUI({
  url,
}: {
  url: string;
}) {
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 text-center p-4 bg-background/95 backdrop-blur-sm">
      <div className="p-3 rounded-full bg-muted">
        <Globe className="w-6 h-6 text-muted-foreground" />
      </div>
      <div className="space-y-1">
        <p className="font-medium text-foreground">
          Unable to embed this site
        </p>
        <p className="text-sm text-muted-foreground max-w-xs mx-auto">
          This website prevents itself from being displayed in a frame for security reasons.
        </p>
      </div>

      <div className="flex gap-2">
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 px-4 py-2 text-sm font-medium transition-colors"
        >
          <ExternalLink className="w-4 h-4" />
          Open in new tab
        </a>
      </div>
    </div>
  );
}

function EmbeddedBrowser({ url, title }: { url: string; title: string }) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [state, setState] = useState<EmbedState>("loading");
  
  // Use a ref to track loading state to avoid stale closures in setTimeout
  const isLoadedRef = useRef(false);

  useEffect(() => {
    setState("loading");
    isLoadedRef.current = false;
    
    // Check if the site allows embedding via server-side headers check
    // Skip check for local paths
    if (url.startsWith("/")) {
      handleLoad(); // Assume local paths are fine and might load instantly or trigger load event
      // But we still need to wait for iframe onLoad to be sure, so actually just skip the checkEmbeddability call
      // and let the iframe load.
    } else {
      checkEmbeddability(url).then((isEmbeddable) => {
        if (!isEmbeddable) {
          setState("blocked");
          isLoadedRef.current = false;
        }
      });
    }

    const timeout = setTimeout(() => {
      // If iframe hasn't loaded meaningfully, assume blocked
      if (!isLoadedRef.current) {
        setState("blocked");
      }
    }, 5000); // Increased timeout to 5s for slower connections

    return () => clearTimeout(timeout);
  }, [url]);

  const handleLoad = () => {
    setState("success");
    isLoadedRef.current = true;
  };

  const handleError = () => {
    setState("blocked");
    isLoadedRef.current = false;
  };

  return (
    <div className="relative h-full w-full bg-background">
      {state === "loading" && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-muted-foreground bg-background z-10">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          <p className="text-sm animate-pulse">Loading page...</p>
        </div>
      )}

      {/* We keep the iframe mounted but hide it if blocked to allow potential recovery or background load */}
      <iframe
        ref={iframeRef}
        src={url}
        className={cn(
          "w-full h-full border-none bg-white",
          state === "blocked" ? "invisible absolute" : "visible"
        )}
        sandbox="allow-same-origin allow-scripts allow-forms allow-popups allow-popups-to-escape-sandbox"
        title={title}
        onLoad={handleLoad}
        onError={handleError}
      />

      {state === "blocked" && (
        <FallbackUI
          url={url}
        />
      )}
    </div>
  );
}

type BrowserProps = {
  tabs: BrowserTab[];
  activeTabId: string | null;
  onCloseTab: (id: string) => void;
  onSwitchTab: (id: string) => void;
  onClose: () => void;
  onAddToChat?: (text: string) => void;
  className?: string;
};

export function Browser({
  tabs,
  activeTabId,
  onCloseTab,
  onSwitchTab,
  onClose,
  onAddToChat,
  className,
}: BrowserProps) {
  const [urlInput, setUrlInput] = useState("");
  const activeTab = tabs.find((t) => t.id === activeTabId);

  useEffect(() => {
    if (activeTab) {
      setUrlInput(activeTab.url);
    }
  }, [activeTab]);

  const handleAddToChat = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text && onAddToChat) {
        onAddToChat(text);
      }
    } catch (err) {
      console.error("Failed to read clipboard:", err);
    }
  };

  if (!tabs.length) return null;

  return (
    <div className={cn("flex flex-col h-full bg-background border-l shadow-xl", className)}>
      {/* Tab Bar */}
      <div className="flex items-center bg-muted/50 p-1.5 gap-1 overflow-x-auto border-b">
        {tabs.map((tab) => (
          <div
            key={tab.id}
            onClick={() => onSwitchTab(tab.id)}
            className={cn(
              "flex items-center gap-2 px-3 py-1.5 text-xs sm:text-sm max-w-[200px] rounded-md cursor-pointer transition-all group border border-transparent",
              activeTabId === tab.id
                ? "bg-background shadow-sm border-border text-foreground"
                : "text-muted-foreground hover:bg-background/50 hover:text-foreground"
            )}
          >
            {tab.icon ? (
               <div className="w-4 h-4 relative shrink-0">
                 <Image src={tab.icon} alt="" fill className="object-contain" />
               </div>
            ) : (
              <Globe className="w-3.5 h-3.5 shrink-0" />
            )}
            <span className="truncate flex-1">{tab.title}</span>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onCloseTab(tab.id);
              }}
              className="opacity-0 group-hover:opacity-100 p-0.5 hover:bg-muted rounded-full transition-opacity"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        ))}
        <div className="flex-1" />
        <button
          onClick={onClose}
          className="p-1.5 hover:bg-muted rounded-md text-muted-foreground hover:text-foreground transition-colors"
          title="Close Browser"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Address Bar */}
      <div className="flex items-center gap-2 p-2 border-b bg-background">
        <div className="flex gap-1">
          <button className="p-1.5 hover:bg-muted rounded-md text-muted-foreground disabled:opacity-50">
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button className="p-1.5 hover:bg-muted rounded-md text-muted-foreground disabled:opacity-50">
            <ChevronRight className="w-4 h-4" />
          </button>
          <button className="p-1.5 hover:bg-muted rounded-md text-muted-foreground">
            <RotateCw className="w-3.5 h-3.5" />
          </button>
          {onAddToChat && (
            <button 
              onClick={handleAddToChat}
              className="p-1.5 hover:bg-muted rounded-md text-muted-foreground hover:text-primary transition-colors"
              title="Add copied text to chat"
            >
              <MessageSquarePlus className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
        <div className="flex-1 flex items-center bg-muted/50 hover:bg-muted px-3 py-1.5 rounded-md border border-transparent focus-within:border-border transition-colors">
          <Globe className="w-3.5 h-3.5 text-muted-foreground mr-2" />
          <input
            className="flex-1 bg-transparent border-none outline-none text-sm text-foreground placeholder:text-muted-foreground"
            value={urlInput}
            readOnly
          />
        </div>
      </div>

      {/* Content Area */}
      <div className="flex-1 relative bg-background">
        {tabs.map((tab) => (
          <div
            key={tab.id}
            className={cn(
              "absolute inset-0 w-full h-full bg-background",
              activeTabId === tab.id ? "z-10" : "z-0 hidden"
            )}
          >
            <EmbeddedBrowser url={tab.url} title={tab.title} />
          </div>
        ))}
      </div>
    </div>
  );
}

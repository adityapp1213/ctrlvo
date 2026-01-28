"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  PromptInputAttachment,
  PromptInputAttachments,
  PromptInputProvider,
  useProviderAttachments,
} from "@/components/ai-elements/prompt-input";
import {
  ArrowUp,
  AudioLines,
  Globe,
  Grid,
  Map,
  Mic,
  Plus,
  Search,
  Youtube,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function HomeSearchInput() {
  return (
    <PromptInputProvider>
      <HomeSearchInputContent />
    </PromptInputProvider>
  );
}

function HomeSearchInputContent() {
  const router = useRouter();
  const attachments = useProviderAttachments();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const recognitionRef = useRef<any>(null);
  const inputValueRef = useRef("");
  const [input, setInput] = useState("");
  const [isSearch, setIsSearch] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [hasRecognition, setHasRecognition] = useState(false);
  const [selectedApp, setSelectedApp] = useState<"apps" | "youtube" | "maps" | "spotify">("apps");

  const submitText = (rawText: string, source: "text" | "voice" = "text") => {
    let text = rawText;
    if (!text.trim()) return;

    const voiceParam = source === "voice" ? "&voice=1" : "";

    if (selectedApp === "youtube") {
      text = `YouTube ${text}`;
    } else if (selectedApp === "maps") {
      text = `Map of ${text}`;
      router.push(`/home/search?q=${encodeURIComponent(text)}&search=${isSearch}&tab=map${voiceParam}`);
      return;
    } else if (selectedApp === "spotify") {
      text = `Spotify ${text}`;
    }

    router.push(`/home/search?q=${encodeURIComponent(text)}&search=${isSearch}${voiceParam}`);
  };

  const handleSubmit = () => {
    submitText(input, "text");
  };

  useEffect(() => {
    if (typeof window === "undefined") return;
    const SpeechRecognitionCtor =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognitionCtor) return;
    const recognition = new SpeechRecognitionCtor();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "en-US";
    recognition.onstart = () => {
      setIsListening(true);
      window.dispatchEvent(new CustomEvent("atom-ctrl-listening-state", { detail: true }));
    };
    recognition.onend = () => {
      setIsListening(false);
      window.dispatchEvent(new CustomEvent("atom-ctrl-listening-state", { detail: false }));
    };
    recognition.onresult = (event: any) => {
      let finalTranscript = "";
      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        const result = event.results[i];
        if (result.isFinal) {
          finalTranscript += result[0]?.transcript ?? "";
        }
      }
      if (!finalTranscript) return;
      const currentValue = inputValueRef.current;
      const nextValue = currentValue
        ? `${currentValue} ${finalTranscript}`.trim()
        : finalTranscript;
      inputValueRef.current = nextValue;
      setInput(nextValue);
    };
    recognition.onerror = () => {
      setIsListening(false);
      window.dispatchEvent(new CustomEvent("atom-ctrl-listening-state", { detail: false }));
    };
    recognitionRef.current = recognition;
    setHasRecognition(true);

    return () => {
      recognition.stop();
    };
  }, []);

  const toggleListening = useCallback(() => {
    const recognition = recognitionRef.current;
    if (!recognition) return;
    if (isListening) {
      recognition.stop();
    } else {
      recognition.start();
    }
  }, [isListening]);

  useEffect(() => {
    const handleToggle = () => {
      toggleListening();
    };
    window.addEventListener("atom-ctrl-toggle-listening", handleToggle);
    return () => window.removeEventListener("atom-ctrl-toggle-listening", handleToggle);
  }, [toggleListening]);

  const getAppIcon = () => {
    switch (selectedApp) {
      case "youtube": return <Youtube size={16} />;
      case "maps": return <Map size={16} />;
      case "spotify": return <AudioLines size={16} />;
      default: return <Grid size={16} />;
    }
  };

  const getAppLabel = () => {
    switch (selectedApp) {
      case "youtube": return "YouTube";
      case "maps": return "Maps";
      case "spotify": return "Spotify";
      default: return "Apps";
    }
  };

  return (
    <div className="w-full max-w-3xl">
      <div className="rounded-2xl border border-border/60 bg-white shadow-sm">
        <div className="flex items-center gap-3 px-4 pt-4">
          <Search className="h-5 w-5 text-muted-foreground" />
          <input
            value={input}
            onChange={(e) => {
              inputValueRef.current = e.target.value;
              setInput(e.target.value);
            }}
            placeholder="What would you like to know?"
            className="w-full bg-transparent text-base outline-none placeholder:text-muted-foreground"
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                const next = (e.currentTarget.value || "").trim();
                if (next) submitText(next, "text");
              }
            }}
          />
        </div>

        <PromptInputAttachments className="px-4 pt-3">
          {(file) => <PromptInputAttachment key={file.id} data={file} />}
        </PromptInputAttachments>

        <div className="flex items-center justify-between px-4 pb-4 pt-3">
          <div className="flex items-center gap-3 text-sm text-muted-foreground">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-8 gap-2"
              onClick={() => fileInputRef.current?.click()}
            >
              <Plus className="h-4 w-4" />
              <span>Add pages or files</span>
            </Button>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button type="button" variant="ghost" size="sm" className="h-8 gap-2">
                  {getAppIcon()}
                  <span>{getAppLabel()}</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent side="top" align="center">
                <DropdownMenuItem onClick={() => setSelectedApp("youtube")}>
                  <Youtube className="mr-2 h-4 w-4" />
                  <span>YouTube</span>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setSelectedApp("maps")}>
                  <Map className="mr-2 h-4 w-4" />
                  <span>Maps</span>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setSelectedApp("spotify")}>
                  <AudioLines className="mr-2 h-4 w-4" />
                  <span>Spotify</span>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setSelectedApp("apps")}>
                  <Grid className="mr-2 h-4 w-4" />
                  <span>No Apps</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            {selectedApp === "apps" && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setIsSearch(!isSearch)}
                className={cn("h-8 gap-2", isSearch && "text-blue-500")}
              >
                <Globe className="h-4 w-4" />
                <span>Search</span>
              </Button>
            )}
          </div>

          {input.trim().length === 0 ? (
            <Button
              type="button"
              variant="outline"
              size="icon-lg"
              className={cn(
                "rounded-full",
                isListening && "animate-pulse bg-accent text-accent-foreground border-transparent"
              )}
              onClick={toggleListening}
              aria-label="Record"
              disabled={!hasRecognition}
            >
              <Mic className="h-4 w-4" />
            </Button>
          ) : (
            <Button
              type="button"
              size="icon-lg"
              className="rounded-full bg-black text-white shadow-sm hover:bg-black/90"
              onClick={handleSubmit}
              aria-label="Go"
            >
              <ArrowUp className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>
      <input
        ref={fileInputRef}
        type="file"
        multiple
        className="hidden"
        aria-label="Upload files"
        onChange={(e) => {
          if (e.currentTarget.files) {
            attachments.add(e.currentTarget.files);
          }
          e.currentTarget.value = "";
        }}
      />
    </div>
  );
}

"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useUser } from "@clerk/nextjs";
import { useMutation } from "convex/react";
import { nanoid } from "nanoid";
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
import { api } from "../../../convex/_generated/api";

export function HomeSearchInput() {
  return (
    <PromptInputProvider>
      <HomeSearchInputContent />
    </PromptInputProvider>
  );
}

function HomeSearchInputContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user } = useUser();
  const userId = user?.id ?? null;
  const initChat = useMutation(api.chat.initChat);
  const attachments = useProviderAttachments();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const recognitionRef = useRef<any>(null);
  const inputValueRef = useRef("");
  const isVoiceInputRef = useRef(false);
  const [input, setInput] = useState("");
  const [isSearch, setIsSearch] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [hasRecognition, setHasRecognition] = useState(false);
  const [selectedApp, setSelectedApp] = useState<"apps" | "youtube" | "maps" | "shopping">("apps");
  const [chatSessionId, setChatSessionId] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    let currentId = params.get("cxid");
    if (!currentId) {
      currentId = nanoid();
      params.set("cxid", currentId);
      const newUrl = `${window.location.pathname}?${params.toString()}`;
      window.history.replaceState(
        { ...(window.history.state || {}), as: newUrl, url: newUrl },
        "",
        newUrl
      );
    }
    setChatSessionId(currentId);
    if (!userId) return;
    void (async () => {
      try {
        await initChat({
          userId,
          sessionId: currentId as string,
          title: "",
          createdAt: Date.now(),
        });
      } catch {
      }
    })();
  }, [userId, initChat]);

  const submitText = (rawText: string, source?: "text" | "voice") => {
    let text = rawText;
    if (!text.trim()) return;

    const effectiveSource: "text" | "voice" =
      source ?? (isVoiceInputRef.current ? "voice" : "text");
    isVoiceInputRef.current = false;

    const voiceParam = effectiveSource === "voice" ? "&voice=1" : "";
    let sessionId = chatSessionId;
    if (!sessionId) {
      sessionId = nanoid();
      setChatSessionId(sessionId);
      if (userId) {
        void (async () => {
          try {
            await initChat({
              userId,
              sessionId,
              title: "",
              createdAt: Date.now(),
            });
          } catch {
          }
        })();
      }
    }
    const chatIdParam = `&chatId=${encodeURIComponent(sessionId)}`;

    const searchParam = isSearch ? "&search=true" : "";

    if (selectedApp === "youtube") {
      text = `YouTube ${text}`;
      router.push(
        `/home/search?q=${encodeURIComponent(text)}${voiceParam}${chatIdParam}`
      );
      return;
    } else if (selectedApp === "maps") {
      text = `Map of ${text}`;
      router.push(
        `/home/search?q=${encodeURIComponent(text)}&tab=map${voiceParam}${chatIdParam}`
      );
      return;
    } else if (selectedApp === "shopping") {
      text = `Shopping ${text}`;
      router.push(
        `/home/search?q=${encodeURIComponent(text)}${voiceParam}${chatIdParam}`
      );
      return;
    }

    router.push(
      `/home/search?q=${encodeURIComponent(text)}${searchParam}${voiceParam}${chatIdParam}`
    );
  };

  const handleSubmit = () => {
    submitText(input);
  };

  useEffect(() => {
    if (typeof window === "undefined") return;
    setHasRecognition("mediaDevices" in navigator && "MediaRecorder" in window);
  }, []);

  const toggleListening = useCallback(() => {
    if (!hasRecognition) return;
    if (isListening) {
      if (recognitionRef.current instanceof MediaRecorder && recognitionRef.current.state !== "inactive") {
        recognitionRef.current.stop();
      }
      setIsListening(false);
      return;
    }
    if (!("mediaDevices" in navigator) || !("MediaRecorder" in window)) return;
    navigator.mediaDevices
      .getUserMedia({ audio: true })
      .then((stream) => {
        const recorder = new MediaRecorder(stream, { mimeType: "audio/webm" });
        recognitionRef.current = recorder;
        const chunks: BlobPart[] = [];
        recorder.ondataavailable = (event) => {
          if (event.data && event.data.size > 0) {
            chunks.push(event.data);
          }
        };
        recorder.onstop = async () => {
          setIsListening(false);
          stream.getTracks().forEach((t) => t.stop());
          const blob = new Blob(chunks, { type: "audio/webm" });
          if (blob.size === 0) return;
          try {
            const formData = new FormData();
            formData.append("audio", blob, "audio.webm");
            const res = await fetch("/api/deepgram/stt", {
              method: "POST",
              body: formData,
            });
            if (!res.ok) return;
            const data = (await res.json()) as { transcript?: string };
            const transcript = (data.transcript || "").trim();
            if (!transcript) return;
            isVoiceInputRef.current = true;
            submitText(transcript, "voice");
          } catch (err) {
            console.error("HomeSearchInput STT error", err);
          }
        };
        recorder.start(250);
        setIsListening(true);
      })
      .catch((err) => {
        console.error("Error starting HomeSearchInput recording", err);
      });
  }, [hasRecognition, isListening, submitText]);

  useEffect(() => {
    return () => {
      if (recognitionRef.current instanceof MediaRecorder && recognitionRef.current.state !== "inactive") {
        recognitionRef.current.stop();
      }
    };
  }, []);

  const getAppIcon = () => {
    switch (selectedApp) {
      case "youtube": return <Youtube size={16} />;
      case "maps": return <Map size={16} />;
      case "shopping": return <AudioLines size={16} />;
      default: return <Grid size={16} />;
    }
  };

  const getAppLabel = () => {
    switch (selectedApp) {
      case "youtube": return "YouTube";
      case "maps": return "Maps";
      case "shopping": return "Shopping";
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
                if (next) submitText(next);
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
                <DropdownMenuItem onClick={() => setSelectedApp("shopping")}>
                  <AudioLines className="mr-2 h-4 w-4" />
                  <span>Shopping</span>
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

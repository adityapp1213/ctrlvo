"use client";

import { CornerRightUp, Mic } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { Textarea } from "@/components/ui/textarea";
import { useAutoResizeTextarea } from "@/components/hooks/use-auto-resize-textarea";

export type AIInputSubmitMeta = {
  source: "text" | "voice";
};

interface AIInputProps {
  id?: string;
  placeholder?: string;
  minHeight?: number;
  maxHeight?: number;
  value?: string;
  onValueChange?: (value: string) => void;
  onSubmit?: (value: string, meta?: AIInputSubmitMeta) => void;
  onSpeechProcessingChange?: (isProcessing: boolean) => void;
  className?: string;
}

export function AIInput({
  id = "ai-input",
  placeholder = "Type your message...",
  minHeight = 52,
  maxHeight = 200,
  value,
  onValueChange,
  onSubmit,
  onSpeechProcessingChange,
  className,
}: AIInputProps) {
  const { textareaRef, adjustHeight } = useAutoResizeTextarea({
    minHeight,
    maxHeight,
  });
  const [internalValue, setInternalValue] = useState("");
  const [isListening, setIsListening] = useState(false);
  const [isSpeechProcessing, setIsSpeechProcessing] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const stopTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const isControlled = value !== undefined;
  const inputValue = isControlled ? value : internalValue;

  const handleValueChange = (newValue: string) => {
    if (!isControlled) {
      setInternalValue(newValue);
    }
    onValueChange?.(newValue);
    adjustHeight();
  };

  const handleReset = () => {
    if (!inputValue.trim()) return;
    void unlockAudio();
    onSubmit?.(inputValue, { source: "text" });
    if (!isControlled) {
      setInternalValue("");
    }
    onValueChange?.("");
    adjustHeight(true);
  };

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

  const getAccessToken = useCallback(async (): Promise<string> => {
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

  const stopAnyPlayingAudio = useCallback(() => {
    const w = window as unknown as { __atomCartesiaAudio?: HTMLAudioElement };
    if (w.__atomCartesiaAudio) {
      w.__atomCartesiaAudio.pause();
      w.__atomCartesiaAudio.src = "";
      w.__atomCartesiaAudio.load();
      w.__atomCartesiaAudio = undefined;
    }
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

  const speakText = useCallback(
    async (text: string) => {
      const trimmed = (text || "").trim();
      if (!trimmed) return;
      try {
        const transcript = humanizeCartesiaTranscript(trimmed);
        const token = await getAccessToken();
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
        stopAnyPlayingAudio();
        const audio = new Audio(url);
        audio.muted = false;
        audio.volume = 1;
        (window as unknown as { __atomCartesiaAudio?: HTMLAudioElement }).__atomCartesiaAudio = audio;
        audio.onended = () => {
          URL.revokeObjectURL(url);
        };
        await unlockAudio();
        await audio.play();
      } catch {
        speakWithSpeechSynthesis(trimmed);
      }
    },
    [getAccessToken, humanizeCartesiaTranscript, speakWithSpeechSynthesis, stopAnyPlayingAudio, unlockAudio]
  );

  const transcribeAudio = useCallback(
    async (audioBlob: Blob): Promise<string> => {
      const token = await getAccessToken();
      const form = new FormData();
      form.append("file", new File([audioBlob], "speech.webm", { type: audioBlob.type || "audio/webm" }));
      form.append("model", "ink-whisper");
      form.append("language", "en");

      const resp = await fetch("https://api.cartesia.ai/audio/transcriptions", {
        method: "POST",
        headers: {
          "Cartesia-Version": CARTESIA_VERSION,
          Authorization: `Bearer ${token}`,
        },
        body: form,
      });
      if (!resp.ok) throw new Error("cartesia_stt_failed");
      const data = (await resp.json()) as { text?: string; transcript?: string };
      return (data.text || data.transcript || "").trim();
    },
    [getAccessToken]
  );

  const cleanupStream = useCallback(() => {
    if (stopTimerRef.current) {
      clearTimeout(stopTimerRef.current);
      stopTimerRef.current = null;
    }
    const stream = mediaStreamRef.current;
    mediaStreamRef.current = null;
    if (stream) {
      for (const t of stream.getTracks()) t.stop();
    }
    mediaRecorderRef.current = null;
    chunksRef.current = [];
  }, []);

  const stopRecording = useCallback(() => {
    if (stopTimerRef.current) {
      clearTimeout(stopTimerRef.current);
      stopTimerRef.current = null;
    }
    const rec = mediaRecorderRef.current;
    if (rec && rec.state !== "inactive") {
      rec.stop();
    }
  }, []);

  const startRecording = useCallback(async () => {
    if (isListening) return;
    if (!("mediaDevices" in navigator) || !navigator.mediaDevices.getUserMedia) return;

    setIsSpeechProcessing(false);
    onSpeechProcessingChange?.(false);

    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    mediaStreamRef.current = stream;

    const mimeCandidates = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4"];
    const mimeType = mimeCandidates.find((m) => MediaRecorder.isTypeSupported(m));
    const rec = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
    mediaRecorderRef.current = rec;
    chunksRef.current = [];

    rec.ondataavailable = (e) => {
      if (e.data && e.data.size > 0) chunksRef.current.push(e.data);
    };

    rec.onstart = () => {
      setIsListening(true);
      window.dispatchEvent(new CustomEvent("atom-ctrl-listening-state", { detail: true }));
    };

    rec.onstop = async () => {
      let didSetProcessing = false;
      try {
        const blob = new Blob(chunksRef.current, { type: rec.mimeType || "audio/webm" });
        cleanupStream();
        setIsListening(false);
        window.dispatchEvent(new CustomEvent("atom-ctrl-listening-state", { detail: false }));

        setIsSpeechProcessing(true);
        onSpeechProcessingChange?.(true);
        didSetProcessing = true;
        await new Promise<void>((resolve) => window.requestAnimationFrame(() => resolve()));

        const text = await transcribeAudio(blob);
        setIsSpeechProcessing(false);
        onSpeechProcessingChange?.(false);
        didSetProcessing = false;
        if (!text) {
          await speakText("Please repeat what you said");
          return;
        }

        handleValueChange(text);
        onSubmit?.(text, { source: "voice" });
        if (!isControlled) {
          setInternalValue("");
        }
        onValueChange?.("");
        adjustHeight(true);
      } catch {
        cleanupStream();
        setIsListening(false);
        window.dispatchEvent(new CustomEvent("atom-ctrl-listening-state", { detail: false }));
      } finally {
        if (didSetProcessing) {
          setIsSpeechProcessing(false);
          onSpeechProcessingChange?.(false);
        }
      }
    };

    rec.start();
    stopTimerRef.current = setTimeout(() => {
      stopRecording();
    }, 5000);
  }, [
    adjustHeight,
    cleanupStream,
    handleValueChange,
    isControlled,
    isListening,
    onSubmit,
    onValueChange,
    onSpeechProcessingChange,
    speakText,
    stopRecording,
    transcribeAudio,
  ]);

  const toggleListening = useCallback(() => {
    if (isListening) {
      stopRecording();
    } else {
      void unlockAudio();
      void startRecording();
    }
  }, [isListening, startRecording, stopRecording, unlockAudio]);

  useEffect(() => {
    const handleToggle = () => {
      toggleListening();
    };
    window.addEventListener("atom-ctrl-toggle-listening", handleToggle);
    return () => window.removeEventListener("atom-ctrl-toggle-listening", handleToggle);
  }, [toggleListening]);

  useEffect(() => {
    return () => {
      stopRecording();
      cleanupStream();
      setIsListening(false);
      setIsSpeechProcessing(false);
      onSpeechProcessingChange?.(false);
      window.dispatchEvent(new CustomEvent("atom-ctrl-listening-state", { detail: false }));
    };
  }, [cleanupStream, onSpeechProcessingChange, stopRecording]);

  return (
    <div className={cn("w-full py-4", className)}>
      <div className="relative max-w-xl w-full mx-auto">
        <Textarea
          id={id}
          placeholder={placeholder}
          className={cn(
            "max-w-xl bg-black/5 dark:bg-white/5 rounded-3xl pl-6 pr-16",
            "placeholder:text-black/50 dark:placeholder:text-white/50",
            "border-none ring-black/20 dark:ring-white/20",
            "text-black dark:text-white text-wrap",
            "overflow-y-auto resize-none",
            "focus-visible:ring-0 focus-visible:ring-offset-0",
            "transition-[height] duration-100 ease-out",
            "leading-[1.2] py-[16px]",
            `min-h-[${minHeight}px]`,
            `max-h-[${maxHeight}px]`,
            "[&::-webkit-resizer]:hidden"
          )}
          ref={textareaRef}
          value={inputValue}
          onChange={(e) => handleValueChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              handleReset();
            }
          }}
        />

        <button
          type="button"
          onClick={toggleListening}
          className={cn(
            "absolute top-1/2 -translate-y-1/2 rounded-xl bg-black/5 dark:bg-white/5 py-1 px-1 transition-all duration-200",
            (isListening || isSpeechProcessing) && "animate-pulse bg-accent text-accent-foreground",
            inputValue ? "right-10" : "right-3"
          )}
        >
          <Mic className="w-4 h-4 text-black/70 dark:text-white/70" />
        </button>
        <button
          onClick={handleReset}
          type="button"
          className={cn(
            "absolute top-1/2 -translate-y-1/2 right-3",
            "rounded-xl bg-black/5 dark:bg-white/5 py-1 px-1",
            "transition-all duration-200",
            inputValue ? "opacity-100 scale-100" : "opacity-0 scale-95 pointer-events-none"
          )}
        >
          <CornerRightUp className="w-4 h-4 text-black/70 dark:text-white/70" />
        </button>
      </div>
    </div>
  );
}

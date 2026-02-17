let currentAudio: HTMLAudioElement | null = null;

export async function deepgramSpeakText(text: string): Promise<void> {
  const trimmed = (text || "").trim();
  if (!trimmed) return;
  if (typeof window === "undefined") return;
  if (!("MediaSource" in window)) {
    const res = await fetch("/api/deepgram/tts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: trimmed }),
    });
    if (!res.ok) return;
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    if (currentAudio) {
      currentAudio.pause();
      currentAudio.src = "";
    }
    currentAudio = new Audio(url);
    currentAudio.play().catch(() => {});
    return;
  }

  const startTime = performance.now();

  const res = await fetch("/api/deepgram/tts", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ text: trimmed }),
  });

  if (!res.ok || !res.body) {
    console.error("Deepgram TTS HTTP error", res.status, res.statusText);
    return;
  }

  const reader = res.body.getReader();
  let firstByteTime: number | null = null;

  const mediaSource = new MediaSource();
  const objectUrl = URL.createObjectURL(mediaSource);

  if (currentAudio) {
    currentAudio.pause();
    currentAudio.src = "";
  }

  const audio = new Audio();
  currentAudio = audio;
  audio.src = objectUrl;

  mediaSource.addEventListener("sourceopen", () => {
    const mimeCodec = "audio/mpeg";
    const sourceBuffer = mediaSource.addSourceBuffer(mimeCodec);

    const queue: Uint8Array[] = [];
    let done = false;
    let processing = false;

    const processQueue = () => {
      if (processing) return;
      if (!queue.length) {
        if (done && !sourceBuffer.updating) {
          try {
            mediaSource.endOfStream();
          } catch {}
        }
        return;
      }
      if (sourceBuffer.updating) return;
      processing = true;
      const chunk = queue.shift() as Uint8Array;
      try {
        sourceBuffer.appendBuffer(chunk as unknown as BufferSource);
      } catch {
      } finally {
        processing = false;
        processQueue();
      }
    };

    const pump = async () => {
      while (true) {
        const { done: readerDone, value } = await reader.read();
        if (readerDone) {
          done = true;
          processQueue();
          break;
        }
        if (value && value.length > 0) {
          if (firstByteTime === null) {
            firstByteTime = performance.now();
            const ttfb = Math.round(firstByteTime - startTime);
            console.log("Deepgram TTS client Time to First Byte (ms):", ttfb);
          }
          queue.push(value);
          processQueue();
        }
      }
    };

    void pump();
  });

  audio.play().catch((err) => {
    console.error("Error playing Deepgram TTS audio", err);
  });
}

export function stopDeepgramAudio(): void {
  if (currentAudio) {
    currentAudio.pause();
    currentAudio.src = "";
    currentAudio = null;
  }
}

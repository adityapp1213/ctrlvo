export async function deepgramTranscribeAudioBlob(audioBlob: Blob): Promise<string> {
  const formData = new FormData();
  formData.append("audio", audioBlob, "audio.webm");

  const res = await fetch("/api/deepgram/stt", {
    method: "POST",
    body: formData,
  });

  if (!res.ok) {
    console.error("Deepgram STT HTTP error", res.status, res.statusText);
    return "";
  }

  const data = (await res.json()) as { transcript?: string };
  return (data.transcript || "").trim();
}


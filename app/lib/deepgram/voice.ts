import type { AIInputSubmitMeta } from "@/components/ui/ai-input";
import { deepgramSpeakText } from "./tts";

export function isVoiceSource(meta?: AIInputSubmitMeta): boolean {
  return meta?.source === "voice";
}

export async function speakAssistantWithDeepgram(text: string): Promise<void> {
  await deepgramSpeakText(text);
}


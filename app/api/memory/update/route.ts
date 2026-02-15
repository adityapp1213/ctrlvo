import { NextResponse } from "next/server";
import { ConvexHttpClient } from "convex/browser";
import { GroqClient } from "@/app/lib/ai/groq/groq-client";
import { api } from "../../../../convex/_generated/api";

export const runtime = "nodejs";

type Turn = {
  role: "user" | "assistant";
  text: string;
};

type MemoryUpdateRequest = {
  chatId: string;
  userId: string;
  sessionId: string;
  turns: Turn[];
};

const MEMORY_SERVICE_URL =
  process.env.VISUAL_MEMORY_SERVICE_URL || "http://localhost:8001/memory";

export async function POST(req: Request) {
  const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;
  if (!convexUrl) {
    return new NextResponse("Missing NEXT_PUBLIC_CONVEX_URL", { status: 500 });
  }

  let body: MemoryUpdateRequest;
  try {
    body = (await req.json()) as MemoryUpdateRequest;
  } catch {
    return new NextResponse("Invalid JSON body", { status: 400 });
  }

  const { chatId, userId, sessionId, turns } = body;

  if (!chatId || !userId || !sessionId || !Array.isArray(turns) || turns.length === 0) {
    return new NextResponse("Missing required parameters", { status: 400 });
  }

  const trimmedTurns = turns
    .filter((t) => t && (t.role === "user" || t.role === "assistant"))
    .map((t) => ({
      role: t.role,
      text: String(t.text || "").slice(0, 800),
    }))
    .slice(-6);

  if (trimmedTurns.length === 0) {
    return new NextResponse("No valid turns", { status: 400 });
  }

  const conversationText = trimmedTurns
    .map((t) => `${t.role === "user" ? "User" : "Assistant"}: ${t.text}`)
    .join("\n");

  let heading = "Conversation memory";
  let bodyText = conversationText.slice(0, 1000);

  try {
    const systemInstruction = {
      parts: [
        {
          text:
            "You summarize the last few turns of a conversation into a compact visual memory card.",
        },
        {
          text:
            "Return a single JSON object with keys `heading` and `body`. Do not include any other text.",
        },
        {
          text:
            "heading: 2-4 words describing what the memory is about, e.g. 'User info', 'Trip plan', 'Debugging context'.",
        },
        {
          text:
            "body: 3-6 short bullet-style lines of plain text (no markdown), summarizing key facts for a visual card.",
        },
      ],
    };

    const result = await GroqClient.getInstance().generateContent(
      "openai/gpt-oss-120b",
      conversationText,
      { systemInstruction }
    );

    const raw = String(result?.text || "").trim();
    if (raw) {
      try {
        const parsed = JSON.parse(raw) as { heading?: string; body?: string };
        if (parsed.heading && typeof parsed.heading === "string") {
          heading = parsed.heading.slice(0, 80);
        }
        if (parsed.body && typeof parsed.body === "string") {
          bodyText = parsed.body.slice(0, 2000);
        }
      } catch {
        bodyText = raw.slice(0, 2000);
      }
    }
  } catch (err) {
    console.error("[memory/update] Groq summarization failed", err);
  }

  let imageBase64: string | null = null;

  try {
    const resp = await fetch(MEMORY_SERVICE_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chatId,
        heading,
        body: bodyText,
      }),
    });

    if (resp.ok) {
      const data = (await resp.json()) as { imageBase64?: string };
      if (data?.imageBase64 && typeof data.imageBase64 === "string") {
        imageBase64 = data.imageBase64;
      }
    } else {
      console.error("[memory/update] Pillow service error", resp.status, await resp.text());
    }
  } catch (err) {
    console.error("[memory/update] Error calling Pillow service", err);
  }

  if (!imageBase64) {
    return new NextResponse("Image generation failed", { status: 502 });
  }

  const client = new ConvexHttpClient(convexUrl);
  try {
    await client.mutation(api.visualMemory.upsertMemoryImage, {
      chatId: chatId as any,
      userId,
      sessionId,
      title: heading,
      imageData: imageBase64,
      updatedAt: Date.now(),
    });
  } catch (err) {
    console.error("[memory/update] Convex mutation failed", err);
    return new NextResponse("Convex error", { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

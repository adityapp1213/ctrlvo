import { NextRequest, NextResponse } from "next/server";

const DEEPGRAM_TTS_MODEL = process.env.DEEPGRAM_TTS_MODEL || "aura-asteria-en";

export async function POST(req: NextRequest) {
  try {
    const apiKey = process.env.DEEPGRAM_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "DEEPGRAM_API_KEY is not configured" },
        { status: 500 }
      );
    }

    const { text } = (await req.json()) as { text?: string };
    const trimmed = (text || "").trim();
    if (!trimmed) {
      return NextResponse.json(
        { error: "Missing text for TTS" },
        { status: 400 }
      );
    }

    const speakUrl = `https://api.deepgram.com/v1/speak?model=${encodeURIComponent(
      DEEPGRAM_TTS_MODEL
    )}`;

    const startTime = Date.now();

    const upstream = await fetch(speakUrl, {
      method: "POST",
      headers: {
        Authorization: `Token ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ text: trimmed }),
    });

    if (!upstream.ok || !upstream.body) {
      console.error("Deepgram TTS upstream error", upstream.status, upstream.statusText);
      return NextResponse.json(
        { error: "Deepgram TTS error" },
        { status: 500 }
      );
    }

    const { readable, writable } = new TransformStream<Uint8Array>();
    const reader = upstream.body.getReader();
    const writer = writable.getWriter();

    let firstByteLogged = false;

    (async () => {
      try {
        // Stream audio through while logging Time To First Byte (TTFB)
        // similar to the Python example's first_byte_time.
        // eslint-disable-next-line no-constant-condition
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          if (value && value.length > 0) {
            if (!firstByteLogged) {
              firstByteLogged = true;
              const ttfbMs = Date.now() - startTime;
              console.log("Deepgram TTS Time to First Byte (ms):", ttfbMs);
            }
            await writer.write(value);
          }
        }
      } catch (err) {
        console.error("Error streaming Deepgram TTS response", err);
      } finally {
        await writer.close();
      }
    })();

    return new NextResponse(readable, {
      status: 200,
      headers: {
        "Content-Type": "audio/mpeg",
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    console.error("TTS route error", err);
    return NextResponse.json(
      { error: "Unexpected error during TTS" },
      { status: 500 }
    );
  }
}


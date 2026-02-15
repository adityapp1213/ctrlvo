import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@deepgram/sdk";

const deepgramClient = createClient(process.env.DEEPGRAM_API_KEY || "");

export async function POST(req: NextRequest) {
  try {
    if (!process.env.DEEPGRAM_API_KEY) {
      return NextResponse.json(
        { error: "DEEPGRAM_API_KEY is not configured" },
        { status: 500 }
      );
    }

    const formData = await req.formData();
    const audio = formData.get("audio");

    if (!(audio instanceof Blob)) {
      return NextResponse.json(
        { error: "Missing audio file" },
        { status: 400 }
      );
    }

    const arrayBuffer = await audio.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const { result, error } = await deepgramClient.listen.prerecorded.transcribeFile(
      buffer,
      {
        model: "nova-3",
        smart_format: true,
      }
    );

    if (error) {
      console.error("Deepgram STT error", error);
      return NextResponse.json(
        { error: "Deepgram transcription error" },
        { status: 500 }
      );
    }

    const transcript =
      result.results?.channels?.[0]?.alternatives?.[0]?.transcript || "";

    return NextResponse.json({ transcript });
  } catch (err) {
    console.error("STT route error", err);
    return NextResponse.json(
      { error: "Unexpected error during transcription" },
      { status: 500 }
    );
  }
}


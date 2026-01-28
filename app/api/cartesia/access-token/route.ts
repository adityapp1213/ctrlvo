import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";

const CARTESIA_VERSION = "2025-04-16";

export async function GET() {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const apiKey = process.env.CARTESIA_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "server_misconfigured" }, { status: 500 });
  }

  const expiresIn = 60;

  const resp = await fetch("https://api.cartesia.ai/access-token", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Cartesia-Version": CARTESIA_VERSION,
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      grants: { tts: true, stt: true },
      expires_in: expiresIn,
    }),
  });

  if (!resp.ok) {
    return NextResponse.json({ error: "token_request_failed" }, { status: 502 });
  }

  const data = (await resp.json()) as { token?: string };
  if (!data?.token) {
    return NextResponse.json({ error: "invalid_token_response" }, { status: 502 });
  }

  const now = Date.now();
  return NextResponse.json({
    token: data.token,
    expiresIn,
    expiresAt: now + expiresIn * 1000,
  });
}


import { NextResponse } from "next/server";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../../../../convex/_generated/api";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;
  if (!convexUrl) {
    return new NextResponse("Missing NEXT_PUBLIC_CONVEX_URL", { status: 500 });
  }

  const url = new URL(req.url);
  const chatId = url.searchParams.get("chatId");

  if (!chatId) {
    return new NextResponse("Missing chatId", { status: 400 });
  }

  const client = new ConvexHttpClient(convexUrl);

  try {
    const doc = (await client.query(api.visualMemory.getMemoryForChat, {
      chatId: chatId as any,
    })) as null | { imageData?: string };

    if (!doc || !doc.imageData) {
      return new NextResponse("Not found", { status: 404 });
    }

    const bytes = Buffer.from(doc.imageData, "base64");

    return new NextResponse(bytes, {
      status: 200,
      headers: {
        "Content-Type": "image/png",
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    console.error("[memory/image] Convex query failed", err);
    return new NextResponse("Server error", { status: 500 });
  }
}

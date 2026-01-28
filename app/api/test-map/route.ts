import { NextRequest, NextResponse } from "next/server";
import { detectIntent } from "@/app/lib/ai/genai";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q") || "map of tokyo";
  
  try {
    const result = await detectIntent(q);
    return NextResponse.json({ query: q, result });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

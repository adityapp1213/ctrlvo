import { NextResponse } from "next/server";
import { detectIntent } from "@/app/lib/ai/genai";
import { webSearch, imageSearch, summarizeItems } from "@/app/lib/ai/search";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const q = (url.searchParams.get("q") ?? "").toString();
  const trimmed = q.trim();

  const intent = await detectIntent(trimmed);
  const web = await webSearch(trimmed);
  const images = await imageSearch(trimmed);
  const summary = await summarizeItems(web, trimmed);

  return NextResponse.json({
    ok: true,
    intent,
    webCount: web.length,
    imageCount: images.length,
    summaryLines: summary.overallSummaryLines.length,
  });
}

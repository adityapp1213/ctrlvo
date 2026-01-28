import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";

export async function POST(req: Request) {
  const { userId } = await auth();
  let payload: unknown = null;
  try {
    payload = await req.json();
  } catch {
    payload = null;
  }
  const event = {
    userId: userId ?? null,
    ...((payload && typeof payload === "object") ? payload : {}),
  };
  console.log("[analytics]", event);
  return NextResponse.json({ ok: true });
}


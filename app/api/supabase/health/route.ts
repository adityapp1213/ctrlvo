import { NextResponse } from "next/server";
import { getServerSupabase } from "@/lib/supabase-server";
import { auth } from "@clerk/nextjs/server";
import { verifyClerkToken } from "@/lib/jwt";

export async function GET() {
  try {
    const { userId, sessionId, getToken } = await auth();
    const token = (await getToken({ template: "supabase" })) || (await getToken());
    const supabase = await getServerSupabase();
    // Minimal request to validate Authorization header attachment;
    // avoids requiring specific tables existing.
    const { error } = await supabase.from("__nonexistent__").select("*").limit(1);
    let issuerOk = false;
    let claims: Record<string, unknown> | null = null;
    if (token) {
      try {
        const payload = await verifyClerkToken(token);
        issuerOk = Boolean(payload?.iss);
        claims = payload as Record<string, unknown>;
      } catch {
        issuerOk = false;
      }
    }
    return NextResponse.json({
      ok: true,
      clerk: { userId, sessionId },
      supabaseAuthHeader: "attached",
      supabaseError: error?.message ?? null,
      issuerOk,
      claims,
    });
  } catch (err: unknown) {
    let message = "unknown error";
    if (err instanceof Error && typeof err.message === "string") {
      message = err.message;
    }
    console.error("[supabase:health:error]", message);
    return NextResponse.json(
      { ok: false, error: message },
      { status: 500 }
    );
  }
}

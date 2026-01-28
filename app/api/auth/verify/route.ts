import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { verifyClerkToken } from "@/lib/jwt";

export async function GET() {
  try {
    const { getToken, userId, sessionId } = await auth();
    const token = (await getToken({ template: "supabase" })) || (await getToken());
    if (!token) {
      return NextResponse.json(
        { ok: false, error: "missing token", userId, sessionId },
        { status: 401 }
      );
    }
    const payload = await verifyClerkToken(token);
    return NextResponse.json({
      ok: true,
      userId,
      sessionId,
      issuer: payload.iss,
      subject: payload.sub,
      role: payload.role ?? null,
      exp: payload.exp,
    });
  } catch (err: unknown) {
    let message = "verification error";
    if (err instanceof Error && typeof err.message === "string") {
      message = err.message;
    }
    return NextResponse.json(
      { ok: false, error: message },
      { status: 401 }
    );
  }
}

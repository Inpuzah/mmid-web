// src/app/api/sync/route.ts
import { NextResponse } from "next/server";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const { runSync } = await import("@/lib/sync");
    const res = await runSync();
    return NextResponse.json({ ok: true, ...res });
  } catch (e: any) {
    console.error(e);
    return NextResponse.json({ ok: false, error: String(e?.message || e) }, { status: 500 });
  }
}

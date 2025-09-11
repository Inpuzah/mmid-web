import { NextResponse } from "next/server";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const { runSync } = await import("@/lib/sync");
    const res = await runSync();
    return NextResponse.json({ ok: true, ...res });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error(e);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}

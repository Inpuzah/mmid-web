// src/app/api/cron/hypixel-leaderboards/route.ts

import { NextRequest, NextResponse } from "next/server";

import { refreshAllMurderMysteryLeaderboards } from "@/lib/hypixel-leaderboards";

export const dynamic = "force-dynamic";

function isAuthorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;

  const auth = req.headers.get("authorization") || "";
  const expected = `Bearer ${secret}`;
  return auth === expected;
}

async function handle(req: NextRequest) {
  if (!process.env.CRON_SECRET) {
    return NextResponse.json(
      { ok: false, error: "CRON_SECRET env var is not configured" },
      { status: 500 },
    );
  }

  if (!isAuthorized(req)) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await refreshAllMurderMysteryLeaderboards();
    return NextResponse.json({ ok: true, result });
  } catch (e) {
    console.error("Cron refresh for hypixel leaderboards failed", e);
    return NextResponse.json({ ok: false, error: "Refresh failed" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  return handle(req);
}

export async function GET(req: NextRequest) {
  // Many cron systems only support GET.
  return handle(req);
}

// src/app/api/cron/minecraft-crawl/route.ts
//
// Batch crawler for:
// - username changes (Mojang session server)
// - skin/cape snapshots (Mojang textures + OptiFine)
//
// Designed to behave like NameMC-style crawling, but rate-limit friendly:
// process a small batch per run and prioritize the stalest entries.

import { NextRequest, NextResponse } from "next/server";

import { runMinecraftCrawlBatch } from "@/lib/minecraft-crawl";

export const dynamic = "force-dynamic";

function isAuthorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const auth = req.headers.get("authorization") || "";
  return auth === `Bearer ${secret}`;
}

function intParam(req: NextRequest, key: string, fallback: number): number {
  const v = req.nextUrl.searchParams.get(key);
  const n = v == null ? NaN : Number(v);
  return Number.isFinite(n) ? Math.trunc(n) : fallback;
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

  const limit = intParam(req, "limit", 40);
  const minAgeMinutes = intParam(req, "minAgeMinutes", 60 * 24);
  const sleepMs = intParam(req, "sleepMs", 250);

  const r = await runMinecraftCrawlBatch({ limit, minAgeMinutes, sleepMs, logEvents: false });

  if (!r.ran) {
    const status = r.error === "Crawler already running" ? 409 : 500;
    return NextResponse.json({ ok: false, error: r.error, runId: r.runId }, { status });
  }

  return NextResponse.json({ ok: true, result: r.summary, runId: r.runId });
}

export async function GET(req: NextRequest) {
  return handle(req);
}

export async function POST(req: NextRequest) {
  return handle(req);
}

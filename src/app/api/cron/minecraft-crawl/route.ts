// src/app/api/cron/minecraft-crawl/route.ts
//
// Batch crawler for:
// - username changes (Mojang session server)
// - skin/cape snapshots (Mojang textures + OptiFine)
//
// Designed to behave like NameMC-style crawling, but rate-limit friendly:
// process a small batch per run and prioritize the stalest entries.

import { NextRequest, NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { refreshMinecraftProfileSnapshot, resolveNameByUuid } from "@/lib/minecraft";
import { withPgAdvisoryLock } from "@/lib/lock";

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

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function normalizeUuid(uuid: string) {
  return uuid.replace(/-/g, "").toLowerCase();
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

  // Keep each run bounded so it works in serverless environments.
  const limit = clamp(intParam(req, "limit", 40), 1, 250);
  const minAgeMinutes = clamp(intParam(req, "minAgeMinutes", 60 * 24), 1, 60 * 24 * 30);
  const sleepMs = clamp(intParam(req, "sleepMs", 250), 0, 5000);

  const cutoff = new Date(Date.now() - minAgeMinutes * 60 * 1000);

  // One crawler at a time across deployments.
  const lock = await withPgAdvisoryLock({ key1: 44873, key2: 1 }, async () => {
    // 1) Figure out latest snapshot time per UUID
    const latestSnapshots = await prisma.minecraftProfileSnapshot.groupBy({
      by: ["uuid"],
      _max: { fetchedAt: true },
    });

    const lastByUuid = new Map<string, Date>();
    for (const row of latestSnapshots) {
      if (row._max.fetchedAt) lastByUuid.set(row.uuid, row._max.fetchedAt);
    }

    // 2) Prioritize entries with missing/old snapshots.
    //    (We do this in JS because we don't have relations between tables.)
    const entries = await prisma.mmidEntry.findMany({
      select: { uuid: true, username: true },
      orderBy: { username: "asc" },
    });

    const candidates = entries
      .map((e) => {
        const norm = normalizeUuid(e.uuid);
        const last = lastByUuid.get(norm) ?? null;
        return { ...e, norm, last };
      })
      .filter((e) => !e.last || e.last < cutoff)
      .sort((a, b) => {
        const ta = a.last ? a.last.getTime() : 0;
        const tb = b.last ? b.last.getTime() : 0;
        return ta - tb;
      })
      .slice(0, limit);

    let processed = 0;
    let snapshotted = 0;
    let usernameChanged = 0;
    let errors = 0;

    for (const e of candidates) {
      processed += 1;

      try {
        // Resolve current username from Mojang.
        const currentName = await resolveNameByUuid(e.uuid).catch(() => null);
        const newUsername = currentName?.trim() || e.username;

        // If username changed, record history + update entry.
        if (currentName && currentName.trim() && currentName.trim() !== e.username) {
          await prisma.$transaction(async (tx) => {
            await tx.mmidUsernameHistory.create({
              data: { entryUuid: e.uuid, username: e.username },
            });

            await tx.mmidEntry.update({
              where: { uuid: e.uuid },
              data: { username: currentName.trim(), lastUpdated: new Date() },
            });
          });
          usernameChanged += 1;
        }

        // Take a skin/cape snapshot (Mojang textures + OptiFine probe).
        await refreshMinecraftProfileSnapshot(e.uuid, newUsername);
        snapshotted += 1;
      } catch (err) {
        errors += 1;
        console.error("minecraft-crawl failed for", e.uuid, err);
      }

      if (sleepMs > 0) await sleep(sleepMs);
    }

    return {
      limit,
      minAgeMinutes,
      sleepMs,
      cutoff,
      candidates: candidates.length,
      processed,
      snapshotted,
      usernameChanged,
      errors,
    };
  });

  if (!lock.ran) {
    return NextResponse.json({ ok: false, error: "Crawler already running" }, { status: 409 });
  }

  return NextResponse.json({ ok: true, result: lock.value });
}

export async function GET(req: NextRequest) {
  return handle(req);
}

export async function POST(req: NextRequest) {
  return handle(req);
}

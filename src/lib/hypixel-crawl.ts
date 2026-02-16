// src/lib/hypixel-crawl.ts

import { prisma } from "@/lib/prisma";
import { withPgAdvisoryLock } from "@/lib/lock";
import { refreshPlayerSnapshotFromHypixel } from "@/lib/hypixel-player-stats";

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function normalizeUuid(uuid: string) {
  return uuid.replace(/-/g, "").toLowerCase();
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

export type HypixelCrawlBatchParams = {
  limit?: number;
  minAgeMinutes?: number;
  sleepMs?: number;

  /**
   * When true, store detailed per-player events in HypixelCrawlRunEvent.
   * Keep this off for scheduled cron runs to avoid unbounded log growth.
   */
  logEvents?: boolean;

  /**
   * Optional event hook for live dashboards.
   * Called for the same events that may be persisted when logEvents is true.
   */
  onEvent?: (evt: HypixelCrawlEvent) => void | Promise<void>;
};

export type HypixelCrawlEvent = {
  level: "info" | "warn" | "error";
  eventType:
    | "run_started"
    | "player_started"
    | "snapshot_saved"
    | "player_error"
    | "run_finished";
  runId: string;
  uuid?: string;
  username?: string;
  message?: string;
  meta?: any;
  createdAt: string;
};

export type HypixelCrawlBatchSummary = {
  limit: number;
  minAgeMinutes: number;
  sleepMs: number;
  cutoff: string;
  candidates: number;
  processed: number;
  snapshotted: number;
  errors: number;
};

export async function getHypixelCrawlQueueSize(minAgeMinutes: number): Promise<number> {
  const cutoff = new Date(Date.now() - minAgeMinutes * 60 * 1000);

  const latestSnapshots = await prisma.hypixelPlayerSnapshot.groupBy({
    by: ["uuid"],
    _max: { fetchedAt: true },
  });

  const lastByUuid = new Map<string, Date>();
  for (const row of latestSnapshots) {
    if (row._max.fetchedAt) lastByUuid.set(row.uuid, row._max.fetchedAt);
  }

  const entries = await prisma.mmidEntry.findMany({
    select: { uuid: true },
  });

  let count = 0;
  for (const e of entries) {
    const norm = normalizeUuid(e.uuid);
    const last = lastByUuid.get(norm) ?? null;
    if (!last || last < cutoff) count += 1;
  }

  return count;
}

export async function runHypixelCrawlBatch(
  params: HypixelCrawlBatchParams = {},
): Promise<{ runId: string; ran: boolean; summary?: HypixelCrawlBatchSummary; error?: string }> {
  // Keep each run bounded so it works in serverless environments.
  const limit = clamp(Math.trunc(params.limit ?? 40), 1, 250);
  const minAgeMinutes = clamp(Math.trunc(params.minAgeMinutes ?? 60 * 24), 1, 60 * 24 * 30);
  const sleepMs = clamp(Math.trunc(params.sleepMs ?? 1100), 0, 5000);

  const logEvents = Boolean(params.logEvents);

  // Create a mock run record (you can create a proper HypixelCrawlRun model if needed)
  const runId = `hypixel-crawl-${Date.now()}`;

  const emit = async (partial: Omit<HypixelCrawlEvent, "runId" | "createdAt">) => {
    const evt: HypixelCrawlEvent = {
      runId,
      createdAt: new Date().toISOString(),
      ...partial,
    };

    try {
      await params.onEvent?.(evt);
    } catch {
      // ignore
    }

    if (logEvents) {
      console.log(`[Hypixel Crawl] [${evt.level}] ${evt.eventType}: ${evt.message}`);
    }
  };

  await emit({ level: "info", eventType: "run_started", message: "Hypixel crawl run started" });

  try {
    const cutoff = new Date(Date.now() - minAgeMinutes * 60 * 1000);

    // One crawler at a time across deployments.
    const lock = await withPgAdvisoryLock({ key1: 44874, key2: 1 }, async () => {
      // 1) Figure out latest snapshot time per UUID
      const latestSnapshots = await prisma.hypixelPlayerSnapshot.groupBy({
        by: ["uuid"],
        _max: { fetchedAt: true },
      });

      const lastByUuid = new Map<string, Date>();
      for (const row of latestSnapshots) {
        if (row._max.fetchedAt) lastByUuid.set(row.uuid, row._max.fetchedAt);
      }

      // 2) Prioritize entries with missing/old snapshots.
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
      let errors = 0;

      for (const e of candidates) {
        processed += 1;

        await emit({
          level: "info",
          eventType: "player_started",
          uuid: e.uuid,
          username: e.username,
          message: `Processing ${e.username}`,
        });

        try {
          // Refresh Hypixel player snapshot
          const snapshot = await refreshPlayerSnapshotFromHypixel(e.uuid);
          snapshotted += 1;

          await emit({
            level: "info",
            eventType: "snapshot_saved",
            uuid: e.uuid,
            username: e.username,
            message: `Snapshot saved for ${e.username}`,
            meta: {
              fetchedAt: snapshot.fetchedAt?.toISOString?.() ?? undefined,
            },
          });
        } catch (err: any) {
          errors += 1;
          console.error("Hypixel crawl failed for", e.uuid, err);

          await emit({
            level: "error",
            eventType: "player_error",
            uuid: e.uuid,
            username: e.username,
            message: err?.message ?? "player crawl failed",
          });
        }

        if (sleepMs > 0) await sleep(sleepMs);
      }

      const summary: HypixelCrawlBatchSummary = {
        limit,
        minAgeMinutes,
        sleepMs,
        cutoff: cutoff.toISOString(),
        candidates: candidates.length,
        processed,
        snapshotted,
        errors,
      };

      return summary;
    });

    if (!lock.ran) {
      await emit({ level: "warn", eventType: "run_finished", message: "Crawler already running" });
      return { runId, ran: false, error: "Crawler already running" };
    }

    const summary = lock.value!;

    await emit({
      level: summary.errors > 0 ? "warn" : "info",
      eventType: "run_finished",
      message: `Run finished: processed=${summary.processed}, snapshotted=${summary.snapshotted}, errors=${summary.errors}`,
      meta: summary,
    });

    return { runId, ran: true, summary };
  } catch (err: any) {
    await emit({ level: "error", eventType: "run_finished", message: err?.message ?? "Hypixel crawl failed" });
    return { runId, ran: false, error: err?.message ?? "Hypixel crawl failed" };
  }
}

// src/lib/minecraft-crawl.ts

import { prisma } from "@/lib/prisma";
import { withPgAdvisoryLock } from "@/lib/lock";
import { refreshMinecraftProfileSnapshot, resolveNameByUuid } from "@/lib/minecraft";

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function normalizeUuid(uuid: string) {
  return uuid.replace(/-/g, "").toLowerCase();
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

export type MinecraftCrawlBatchParams = {
  limit?: number;
  minAgeMinutes?: number;
  sleepMs?: number;

  /**
   * When true, store detailed per-player events in MinecraftCrawlRunEvent.
   * Keep this off for scheduled cron runs to avoid unbounded log growth.
   */
  logEvents?: boolean;

  /**
   * Optional event hook for live dashboards.
   * Called for the same events that may be persisted when logEvents is true.
   */
  onEvent?: (evt: MinecraftCrawlEvent) => void | Promise<void>;
};

export type MinecraftCrawlEvent = {
  level: "info" | "warn" | "error";
  eventType:
    | "run_started"
    | "player_started"
    | "username_changed"
    | "snapshot_saved"
    | "player_error"
    | "run_finished";
  runId: string;
  uuid?: string;
  usernameBefore?: string;
  usernameAfter?: string;
  message?: string;
  meta?: any;
  createdAt: string;
};

export type MinecraftCrawlBatchSummary = {
  limit: number;
  minAgeMinutes: number;
  sleepMs: number;
  cutoff: string;
  candidates: number;
  processed: number;
  snapshotted: number;
  usernameChanged: number;
  errors: number;
};

export async function getMinecraftCrawlQueueSize(minAgeMinutes: number): Promise<number> {
  const cutoff = new Date(Date.now() - minAgeMinutes * 60 * 1000);

  const latestSnapshots = await prisma.minecraftProfileSnapshot.groupBy({
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

export async function runMinecraftCrawlBatch(
  params: MinecraftCrawlBatchParams = {},
): Promise<{ runId: string; ran: boolean; summary?: MinecraftCrawlBatchSummary; error?: string }> {
  // Keep each run bounded so it works in serverless environments.
  const limit = clamp(Math.trunc(params.limit ?? 40), 1, 250);
  const minAgeMinutes = clamp(Math.trunc(params.minAgeMinutes ?? 60 * 24), 1, 60 * 24 * 30);
  const sleepMs = clamp(Math.trunc(params.sleepMs ?? 250), 0, 5000);

  const logEvents = Boolean(params.logEvents);

  const run = await prisma.minecraftCrawlRun.create({
    data: { limit, minAgeMinutes, sleepMs },
    select: { id: true },
  });

  const emit = async (partial: Omit<MinecraftCrawlEvent, "runId" | "createdAt">) => {
    const evt: MinecraftCrawlEvent = {
      runId: run.id,
      createdAt: new Date().toISOString(),
      ...partial,
    };

    try {
      await params.onEvent?.(evt);
    } catch {
      // ignore
    }

    if (!logEvents) return;

    try {
      await prisma.minecraftCrawlRunEvent.create({
        data: {
          runId: run.id,
          level: evt.level,
          eventType: evt.eventType,
          uuid: evt.uuid,
          usernameBefore: evt.usernameBefore,
          usernameAfter: evt.usernameAfter,
          message: evt.message,
          meta: evt.meta,
        },
      });
    } catch {
      // best-effort
    }
  };

  await emit({ level: "info", eventType: "run_started", message: "Run started" });

  const finish = async (data: Partial<Parameters<typeof prisma.minecraftCrawlRun.update>[0]["data"]>) => {
    await prisma.minecraftCrawlRun.update({
      where: { id: run.id },
      data: { ...data, finishedAt: new Date() },
    });
  };

  try {
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

        await emit({
          level: "info",
          eventType: "player_started",
          uuid: e.uuid,
          usernameBefore: e.username,
          usernameAfter: e.username,
          message: `Processing ${e.username}`,
        });

        try {
          // Resolve current username from Mojang.
          const currentName = await resolveNameByUuid(e.uuid).catch(() => null);
          const resolved = currentName?.trim() || e.username;

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

            await emit({
              level: "info",
              eventType: "username_changed",
              uuid: e.uuid,
              usernameBefore: e.username,
              usernameAfter: currentName.trim(),
              message: `Username changed: ${e.username} -> ${currentName.trim()}`,
            });
          }

          // Take a skin/cape snapshot (Mojang textures + OptiFine probe).
          const snapshot = await refreshMinecraftProfileSnapshot(e.uuid, resolved);
          snapshotted += 1;

          await emit({
            level: "info",
            eventType: "snapshot_saved",
            uuid: e.uuid,
            usernameBefore: e.username,
            usernameAfter: resolved,
            message: `Snapshot saved for ${resolved}`,
            meta: {
              skinUrl: snapshot.skinUrl,
              mojangCapeUrl: snapshot.mojangCapeUrl,
              optifineCapeUrl: snapshot.optifineCapeUrl,
              fetchedAt: snapshot.fetchedAt?.toISOString?.() ?? undefined,
            },
          });
        } catch (err: any) {
          errors += 1;
          console.error("minecraft-crawl failed for", e.uuid, err);

          await emit({
            level: "error",
            eventType: "player_error",
            uuid: e.uuid,
            usernameBefore: e.username,
            usernameAfter: e.username,
            message: err?.message ?? "player crawl failed",
          });
        }

        if (sleepMs > 0) await sleep(sleepMs);
      }

      const summary: MinecraftCrawlBatchSummary = {
        limit,
        minAgeMinutes,
        sleepMs,
        cutoff: cutoff.toISOString(),
        candidates: candidates.length,
        processed,
        snapshotted,
        usernameChanged,
        errors,
      };

      return summary;
    });

    if (!lock.ran) {
      await finish({ ran: false, errorMessage: "Crawler already running" });
      await emit({ level: "warn", eventType: "run_finished", message: "Crawler already running" });
      return { runId: run.id, ran: false, error: "Crawler already running" };
    }

    const summary = lock.value!;
    await finish({
      ran: true,
      candidates: summary.candidates,
      processed: summary.processed,
      snapshotted: summary.snapshotted,
      usernameChanged: summary.usernameChanged,
      errors: summary.errors,
    });

    await emit({
      level: summary.errors > 0 ? "warn" : "info",
      eventType: "run_finished",
      message: `Run finished: processed=${summary.processed}, snapshotted=${summary.snapshotted}, usernameChanged=${summary.usernameChanged}, errors=${summary.errors}`,
      meta: summary,
    });

    return { runId: run.id, ran: true, summary };
  } catch (err: any) {
    await finish({ ran: false, errorMessage: err?.message ?? "Minecraft crawl failed" });
    await emit({ level: "error", eventType: "run_finished", message: err?.message ?? "Minecraft crawl failed" });
    return { runId: run.id, ran: false, error: err?.message ?? "Minecraft crawl failed" };
  }
}

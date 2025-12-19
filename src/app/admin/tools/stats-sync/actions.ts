"use server";

// src/app/admin/tools/stats-sync/actions.ts

import { getServerSession } from "next-auth";
import { authOptions } from "@/auth";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { refreshPlayerSnapshotFromHypixel } from "@/lib/hypixel-player-stats";
import type { HypixelStatsSyncSummary } from "./state";

function assertAdminOrMaintainer(role?: string | null) {
  if (!role || !["ADMIN", "MAINTAINER"].includes(role)) {
    throw new Error("Unauthorized");
  }
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const PER_PLAYER_DELAY_MS = 1000; // ~1 player/second, 2 API calls each, under Hypixel limit

export async function runHypixelStatsSync(): Promise<HypixelStatsSyncSummary> {
  const session = await getServerSession(authOptions);
  const role = (session?.user as any)?.role ?? "USER";
  assertAdminOrMaintainer(role);

  const entries = await prisma.mmidEntry.findMany({
    select: { uuid: true },
    orderBy: { username: "asc" },
  });

  const totalEntries = entries.length;
  let processed = 0;
  let updated = 0;
  let skipped = 0;
  let errors = 0;

  for (const entry of entries) {
    processed += 1;
    const uuid = entry.uuid;
    const normalized = uuid.replace(/-/g, "").toLowerCase();

    // Skip players that already have a *full* MM stats cache.
    // Older snapshots only stored a handful of fields (wins/kills/etc) which
    // makes the UI show lots of dashes. Those should be refreshed.
    const snapshot = await prisma.hypixelPlayerSnapshot.findUnique({
      where: { uuid: normalized },
      select: { mmStatsJson: true },
    });

    const stats: any = snapshot?.mmStatsJson ?? null;
    const hasModernShape =
      stats &&
      typeof stats === "object" &&
      // a few “must have” fields that indicate the snapshot was produced by the newer extractor
      ("gamesPlayed" in stats || "deaths" in stats || "tokens" in stats);

    if (hasModernShape) {
      skipped += 1;
      continue;
    }

    try {
      await refreshPlayerSnapshotFromHypixel(uuid);
      updated += 1;
    } catch (err) {
      console.error("Failed to refresh Hypixel stats for", uuid, err);
      errors += 1;
    }

    // Be conservative on top of the shared Hypixel rate limiter.
    await sleep(PER_PLAYER_DELAY_MS);
  }

  // Make sure the directory picks up fresh stats.
  revalidatePath("/directory");

  return { totalEntries, processed, updated, skipped, errors };
}

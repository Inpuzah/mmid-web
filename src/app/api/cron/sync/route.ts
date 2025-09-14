// src/app/api/cron/sync/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { resolveNameByUuid, getHypixelMeta } from "@/lib/minecraft";
import { withJobLock } from "@/lib/lock";

export const dynamic = "force-dynamic";

function envInt(name: string, def: number) {
  const v = Number(process.env[name]);
  return Number.isFinite(v) && v > 0 ? v : def;
}

export async function GET(req: Request) {
  // Simple auth (add CRON_SECRET to your .env and to your scheduler)
  const auth = req.headers.get("authorization") || "";
  const ok = auth === `Bearer ${process.env.CRON_SECRET}`;
  if (!ok) return new NextResponse("Unauthorized", { status: 401 });

  const BATCH = envInt("SYNC_BATCH_SIZE", 25);        // entries per run
  const DAYS  = envInt("SYNC_INTERVAL_DAYS", 7);      // re-check window
  const SLEEP = envInt("SYNC_PER_ENTRY_DELAY_MS", 500); // ms between players (rate-limit safety)

  const cutoff = new Date(Date.now() - DAYS * 86400_000);

  try {
    const result = await withJobLock("mmid:autosync", 5 * 60_000, async () => {
      const entries = await prisma.mmidEntry.findMany({
        where: {
          OR: [{ autoSyncedAt: null }, { autoSyncedAt: { lt: cutoff } }],
        },
        orderBy: [{ autoSyncedAt: "asc" }, { createdAt: "asc" }],
        take: BATCH,
      });

      let processed = 0;
      let updated = 0;
      for (const e of entries) {
        try {
          const [newName, hyp] = await Promise.all([
            resolveNameByUuid(e.uuid),
            getHypixelMeta(e.uuid),
          ]);

          const patch: any = { autoSyncedAt: new Date(), autoSyncError: null };
          if (newName && newName !== e.username) patch.username = newName;
          if (hyp.rank !== e.rank) patch.rank = hyp.rank;
          if (hyp.guild !== e.guild) patch.guild = hyp.guild;

          if (Object.keys(patch).length > 2) {
            await prisma.mmidEntry.update({ where: { uuid: e.uuid }, data: patch });
            updated++;
          } else {
            // touch autoSyncedAt even if no change, to avoid hot-looping the same row
            await prisma.mmidEntry.update({
              where: { uuid: e.uuid },
              data: { autoSyncedAt: patch.autoSyncedAt, autoSyncError: null },
            });
          }
        } catch (err: any) {
          await prisma.mmidEntry.update({
            where: { uuid: e.uuid },
            data: { autoSyncedAt: new Date(), autoSyncError: String(err?.message ?? err) },
          });
        } finally {
          processed++;
          // gentle pacing for Hypixel limits
          if (SLEEP > 0) await new Promise((r) => setTimeout(r, SLEEP));
        }
      }

      return { processed, updated, remaining: Math.max(0, BATCH - processed) };
    });

    return NextResponse.json({ ok: true, ...result });
  } catch (e: any) {
    const status = e?.message === "LOCKED" ? 423 : 500;
    return NextResponse.json({ ok: false, error: e?.message ?? "sync failed" }, { status });
  }
}


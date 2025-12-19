// src/app/api/admin/minecraft-crawl/status/route.ts

import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { requireMaintainer } from "@/lib/authz";
import { getMinecraftCrawlQueueSize } from "@/lib/minecraft-crawl";

export const dynamic = "force-dynamic";

function minutesAgoBucketStartUtc(minutesAgo: number) {
  const d = new Date(Date.now() - minutesAgo * 60 * 1000);
  d.setUTCSeconds(0, 0);
  return d;
}

export async function GET(req: Request) {
  await requireMaintainer();

  const url = new URL(req.url);
  const minutes = Math.max(5, Math.min(240, Number(url.searchParams.get("minutes") ?? 60) || 60));
  const since = minutesAgoBucketStartUtc(minutes - 1);

  const [runs, buckets, queue24h, queue60m, queue5m] = await Promise.all([
    prisma.minecraftCrawlRun.findMany({ orderBy: { startedAt: "desc" }, take: 25 }),
    prisma.apiRequestMetricBucket.findMany({
      where: { bucketStart: { gte: since } },
      orderBy: { bucketStart: "asc" },
    }),
    getMinecraftCrawlQueueSize(60 * 24),
    getMinecraftCrawlQueueSize(60),
    getMinecraftCrawlQueueSize(5),
  ]);

  return NextResponse.json({
    ok: true,
    minutes,
    queue: { queue24h, queue60m, queue5m },
    runs,
    buckets,
  });
}

// src/app/api/cron/hypixel-crawl/route.ts

import { NextRequest, NextResponse } from "next/server";
import { runHypixelCrawlBatch } from "@/lib/hypixel-crawl";

/**
 * Cron endpoint to automatically refresh Hypixel player snapshots.
 * 
 * Runs every 5 minutes via cron job.
 * Updates ~40 players per run with 1100ms delay = ~270 req/5min
 * SHOULD staay safely under Hypixel's 300 req/5min rate limit.
 */
export async function GET(req: NextRequest) {
  // Verify cron secret to prevent unauthorized runs
  const authHeader = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await runHypixelCrawlBatch({
      limit: 40,              // 40 entries per run
      minAgeMinutes: 60 * 24, // Update entries older than 24 hours
      sleepMs: 1100,          // 1.1s delay = ~54 req/min = 270 req/5min
      logEvents: false,       // Don't spam logs in production
    });

    return NextResponse.json({
      success: true,
      runId: result.runId,
      ran: result.ran,
      summary: result.summary,
      error: result.error,
    });
  } catch (error: any) {
    console.error("[Hypixel Crawl Cron] Error:", error);
    return NextResponse.json(
      { error: error.message || "Unknown error" },
      { status: 500 }
    );
  }
}

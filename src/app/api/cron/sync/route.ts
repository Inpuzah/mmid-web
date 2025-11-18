// src/app/api/cron/sync/route.ts
// Legacy autosync cron endpoint has been removed.
// This stub exists only to satisfy Next.js routing/TypeScript and
// always returns 410 Gone.

import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(
    {
      ok: false,
      error: "This cron sync endpoint has been removed.",
    },
    { status: 410 },
  );
}
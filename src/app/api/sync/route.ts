// src/app/api/sync/route.ts
// Legacy manual sync endpoint has been removed.
// This stub exists only to make Next.js routing/TypeScript happy and
// returns a 410 Gone response. Admins should use /admin/sync instead.

import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(
    {
      ok: false,
      error: "This sync endpoint has been removed. Use /admin/sync instead.",
    },
    { status: 410 },
  );
}
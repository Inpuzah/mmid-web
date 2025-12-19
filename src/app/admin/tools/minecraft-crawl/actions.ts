"use server";

// src/app/admin/tools/minecraft-crawl/actions.ts

import { requireMaintainer } from "@/lib/authz";
import { revalidatePath } from "next/cache";
import { runMinecraftCrawlBatch } from "@/lib/minecraft-crawl";

export async function runMinecraftCrawlAdminBatch(params: {
  limit?: number;
  minAgeMinutes?: number;
  sleepMs?: number;
}) {
  await requireMaintainer();

  const r = await runMinecraftCrawlBatch(params);

  // Make sure the directory picks up fresh usernames / profile data.
  revalidatePath("/directory");

  return r;
}

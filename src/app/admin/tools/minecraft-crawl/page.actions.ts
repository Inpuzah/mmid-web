// src/app/admin/tools/minecraft-crawl/page.actions.ts
"use server";

import { runMinecraftCrawlAdminBatch } from "./actions";
import type { MinecraftCrawlFormState } from "./state";

function intField(formData: FormData, key: string): number | undefined {
  const raw = (formData.get(key) ?? "").toString().trim();
  if (!raw) return undefined;
  const n = Number(raw);
  return Number.isFinite(n) ? Math.trunc(n) : undefined;
}

export async function minecraftCrawlAction(
  _prevState: MinecraftCrawlFormState,
  formData: FormData,
): Promise<MinecraftCrawlFormState> {
  try {
    const limit = intField(formData, "limit");
    const minAgeMinutes = intField(formData, "minAgeMinutes");
    const sleepMs = intField(formData, "sleepMs");

    const result = await runMinecraftCrawlAdminBatch({ limit, minAgeMinutes, sleepMs });

    if (!result.ran) {
      return {
        status: "error",
        runId: result.runId,
        error: result.error ?? "Minecraft crawl did not run",
      };
    }

    return {
      status: "success",
      runId: result.runId,
      summary: result.summary,
      finishedAt: new Date().toISOString(),
    };
  } catch (err: any) {
    return {
      status: "error",
      error: err?.message ?? "Minecraft crawl failed",
    };
  }
}

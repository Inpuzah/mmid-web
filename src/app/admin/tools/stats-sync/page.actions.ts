// src/app/admin/tools/stats-sync/page.actions.ts
"use server";

import { runHypixelStatsSync } from "./actions";
import type { StatsSyncFormState } from "./state";

export async function statsSyncAction(
  _prevState: StatsSyncFormState,
  _formData: FormData,
): Promise<StatsSyncFormState> {
  try {
    const summary = await runHypixelStatsSync();
    return {
      status: "success",
      summary,
      finishedAt: new Date().toISOString(),
    };
  } catch (err: any) {
    return {
      status: "error",
      error: err?.message ?? "Hypixel stats sync failed",
    };
  }
}

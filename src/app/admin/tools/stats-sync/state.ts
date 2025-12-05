// src/app/admin/tools/stats-sync/state.ts
// Shared state shape for the Hypixel stats sync admin form.

export type HypixelStatsSyncSummary = {
  totalEntries: number;
  processed: number;
  updated: number;
  skipped: number;
  errors: number;
};

export type StatsSyncFormState = {
  status: "idle" | "success" | "error";
  error?: string;
  summary?: HypixelStatsSyncSummary;
  finishedAt?: string; // ISO timestamp of last successful run
};

export const initialStatsSyncState: StatsSyncFormState = {
  status: "idle",
};

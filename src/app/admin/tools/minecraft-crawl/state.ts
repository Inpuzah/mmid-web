// src/app/admin/tools/minecraft-crawl/state.ts

export type MinecraftCrawlSummary = {
  limit: number;
  minAgeMinutes: number;
  sleepMs: number;
  cutoff: string;
  candidates: number;
  processed: number;
  snapshotted: number;
  usernameChanged: number;
  errors: number;
};

export type MinecraftCrawlFormState = {
  status: "idle" | "success" | "error";
  error?: string;
  runId?: string;
  summary?: MinecraftCrawlSummary;
  finishedAt?: string; // ISO timestamp of last successful run
};

export const initialMinecraftCrawlState: MinecraftCrawlFormState = {
  status: "idle",
};

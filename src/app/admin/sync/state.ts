// src/app/admin/sync/state.ts
// Shared (non-"use server") types and initial state for the sync form.

import type { DirectorySyncResult } from "@/lib/directory-sync";

export type SyncFormState = {
  status: "idle" | "success" | "error";
  error?: string;
  summary?: DirectorySyncResult;
  // ISO timestamp of the last successful sync in this session
  finishedAt?: string;
};

export const initialSyncState: SyncFormState = {
  status: "idle",
};
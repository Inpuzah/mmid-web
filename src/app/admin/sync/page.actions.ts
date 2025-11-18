// src/app/admin/sync/page.actions.ts
"use server";

import { syncMmidFromSheet } from "./actions";
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

// Server action used by the client-side form to trigger a destructive sync
export async function syncAction(
  _prevState: SyncFormState,
  _formData: FormData,
): Promise<SyncFormState> {
  try {
    const result = await syncMmidFromSheet();
    return {
      status: "success",
      summary: result,
      finishedAt: new Date().toISOString(),
    };
  } catch (err: any) {
    return {
      status: "error",
      error: err?.message ?? "Sync failed",
    };
  }
}

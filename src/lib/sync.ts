// src/lib/sync.ts
// Legacy entry point kept for compatibility with existing API routes.
// New implementations should prefer calling syncDirectoryFromSheet directly
// from src/lib/directory-sync.ts.

import { syncDirectoryFromSheet } from "./directory-sync";

export async function runSync() {
  // Default to non-destructive upsert mode when called via /api/sync
  const result = await syncDirectoryFromSheet("upsert");

  // Preserve previous shape roughly while adding more detail
  return {
    created: 0, // not tracked separately
    updated: result.upserts,
    skipped: result.totalRows - result.imported,
    mode: result.mode,
    imported: result.imported,
    totalRows: result.totalRows,
    deleted: result.deleted ?? 0,
  };
}

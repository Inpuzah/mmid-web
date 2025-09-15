-- Add autosync columns to MmidEntry
ALTER TABLE "MmidEntry"
  ADD COLUMN IF NOT EXISTS "autoSyncedAt" TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS "autoSyncError" TEXT;

-- Helpful index for your sync query
CREATE INDEX IF NOT EXISTS "MmidEntry_autoSyncedAt_idx" ON "MmidEntry"("autoSyncedAt");

-- JobLock table used by withJobLock()
CREATE TABLE IF NOT EXISTS "JobLock" (
  "key" TEXT PRIMARY KEY,
  "lockedUntil" TIMESTAMPTZ,
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS "JobLock_lockedUntil_idx" ON "JobLock"("lockedUntil");

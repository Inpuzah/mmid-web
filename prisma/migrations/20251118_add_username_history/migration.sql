-- CreateTable
CREATE TABLE "MmidUsernameHistory" (
  "id" TEXT NOT NULL,
  "entryUuid" TEXT NOT NULL,
  "username" TEXT NOT NULL,
  "changedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "MmidUsernameHistory_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MmidUsernameHistory_entryUuid_changedAt_idx" ON "MmidUsernameHistory"("entryUuid", "changedAt");

-- AddForeignKey
ALTER TABLE "MmidUsernameHistory"
ADD CONSTRAINT "MmidUsernameHistory_entryUuid_fkey"
FOREIGN KEY ("entryUuid") REFERENCES "MmidEntry"("uuid")
ON DELETE CASCADE ON UPDATE CASCADE;

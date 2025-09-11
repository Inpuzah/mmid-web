-- CreateTable
CREATE TABLE "public"."MmidEntry" (
    "uuid" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "guild" TEXT,
    "status" TEXT,
    "rank" TEXT,
    "typeOfCheating" TEXT[],
    "reviewedBy" TEXT,
    "confidenceScore" INTEGER,
    "redFlags" TEXT[],
    "notesEvidence" TEXT,
    "lastUpdated" TIMESTAMP(3),
    "nameMcLink" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MmidEntry_pkey" PRIMARY KEY ("uuid")
);

-- CreateIndex
CREATE INDEX "MmidEntry_username_idx" ON "public"."MmidEntry"("username");

-- CreateIndex
CREATE INDEX "MmidEntry_status_idx" ON "public"."MmidEntry"("status");

-- CreateIndex
CREATE INDEX "MmidEntry_guild_idx" ON "public"."MmidEntry"("guild");

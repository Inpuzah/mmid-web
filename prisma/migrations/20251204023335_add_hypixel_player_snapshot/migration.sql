-- CreateTable
CREATE TABLE "public"."HypixelPlayerSnapshot" (
    "uuid" TEXT NOT NULL,
    "playerJson" JSONB NOT NULL,
    "guildJson" JSONB,
    "mmStatsJson" JSONB,
    "fetchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HypixelPlayerSnapshot_pkey" PRIMARY KEY ("uuid")
);

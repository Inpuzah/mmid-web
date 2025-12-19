-- CreateTable
CREATE TABLE "public"."MinecraftCrawlRunEvent" (
    "id" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "level" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "uuid" TEXT,
    "usernameBefore" TEXT,
    "usernameAfter" TEXT,
    "message" TEXT,
    "meta" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MinecraftCrawlRunEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MinecraftCrawlRunEvent_runId_createdAt_idx" ON "public"."MinecraftCrawlRunEvent"("runId", "createdAt");

-- CreateIndex
CREATE INDEX "MinecraftCrawlRunEvent_eventType_createdAt_idx" ON "public"."MinecraftCrawlRunEvent"("eventType", "createdAt");

-- AddForeignKey
ALTER TABLE "public"."MinecraftCrawlRunEvent" ADD CONSTRAINT "MinecraftCrawlRunEvent_runId_fkey" FOREIGN KEY ("runId") REFERENCES "public"."MinecraftCrawlRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;

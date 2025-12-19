-- CreateTable
CREATE TABLE "public"."ApiRequestMetricBucket" (
    "id" TEXT NOT NULL,
    "api" TEXT NOT NULL,
    "bucketStart" TIMESTAMP(3) NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,
    "errorCount" INTEGER NOT NULL DEFAULT 0,
    "latencyMsTotal" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ApiRequestMetricBucket_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."MinecraftCrawlRun" (
    "id" TEXT NOT NULL,
    "limit" INTEGER NOT NULL,
    "minAgeMinutes" INTEGER NOT NULL,
    "sleepMs" INTEGER NOT NULL,
    "ran" BOOLEAN NOT NULL DEFAULT false,
    "candidates" INTEGER NOT NULL DEFAULT 0,
    "processed" INTEGER NOT NULL DEFAULT 0,
    "snapshotted" INTEGER NOT NULL DEFAULT 0,
    "usernameChanged" INTEGER NOT NULL DEFAULT 0,
    "errors" INTEGER NOT NULL DEFAULT 0,
    "errorMessage" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),

    CONSTRAINT "MinecraftCrawlRun_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ApiRequestMetricBucket_api_bucketStart_key" ON "public"."ApiRequestMetricBucket"("api", "bucketStart");

-- CreateIndex
CREATE INDEX "ApiRequestMetricBucket_api_bucketStart_idx" ON "public"."ApiRequestMetricBucket"("api", "bucketStart");

-- CreateIndex
CREATE INDEX "MinecraftCrawlRun_startedAt_idx" ON "public"."MinecraftCrawlRun"("startedAt");

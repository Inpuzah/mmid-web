-- CreateTable
CREATE TABLE "public"."MinecraftProfileSnapshot" (
    "id" TEXT NOT NULL,
    "uuid" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "skinUrl" TEXT,
    "mojangCapeUrl" TEXT,
    "optifineCapeUrl" TEXT,
    "texturesJson" JSONB,
    "fetchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MinecraftProfileSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MinecraftProfileSnapshot_uuid_fetchedAt_idx" ON "public"."MinecraftProfileSnapshot"("uuid", "fetchedAt");

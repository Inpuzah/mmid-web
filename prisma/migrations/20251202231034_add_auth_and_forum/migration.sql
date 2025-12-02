/*
  Warnings:

  - You are about to drop the column `autoSyncError` on the `MmidEntry` table. All the data in the column will be lost.
  - You are about to drop the column `autoSyncedAt` on the `MmidEntry` table. All the data in the column will be lost.
  - You are about to drop the `JobLock` table. If the table is not empty, all the data it contains will be lost.

*/
-- CreateEnum
CREATE TYPE "public"."ProposalStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "public"."ProposalAction" AS ENUM ('CREATE', 'UPDATE', 'DELETE');

-- CreateEnum
CREATE TYPE "public"."AuditAction" AS ENUM ('PROPOSAL_CREATED', 'PROPOSAL_APPROVED', 'PROPOSAL_REJECTED', 'ENTRY_CREATED', 'ENTRY_UPDATED', 'ENTRY_DELETED', 'USER_ROLE_CHANGED', 'AUTH_SIGNIN', 'FORUM_THREAD_CREATED', 'FORUM_THREAD_UPDATED', 'FORUM_THREAD_DELETED', 'FORUM_THREAD_LOCKED', 'FORUM_THREAD_UNLOCKED', 'FORUM_THREAD_PINNED', 'FORUM_THREAD_UNPINNED', 'FORUM_POST_CREATED', 'FORUM_POST_UPDATED', 'FORUM_POST_DELETED');

-- CreateEnum
CREATE TYPE "public"."Role" AS ENUM ('USER', 'MAINTAINER', 'ADMIN');

-- DropIndex
DROP INDEX "public"."MmidEntry_autoSyncedAt_idx";

-- AlterTable
ALTER TABLE "public"."MmidEntry" DROP COLUMN "autoSyncError",
DROP COLUMN "autoSyncedAt";

-- DropTable
DROP TABLE "public"."JobLock";

-- CreateTable
CREATE TABLE "public"."MmidEntryVote" (
    "id" TEXT NOT NULL,
    "entryUuid" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "value" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MmidEntryVote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."HypixelMmLeaderboardSnapshot" (
    "id" TEXT NOT NULL,
    "stat" TEXT NOT NULL,
    "scope" TEXT NOT NULL,
    "dataJson" JSONB NOT NULL,
    "fetchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HypixelMmLeaderboardSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."MmidEntryProposal" (
    "id" TEXT NOT NULL,
    "action" "public"."ProposalAction" NOT NULL,
    "status" "public"."ProposalStatus" NOT NULL DEFAULT 'PENDING',
    "targetUuid" TEXT,
    "proposedData" JSONB NOT NULL,
    "proposerId" TEXT NOT NULL,
    "reviewedById" TEXT,
    "reviewComment" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "appliedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MmidEntryProposal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."AuditLog" (
    "id" TEXT NOT NULL,
    "action" "public"."AuditAction" NOT NULL,
    "actorId" TEXT,
    "targetType" TEXT,
    "targetId" TEXT,
    "meta" JSONB,
    "ip" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."User" (
    "id" TEXT NOT NULL,
    "name" TEXT,
    "email" TEXT,
    "emailVerified" TIMESTAMP(3),
    "image" TEXT,
    "role" "public"."Role" NOT NULL DEFAULT 'USER',
    "discordId" TEXT,
    "showVoteHistoryOnProfile" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ForumThread" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "isAnnouncement" BOOLEAN NOT NULL DEFAULT false,
    "isLocked" BOOLEAN NOT NULL DEFAULT false,
    "isPinned" BOOLEAN NOT NULL DEFAULT false,
    "views" INTEGER NOT NULL DEFAULT 0,
    "replyCount" INTEGER NOT NULL DEFAULT 0,
    "lastActivityAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ForumThread_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ForumPost" (
    "id" TEXT NOT NULL,
    "threadId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ForumPost_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Account" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerAccountId" TEXT NOT NULL,
    "refresh_token" TEXT,
    "access_token" TEXT,
    "expires_at" INTEGER,
    "token_type" TEXT,
    "scope" TEXT,
    "id_token" TEXT,
    "session_state" TEXT,

    CONSTRAINT "Account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Session" (
    "id" TEXT NOT NULL,
    "sessionToken" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."VerificationToken" (
    "identifier" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL
);

-- CreateIndex
CREATE INDEX "MmidEntryVote_entryUuid_idx" ON "public"."MmidEntryVote"("entryUuid");

-- CreateIndex
CREATE INDEX "MmidEntryVote_userId_idx" ON "public"."MmidEntryVote"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "MmidEntryVote_entryUuid_userId_key" ON "public"."MmidEntryVote"("entryUuid", "userId");

-- CreateIndex
CREATE INDEX "HypixelMmLeaderboardSnapshot_stat_scope_fetchedAt_idx" ON "public"."HypixelMmLeaderboardSnapshot"("stat", "scope", "fetchedAt");

-- CreateIndex
CREATE INDEX "MmidEntryProposal_status_idx" ON "public"."MmidEntryProposal"("status");

-- CreateIndex
CREATE INDEX "MmidEntryProposal_targetUuid_idx" ON "public"."MmidEntryProposal"("targetUuid");

-- CreateIndex
CREATE INDEX "MmidEntryProposal_proposerId_idx" ON "public"."MmidEntryProposal"("proposerId");

-- CreateIndex
CREATE INDEX "MmidEntryProposal_createdAt_idx" ON "public"."MmidEntryProposal"("createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_createdAt_idx" ON "public"."AuditLog"("createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_action_idx" ON "public"."AuditLog"("action");

-- CreateIndex
CREATE INDEX "AuditLog_targetType_targetId_idx" ON "public"."AuditLog"("targetType", "targetId");

-- CreateIndex
CREATE INDEX "AuditLog_actorId_idx" ON "public"."AuditLog"("actorId");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "public"."User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_discordId_key" ON "public"."User"("discordId");

-- CreateIndex
CREATE INDEX "ForumThread_isAnnouncement_isPinned_lastActivityAt_idx" ON "public"."ForumThread"("isAnnouncement", "isPinned", "lastActivityAt");

-- CreateIndex
CREATE INDEX "ForumThread_authorId_idx" ON "public"."ForumThread"("authorId");

-- CreateIndex
CREATE INDEX "ForumPost_threadId_createdAt_idx" ON "public"."ForumPost"("threadId", "createdAt");

-- CreateIndex
CREATE INDEX "ForumPost_authorId_idx" ON "public"."ForumPost"("authorId");

-- CreateIndex
CREATE INDEX "Account_userId_idx" ON "public"."Account"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Account_provider_providerAccountId_key" ON "public"."Account"("provider", "providerAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "Session_sessionToken_key" ON "public"."Session"("sessionToken");

-- CreateIndex
CREATE INDEX "Session_userId_idx" ON "public"."Session"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "VerificationToken_token_key" ON "public"."VerificationToken"("token");

-- CreateIndex
CREATE UNIQUE INDEX "VerificationToken_identifier_token_key" ON "public"."VerificationToken"("identifier", "token");

-- AddForeignKey
ALTER TABLE "public"."MmidEntryVote" ADD CONSTRAINT "MmidEntryVote_entryUuid_fkey" FOREIGN KEY ("entryUuid") REFERENCES "public"."MmidEntry"("uuid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."MmidEntryVote" ADD CONSTRAINT "MmidEntryVote_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."MmidEntryProposal" ADD CONSTRAINT "MmidEntryProposal_targetUuid_fkey" FOREIGN KEY ("targetUuid") REFERENCES "public"."MmidEntry"("uuid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."MmidEntryProposal" ADD CONSTRAINT "MmidEntryProposal_proposerId_fkey" FOREIGN KEY ("proposerId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."MmidEntryProposal" ADD CONSTRAINT "MmidEntryProposal_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."AuditLog" ADD CONSTRAINT "AuditLog_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ForumThread" ADD CONSTRAINT "ForumThread_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ForumPost" ADD CONSTRAINT "ForumPost_threadId_fkey" FOREIGN KEY ("threadId") REFERENCES "public"."ForumThread"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ForumPost" ADD CONSTRAINT "ForumPost_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Account" ADD CONSTRAINT "Account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

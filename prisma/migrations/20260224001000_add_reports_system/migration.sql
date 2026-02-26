CREATE TYPE "ReportSeverity" AS ENUM ('LOW', 'MED', 'HI');
CREATE TYPE "ReportStatus" AS ENUM ('SUBMITTED', 'UNDER_REVIEW', 'APPROVED_FOR_MAINTAINER', 'REJECTED', 'RESOLVED');

CREATE TABLE "Report" (
  "id" TEXT NOT NULL,
  "reporterId" TEXT NOT NULL,
  "subjectUsername" TEXT NOT NULL,
  "subjectUuid" TEXT,
  "subjectRank" TEXT,
  "subjectGuild" TEXT,
  "reason" TEXT NOT NULL,
  "severity" "ReportSeverity" NOT NULL,
  "evidenceDescription" TEXT NOT NULL,
  "status" "ReportStatus" NOT NULL DEFAULT 'SUBMITTED',
  "reviewedById" TEXT,
  "reviewDecisionNote" TEXT,
  "reviewedAt" TIMESTAMP(3),
  "approvedAt" TIMESTAMP(3),
  "resolvedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "Report_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ReportReplayEvidence" (
  "id" TEXT NOT NULL,
  "reportId" TEXT NOT NULL,
  "replayId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "ReportReplayEvidence_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ReportVideoEvidence" (
  "id" TEXT NOT NULL,
  "reportId" TEXT NOT NULL,
  "url" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "ReportVideoEvidence_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ReportAttachment" (
  "id" TEXT NOT NULL,
  "reportId" TEXT NOT NULL,
  "originalName" TEXT NOT NULL,
  "mimeType" TEXT,
  "sizeBytes" INTEGER NOT NULL,
  "storagePath" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "ReportAttachment_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ReportMaintainerNote" (
  "id" TEXT NOT NULL,
  "reportId" TEXT NOT NULL,
  "authorId" TEXT NOT NULL,
  "note" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "ReportMaintainerNote_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Report_status_createdAt_idx" ON "Report"("status", "createdAt");
CREATE INDEX "Report_severity_createdAt_idx" ON "Report"("severity", "createdAt");
CREATE INDEX "Report_subjectUsername_idx" ON "Report"("subjectUsername");
CREATE INDEX "Report_reporterId_createdAt_idx" ON "Report"("reporterId", "createdAt");

CREATE INDEX "ReportReplayEvidence_reportId_createdAt_idx" ON "ReportReplayEvidence"("reportId", "createdAt");
CREATE INDEX "ReportVideoEvidence_reportId_createdAt_idx" ON "ReportVideoEvidence"("reportId", "createdAt");
CREATE INDEX "ReportAttachment_reportId_createdAt_idx" ON "ReportAttachment"("reportId", "createdAt");
CREATE INDEX "ReportMaintainerNote_reportId_createdAt_idx" ON "ReportMaintainerNote"("reportId", "createdAt");
CREATE INDEX "ReportMaintainerNote_authorId_createdAt_idx" ON "ReportMaintainerNote"("authorId", "createdAt");

ALTER TABLE "Report"
  ADD CONSTRAINT "Report_reporterId_fkey"
  FOREIGN KEY ("reporterId") REFERENCES "User"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Report"
  ADD CONSTRAINT "Report_reviewedById_fkey"
  FOREIGN KEY ("reviewedById") REFERENCES "User"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ReportReplayEvidence"
  ADD CONSTRAINT "ReportReplayEvidence_reportId_fkey"
  FOREIGN KEY ("reportId") REFERENCES "Report"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ReportVideoEvidence"
  ADD CONSTRAINT "ReportVideoEvidence_reportId_fkey"
  FOREIGN KEY ("reportId") REFERENCES "Report"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ReportAttachment"
  ADD CONSTRAINT "ReportAttachment_reportId_fkey"
  FOREIGN KEY ("reportId") REFERENCES "Report"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ReportMaintainerNote"
  ADD CONSTRAINT "ReportMaintainerNote_reportId_fkey"
  FOREIGN KEY ("reportId") REFERENCES "Report"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ReportMaintainerNote"
  ADD CONSTRAINT "ReportMaintainerNote_authorId_fkey"
  FOREIGN KEY ("authorId") REFERENCES "User"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

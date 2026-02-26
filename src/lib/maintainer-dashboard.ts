import { prisma } from "@/lib/prisma";
import { isReportSchemaReady } from "@/lib/report-schema";

export type MaintainerTab = "overview" | "intake" | "directory" | "stale" | "analytics";
export type ActivityFilter = "all" | "reports" | "directory" | "stale";

export type MaintainerActivityItem = {
  id: string;
  kind: ActivityFilter;
  time: Date;
  action: string;
  target: string;
  actor: string;
  href: string;
  notes: string;
};

export type MaintainerShellContext = {
  reportsReady: boolean;
  pendingReports: number;
  approvedReports: number;
  staleCount: number;
};

function startOfDay(date: Date): Date {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
}

async function supportsMaintainerDraftStatus(reportDb: any): Promise<boolean> {
  try {
    await reportDb.report.count({ where: { status: "MAINTAINER_DRAFT" } });
    return true;
  } catch {
    return false;
  }
}

export async function getMaintainerShellContext(): Promise<MaintainerShellContext> {
  const reportDb = prisma as any;
  const reportsReady = await isReportSchemaReady();
  const staleThreshold = new Date(Date.now() - 1000 * 60 * 60 * 24 * 30);

  const [pendingReports, approvedReports, staleCount] = await Promise.all([
    reportsReady
      ? reportDb.report.count({ where: { status: { in: ["SUBMITTED", "UNDER_REVIEW"] } } })
      : Promise.resolve(0),
    reportsReady
      ? reportDb.report.count({ where: { status: "APPROVED_FOR_MAINTAINER" } })
      : Promise.resolve(0),
    prisma.mmidEntry.count({
      where: {
        OR: [{ lastUpdated: null }, { lastUpdated: { lt: staleThreshold } }],
      },
    }),
  ]);

  return {
    reportsReady,
    pendingReports,
    approvedReports,
    staleCount,
  };
}

export async function getMaintainerOverviewData(activityFilter: ActivityFilter = "all") {
  const reportDb = prisma as any;
  const reportsReady = await isReportSchemaReady();
  const supportsDraftStatus = reportsReady ? await supportsMaintainerDraftStatus(reportDb) : false;

  const now = new Date();
  const staleThreshold = new Date(now.getTime() - 1000 * 60 * 60 * 24 * 30);
  const staleEscalationThreshold = new Date(now.getTime() - 1000 * 60 * 60 * 24 * 60);
  const fourteenDaysAgo = new Date(now.getTime() - 1000 * 60 * 60 * 24 * 14);
  const oneDayAgo = new Date(now.getTime() - 1000 * 60 * 60 * 24);
  const todayStart = startOfDay(now);

  const [
    entries,
    pendingReports,
    approvedReports,
    draftReports,
    recentApproved,
    staleEntries,
    totalReports,
    resolvedReports,
    recentDecisions,
    recentEntryUpdates,
    resolvedLast24h,
    reviewSamples,
    oldestPendingReport,
  ] = await Promise.all([
    prisma.mmidEntry.count(),
    reportsReady
      ? reportDb.report.count({ where: { status: { in: ["SUBMITTED", "UNDER_REVIEW"] } } })
      : Promise.resolve(0),
    reportsReady
      ? reportDb.report.count({ where: { status: "APPROVED_FOR_MAINTAINER" } })
      : Promise.resolve(0),
    reportsReady
      ? supportsDraftStatus
        ? reportDb.report.count({ where: { status: "MAINTAINER_DRAFT" } })
        : Promise.resolve(0)
      : Promise.resolve(0),
    reportsReady
      ? reportDb.report.findMany({
          where: {
            status: {
              in: supportsDraftStatus
                ? ["APPROVED_FOR_MAINTAINER", "MAINTAINER_DRAFT"]
                : ["APPROVED_FOR_MAINTAINER"],
            },
          },
          select: {
            id: true,
            subjectUsername: true,
            subjectUuid: true,
            reason: true,
            evidenceDescription: true,
            severity: true,
            approvedAt: true,
            reviewedBy: { select: { name: true, email: true } },
            replayEvidence: { select: { id: true, replayId: true } },
            videoEvidence: { select: { id: true, url: true } },
            attachments: { select: { id: true, originalName: true, storagePath: true, sizeBytes: true, hideFromDirectory: true } },
            maintainerNotes: {
              select: { id: true, note: true, createdAt: true },
              orderBy: { createdAt: "desc" },
              take: 5,
            },
          },
          take: 12,
          orderBy: [{ status: "asc" }, { approvedAt: "desc" }, { updatedAt: "desc" }],
        })
      : Promise.resolve([]),
    prisma.mmidEntry.findMany({
      where: {
        OR: [{ lastUpdated: null }, { lastUpdated: { lt: staleThreshold } }],
      },
      select: {
        uuid: true,
        username: true,
        lastUpdated: true,
        status: true,
        redFlags: true,
      },
      orderBy: [{ lastUpdated: "asc" }, { username: "asc" }],
      take: 60,
    }),
    reportsReady ? reportDb.report.count() : Promise.resolve(0),
    reportsReady ? reportDb.report.count({ where: { status: "RESOLVED" } }) : Promise.resolve(0),
    reportsReady
      ? reportDb.report.findMany({
          where: { status: { in: ["APPROVED_FOR_MAINTAINER", "REJECTED", "RESOLVED"] } },
          select: {
            id: true,
            subjectUsername: true,
            status: true,
            reviewedAt: true,
            resolvedAt: true,
            reviewedBy: { select: { name: true, email: true } },
          },
          orderBy: { reviewedAt: "desc" },
          take: 150,
        })
      : Promise.resolve([]),
    prisma.mmidEntry.findMany({
      where: { lastUpdated: { not: null } },
      select: { uuid: true, username: true, lastUpdated: true },
      orderBy: { lastUpdated: "desc" },
      take: 120,
    }),
    reportsReady
      ? reportDb.report.count({ where: { status: "RESOLVED", resolvedAt: { gte: oneDayAgo } } })
      : Promise.resolve(0),
    reportsReady
      ? reportDb.report.findMany({
          where: { reviewedAt: { not: null } },
          select: {
            createdAt: true,
            reviewedAt: true,
            reviewedById: true,
          },
          orderBy: { reviewedAt: "desc" },
          take: 500,
        })
      : Promise.resolve([]),
    reportsReady
      ? reportDb.report.findFirst({
          where: { status: { in: ["SUBMITTED", "UNDER_REVIEW"] } },
          select: { createdAt: true },
          orderBy: { createdAt: "asc" },
        })
      : Promise.resolve(null),
  ]);

  const staleEscalated = staleEntries.filter((entry) => !entry.lastUpdated || entry.lastUpdated < staleEscalationThreshold).length;
  const staleOver14 = staleEntries.filter((entry) => !entry.lastUpdated || entry.lastUpdated < fourteenDaysAgo).length;
  const staleAges = staleEntries.map((entry) => {
    if (!entry.lastUpdated) return 365;
    return Math.floor((Date.now() - entry.lastUpdated.getTime()) / (1000 * 60 * 60 * 24));
  });
  const oldestStaleDays = staleAges.length > 0 ? Math.max(...staleAges) : 0;

  const reviewedWithTiming = reviewSamples.filter((sample: any) => sample.createdAt && sample.reviewedAt);
  const avgReviewLatencyMs =
    reviewedWithTiming.length > 0
      ? reviewedWithTiming.reduce((sum: number, sample: any) => sum + (sample.reviewedAt.getTime() - sample.createdAt.getTime()), 0) /
        reviewedWithTiming.length
      : 0;

  const staffActiveToday = new Set(
    reviewSamples
      .filter((sample: any) => sample.reviewedAt && sample.reviewedAt >= todayStart && sample.reviewedById)
      .map((sample: any) => sample.reviewedById)
  ).size;

  const allActivityItems: MaintainerActivityItem[] = [
    ...recentDecisions
      .filter((item: any) => Boolean(item.reviewedAt || item.resolvedAt))
      .map((item: any) => {
        const actor = item.reviewedBy?.name ?? item.reviewedBy?.email ?? "Officer";
        const action =
          item.status === "APPROVED_FOR_MAINTAINER"
            ? "Approved report"
            : item.status === "REJECTED"
              ? "Rejected report"
              : "Resolved report";
        const notes =
          item.status === "APPROVED_FOR_MAINTAINER"
            ? "Sent to report intake"
            : item.status === "REJECTED"
              ? "Closed after replay review"
              : "Resolved after evidence review";

        return {
          id: `report-${item.id}`,
          kind: "reports",
          time: (item.resolvedAt ?? item.reviewedAt) as Date,
          action,
          target: item.subjectUsername,
          actor,
          href: `/maintainer/queue/${item.id}`,
          notes,
        } satisfies MaintainerActivityItem;
      }),
    ...recentEntryUpdates
      .filter((entry) => Boolean(entry.lastUpdated))
      .map((entry) => ({
        id: `entry-${entry.uuid}`,
        kind: "directory",
        time: entry.lastUpdated as Date,
        action: "Updated entry",
        target: entry.username,
        actor: "System",
        href: `/directory?view=cards&entryUuid=${encodeURIComponent(entry.uuid)}`,
        notes: "Directory details were refreshed",
      } satisfies MaintainerActivityItem)),
    ...staleEntries
      .filter((entry) => Boolean(entry.lastUpdated))
      .map((entry) => ({
        id: `stale-${entry.uuid}`,
        kind: "stale",
        time: entry.lastUpdated as Date,
        action: "Stale marked",
        target: entry.username,
        actor: "System",
        href: `/directory?view=cards&entryUuid=${encodeURIComponent(entry.uuid)}`,
        notes: "Marked stale due to inactivity",
      } satisfies MaintainerActivityItem)),
  ];

  const activityItems = allActivityItems
    .slice()
    .sort((a, b) => b.time.getTime() - a.time.getTime())
    .filter((item) => (activityFilter === "all" ? true : item.kind === activityFilter));

  const trendBuckets = Array.from({ length: 7 }, (_, index) => {
    const dayStart = new Date(todayStart);
    dayStart.setDate(dayStart.getDate() - (6 - index));
    const dayEnd = new Date(dayStart);
    dayEnd.setDate(dayEnd.getDate() + 1);

    const count = allActivityItems.filter((item) => item.time >= dayStart && item.time < dayEnd).length;
    return { day: dayStart, count };
  });

  const trendMax = Math.max(...trendBuckets.map((bucket) => bucket.count), 1);
  const trendPoints = trendBuckets
    .map((bucket, index) => {
      const x = (index / 6) * 100;
      const y = 100 - (bucket.count / trendMax) * 80;
      return `${x},${y}`;
    })
    .join(" ");

  const lastThreeTrend = trendBuckets.slice(4).reduce((sum, bucket) => sum + bucket.count, 0);
  const priorThreeTrend = trendBuckets.slice(1, 4).reduce((sum, bucket) => sum + bucket.count, 0);

  return {
    reportsReady,
    entries,
    pendingReports,
    approvedReports,
    draftReports,
    recentApproved,
    staleEntries,
    totalReports,
    resolvedReports,
    resolvedLast24h,
    staleEscalated,
    staleOver14,
    oldestStaleDays,
    oldestPendingCreatedAt: oldestPendingReport?.createdAt ?? null,
    avgReviewLatencyHours: avgReviewLatencyMs > 0 ? `${(avgReviewLatencyMs / (1000 * 60 * 60)).toFixed(1)}h` : "No samples",
    avgReviewLatencyDays: avgReviewLatencyMs > 0 ? `${(avgReviewLatencyMs / (1000 * 60 * 60 * 24)).toFixed(1)}d` : "No samples",
    staffActiveToday,
    trendBuckets,
    trendPoints,
    trendImproving: lastThreeTrend >= priorThreeTrend,
    activityItems,
  };
}

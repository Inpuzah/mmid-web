import Link from "next/link";
import { requireMaintainerDashboardAccess } from "@/lib/authz";
import { prisma } from "@/lib/prisma";
import { isReportSchemaReady } from "@/lib/report-schema";
import { approveReport, rejectReport } from "./actions";
import SeverityBadge from "@/components/reports/SeverityBadge";
import ExpiryIndicator from "@/components/reports/ExpiryIndicator";
import RoleBadge from "@/components/reports/RoleBadge";
import CopyValueButton from "@/components/reports/CopyValueButton.client";

type ViewMode = "queue" | "approved" | "rejected" | "stats";

function replayWindowMs(rank?: string | null) {
  const value = String(rank ?? "").toUpperCase();
  if (!value || value === "NONE" || value === "NO RANK" || value === "DEFAULT") {
    return 30 * 60 * 1000;
  }
  if (value.includes("VIP+")) {
    return 2 * 24 * 60 * 60 * 1000;
  }
  if (value.includes("VIP")) {
    return 24 * 60 * 60 * 1000;
  }
  return 2 * 24 * 60 * 60 * 1000;
}

function severityWeight(value: "LOW" | "MED" | "HI") {
  if (value === "HI") return 3;
  if (value === "MED") return 2;
  return 1;
}

function avgHours(msTotal: number, count: number) {
  if (!count) return "0.0";
  return (msTotal / count / (1000 * 60 * 60)).toFixed(1);
}

function formatRemaining(ms: number) {
  if (ms <= 0) return "Expired";

  const totalMinutes = Math.floor(ms / (1000 * 60));
  const days = Math.floor(totalMinutes / (60 * 24));
  const hours = Math.floor((totalMinutes % (60 * 24)) / 60);
  const minutes = totalMinutes % 60;

  if (days > 0) return `${days}d ${hours}h left`;
  if (hours > 0) return `${hours}h ${minutes}m left`;
  return `${minutes}m left`;
}

function formatReplayWindow(ms: number) {
  const hours = ms / (1000 * 60 * 60);
  if (hours < 1) return "30m";
  if (hours % 24 === 0) return `${hours / 24}d`;
  return `${hours}h`;
}

export default async function MaintainerReportsPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { role } = await requireMaintainerDashboardAccess();
  const reportsReady = await isReportSchemaReady();
  if (!reportsReady) {
    return (
      <div className="space-y-4">
        <h1 className="text-xl font-extrabold text-slate-100">
          Reports Queue
        </h1>
        <div className="mt-4 rounded-[4px] border border-slate-700/80 bg-slate-950/80 px-4 py-3 text-sm text-slate-200">
          Report system tables are missing in this database. Run `npx prisma migrate deploy`.
        </div>
      </div>
    );
  }

  const resolved = (await searchParams) ?? {};
  const requestedView = Array.isArray(resolved.view) ? resolved.view[0] : resolved.view;
  const view: ViewMode = ["approved", "rejected", "stats"].includes(String(requestedView))
    ? (requestedView as ViewMode)
    : "queue";

  const reportDb = prisma as any;
  const [queueReports, approvedReports, rejectedReports, totals] = await Promise.all([
    reportDb.report.findMany({
      where: { status: { in: ["SUBMITTED", "UNDER_REVIEW"] } },
      include: {
        reporter: { select: { name: true, email: true } },
        replayEvidence: true,
        videoEvidence: true,
        attachments: true,
      },
      orderBy: { createdAt: "asc" },
    }),
    reportDb.report.findMany({
      where: { status: "APPROVED_FOR_MAINTAINER" },
      include: {
        reporter: { select: { name: true, email: true } },
        replayEvidence: true,
        videoEvidence: true,
        attachments: true,
        reviewedBy: { select: { name: true, email: true } },
      },
      orderBy: { approvedAt: "desc" },
      take: 100,
    }),
    reportDb.report.findMany({
      where: { status: "REJECTED" },
      include: {
        reporter: { select: { name: true, email: true } },
        replayEvidence: true,
        videoEvidence: true,
        attachments: true,
        reviewedBy: { select: { name: true, email: true } },
      },
      orderBy: { reviewedAt: "desc" },
      take: 100,
    }),
    Promise.all([
      reportDb.report.count(),
      reportDb.report.count({ where: { status: { in: ["SUBMITTED", "UNDER_REVIEW"] } } }),
      reportDb.report.count({ where: { status: "APPROVED_FOR_MAINTAINER" } }),
      reportDb.report.count({ where: { status: "REJECTED" } }),
      reportDb.report.findMany({
        where: { approvedAt: { not: null }, reviewedAt: { not: null } },
        select: { approvedAt: true, createdAt: true },
        take: 200,
      }),
    ]),
  ]);

  const prioritized = queueReports
    .map((report: any) => {
      const expiresAt = new Date(report.createdAt.getTime() + replayWindowMs(report.subjectRank));
      return { report, expiresAt };
    })
    .sort((a: any, b: any) => {
      const expiryDiff = a.expiresAt.getTime() - b.expiresAt.getTime();
      if (expiryDiff !== 0) return expiryDiff;

      const severityDiff = severityWeight(b.report.severity) - severityWeight(a.report.severity);
      if (severityDiff !== 0) return severityDiff;

      return a.report.createdAt.getTime() - b.report.createdAt.getTime();
    });

  const [totalReports, pendingCount, approvedCount, rejectedCount, avgSamples] = totals;
  const canReview = role === "ADMIN" || role === "REPLAY_OFFICER";
  const nextOfficerAction =
    pendingCount > 0
      ? `Triage ${pendingCount} pending report${pendingCount === 1 ? "" : "s"} now.`
      : "Queue is clear. No pending reports 🎉";

  const nextMaintainerAction =
    approvedCount > 0
      ? `${approvedCount} approved report${approvedCount === 1 ? " is" : "s are"} waiting for maintainer intake.`
      : "No reports waiting for maintainer intake.";

  const approvalMsTotal = (avgSamples as Array<{ approvedAt: Date; createdAt: Date }>).reduce(
    (acc, row) => acc + (row.approvedAt.getTime() - row.createdAt.getTime()),
    0,
  );

  return (
    <div className="space-y-4">
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <h1 className="text-2xl font-black text-slate-100">
          Replay Officer Workspace
        </h1>
        <RoleBadge role={role} />
      </div>

      <section className="mb-4 grid gap-3 lg:grid-cols-3">
        <article className="rounded-[4px] border border-slate-700/80 bg-slate-950/80 p-3">
          <p className="text-xs font-semibold text-slate-300">What Now</p>
          <p className="mt-1 text-sm text-slate-200">{nextOfficerAction}</p>
        </article>
        <article className="rounded-[4px] border border-slate-700/80 bg-slate-950/80 p-3">
          <p className="text-xs font-semibold text-slate-300">What Next</p>
          <p className="mt-1 text-sm text-slate-200">{nextMaintainerAction}</p>
        </article>
        <article className="rounded-[4px] border border-slate-700/80 bg-slate-950/80 p-3">
          <p className="text-xs font-semibold text-slate-300">Progress Snapshot</p>
          <p className="mt-1 text-sm text-slate-200">
            {approvedCount + rejectedCount} decided · Avg approval {avgHours(approvalMsTotal, avgSamples.length)}h
          </p>
        </article>
      </section>

      <div className="grid items-start gap-4 lg:grid-cols-[260px_minmax(0,1fr)] xl:grid-cols-[300px_minmax(0,1fr)]">
        <aside className="space-y-2 rounded-[4px] border border-slate-700/80 bg-slate-950/85 p-3 lg:sticky lg:top-20">
          <div className="text-[11px] uppercase tracking-[0.16em] text-slate-400">Officer</div>
          <Link href="/maintainer/reports?view=queue" className={`block rounded-[3px] border px-3 py-2 text-sm ${view === "queue" ? "border-slate-500 bg-slate-800 text-slate-100" : "border-slate-700 bg-slate-900/50 text-slate-200 hover:bg-slate-800/70"}`}>
            Queue ({pendingCount})
          </Link>
          <Link href="/maintainer/reports?view=approved" className={`block rounded-[3px] border px-3 py-2 text-sm ${view === "approved" ? "border-slate-500 bg-slate-800 text-slate-100" : "border-slate-700 bg-slate-900/50 text-slate-200 hover:bg-slate-800/70"}`}>
            Approved ({approvedCount})
          </Link>
          <Link href="/maintainer/reports?view=rejected" className={`block rounded-[3px] border px-3 py-2 text-sm ${view === "rejected" ? "border-slate-500 bg-slate-800 text-slate-100" : "border-slate-700 bg-slate-900/50 text-slate-200 hover:bg-slate-800/70"}`}>
            Rejected ({rejectedCount})
          </Link>
          <Link href="/maintainer/reports?view=stats" className={`block rounded-[3px] border px-3 py-2 text-sm ${view === "stats" ? "border-slate-500 bg-slate-800 text-slate-100" : "border-slate-700 bg-slate-900/50 text-slate-200 hover:bg-slate-800/70"}`}>
            Stats
          </Link>
          <div className="rounded-[3px] border border-slate-700/70 bg-slate-900/50 px-3 py-2 text-xs text-slate-300">
            Sort order: Expiry → Severity → Age
          </div>
        </aside>

        <section className="space-y-4">
          {view === "stats" ? (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-[4px] border border-slate-700/70 bg-slate-950/80 p-3">
                <p className="text-[10px] uppercase tracking-[0.16em] text-slate-400">Total Reports</p>
                <p className="mt-1 text-2xl font-extrabold text-slate-50">{totalReports}</p>
              </div>
              <div className="rounded-[4px] border border-slate-700/70 bg-slate-950/80 p-3">
                <p className="text-[10px] uppercase tracking-[0.16em] text-slate-400">Pending</p>
                <p className="mt-1 text-2xl font-extrabold text-slate-100">{pendingCount}</p>
              </div>
              <div className="rounded-[4px] border border-slate-700/70 bg-slate-950/80 p-3">
                <p className="text-[10px] uppercase tracking-[0.16em] text-slate-400">Approved</p>
                <p className="mt-1 text-2xl font-extrabold text-slate-100">{approvedCount}</p>
              </div>
              <div className="rounded-[4px] border border-slate-700/70 bg-slate-950/80 p-3">
                <p className="text-[10px] uppercase tracking-[0.16em] text-slate-400">Avg Approval (h)</p>
                <p className="mt-1 text-2xl font-extrabold text-slate-100">{avgHours(approvalMsTotal, avgSamples.length)}</p>
              </div>
            </div>
          ) : null}

          {(view === "queue" ? prioritized.map((row: any) => row.report) : view === "approved" ? approvedReports : view === "rejected" ? rejectedReports : []).map((report: any) => {
            const windowMs = replayWindowMs(report.subjectRank);
            const expiresAt = new Date(report.createdAt.getTime() + windowMs);
            const remainingMs = expiresAt.getTime() - Date.now();
            const totalEvidence = report.replayEvidence.length + report.videoEvidence.length + report.attachments.length;

            return (
              <article key={report.id} className="rounded-xl border border-blue-900/50 bg-gradient-to-b from-slate-950/95 to-slate-950/85 p-4 shadow-[0_8px_24px_rgba(0,0,0,0.25)]">
                <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-800/80 pb-3">
                  <div className="space-y-2">
                    <h2 className="text-xl font-extrabold text-slate-100">
                      {report.subjectUsername}
                      {report.subjectUuid ? <span className="ml-2 text-xs text-slate-400">{report.subjectUuid}</span> : null}
                    </h2>
                    <div className="mt-1 flex flex-wrap items-center gap-2">
                      <SeverityBadge severity={report.severity} />
                      <ExpiryIndicator expiresAt={expiresAt} />
                      <span className="rounded-full border border-slate-700/80 bg-slate-900/70 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-300">
                        {report.status}
                      </span>
                      <span className="rounded-full border border-blue-900/70 bg-blue-950/40 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-blue-200">
                        {totalEvidence} evidence item{totalEvidence === 1 ? "" : "s"}
                      </span>
                    </div>
                    <p className="text-sm text-slate-300">
                      Reporter: {report.reporter?.name ?? report.reporter?.email ?? "Unknown"}
                    </p>
                    {report.reviewedBy ? (
                      <p className="text-sm text-slate-300">
                        Reviewed by {report.reviewedBy.name ?? report.reviewedBy.email ?? "Officer"}
                      </p>
                    ) : null}
                  </div>
                  <div className="min-w-[220px] rounded-lg border border-slate-800 bg-slate-950/70 px-3 py-2 text-xs text-slate-300">
                    <p><span className="font-semibold text-slate-200">Submitted:</span> {report.createdAt.toLocaleString()}</p>
                    <p className="mt-1"><span className="font-semibold text-slate-200">Replay Window:</span> {formatReplayWindow(windowMs)}</p>
                    <p className="mt-1"><span className="font-semibold text-slate-200">Deadline:</span> {expiresAt.toLocaleString()}</p>
                    <p className={`mt-1 font-semibold ${remainingMs <= 0 ? "text-rose-300" : "text-amber-200"}`}>{formatRemaining(remainingMs)}</p>
                  </div>
                </div>

                <div className="mt-4 grid gap-4 lg:grid-cols-2">
                  <div>
                    <p className="text-base font-bold text-slate-100">Reason</p>
                    <p className="mt-1 text-sm whitespace-pre-wrap text-slate-300">{report.reason}</p>
                  </div>
                  <div>
                    <p className="text-base font-bold text-slate-100">Evidence Description</p>
                    <p className="mt-1 text-sm whitespace-pre-wrap text-slate-300">{report.evidenceDescription}</p>
                  </div>
                </div>

                <div className="mt-4 grid gap-3 lg:grid-cols-3">
                  <section className="rounded-lg border border-slate-800 bg-slate-950/60 p-3">
                    <p className="text-sm font-bold text-slate-100">Replay IDs</p>
                    <div className="mt-2 space-y-2">
                      {report.replayEvidence.length ? (
                        report.replayEvidence.map((row: any) => (
                          <div key={row.id} className="flex items-center justify-between gap-2 rounded-md border border-slate-800 bg-slate-900/60 px-2 py-1">
                            <span className="truncate text-xs text-slate-200">{row.replayId}</span>
                            <CopyValueButton value={row.replayId} />
                          </div>
                        ))
                      ) : (
                        <p className="text-xs text-slate-500">None</p>
                      )}
                    </div>
                  </section>

                  <section className="rounded-lg border border-slate-800 bg-slate-950/60 p-3">
                    <p className="text-sm font-bold text-slate-100">Video Links</p>
                    <div className="mt-2 space-y-2">
                      {report.videoEvidence.length ? (
                        report.videoEvidence.map((row: any) => (
                          <div key={row.id} className="space-y-1 rounded-md border border-slate-800 bg-slate-900/60 px-2 py-1">
                            <a href={row.url} target="_blank" rel="noreferrer" className="block break-all text-xs text-blue-300 underline">
                              {row.url}
                            </a>
                            <CopyValueButton value={row.url} />
                          </div>
                        ))
                      ) : (
                        <p className="text-xs text-slate-500">None</p>
                      )}
                    </div>
                  </section>

                  <section className="rounded-lg border border-slate-800 bg-slate-950/60 p-3">
                    <p className="text-sm font-bold text-slate-100">Attachments</p>
                    <div className="mt-2 space-y-2">
                      {report.attachments.length ? (
                        report.attachments.map((row: any) => (
                          <div key={row.id} className="space-y-1 rounded-md border border-slate-800 bg-slate-900/60 px-2 py-1">
                            <a href={row.storagePath} target="_blank" rel="noreferrer" className="block break-all text-xs text-blue-300 underline">
                              {row.originalName}
                            </a>
                            <div className="flex items-center justify-between gap-2 text-[11px] text-slate-400">
                              <span>{Math.max(1, Math.round((row.sizeBytes ?? 0) / 1024))} KB</span>
                              <CopyValueButton value={row.storagePath} label="Copy link" />
                            </div>
                          </div>
                        ))
                      ) : (
                        <p className="text-xs text-slate-500">None</p>
                      )}
                    </div>
                  </section>
                </div>

                {report.reviewDecisionNote ? (
                  <div className="mt-4 rounded-lg border border-slate-800 bg-slate-950/60 p-3">
                    <p className="text-sm font-bold text-slate-100">Review Note</p>
                    <p className="mt-1 text-sm whitespace-pre-wrap text-slate-300">{report.reviewDecisionNote}</p>
                  </div>
                ) : null}

                {view === "queue" && canReview ? (
                  <div className="mt-4 rounded-lg border border-blue-900/40 bg-blue-950/15 p-3">
                    <p className="text-sm font-semibold text-slate-100">
                      Decision
                    </p>
                    <p className="mt-1 text-xs text-slate-300">
                      After checking evidence, either send this report to maintainer intake or reject it with a reason.
                    </p>

                    <div className="mt-3 grid gap-3 lg:grid-cols-2">
                      <form action={approveReport} className="rounded-lg border border-emerald-500/30 bg-emerald-950/20 p-3">
                        <input type="hidden" name="reportId" value={report.id} />
                        <label className="grid gap-1">
                          <span className="text-xs font-semibold uppercase tracking-[0.12em] text-emerald-200">Approval note (optional)</span>
                          <input
                            name="reviewDecisionNote"
                            placeholder="Optional context for maintainers"
                            className="rounded-md border border-emerald-700/40 bg-slate-950/80 px-3 py-2 text-sm text-slate-100"
                          />
                        </label>
                        <button className="mt-2 w-full rounded-md border border-emerald-500/60 bg-emerald-600 px-3 py-2 text-sm font-bold text-emerald-50 hover:bg-emerald-500">
                          Approve to Intake
                        </button>
                      </form>

                      <form action={rejectReport} className="rounded-lg border border-rose-500/30 bg-rose-950/20 p-3">
                        <input type="hidden" name="reportId" value={report.id} />
                        <label className="grid gap-1">
                          <span className="text-xs font-semibold uppercase tracking-[0.12em] text-rose-200">Rejection reason (required)</span>
                          <input
                            name="reviewDecisionNote"
                            required
                            placeholder="State why this report is rejected"
                            className="rounded-md border border-rose-700/40 bg-slate-950/80 px-3 py-2 text-sm text-slate-100"
                          />
                        </label>
                        <button className="mt-2 w-full rounded-md border border-rose-500/60 bg-rose-600 px-3 py-2 text-sm font-bold text-rose-50 hover:bg-rose-500">
                          Reject Report
                        </button>
                      </form>
                    </div>
                  </div>
                ) : null}

                {view === "queue" && !canReview ? (
                  <p className="mt-3 text-xs text-slate-400">Read-only queue view. Replay Officers and Admins perform triage decisions.</p>
                ) : null}
              </article>
            );
          })}

          {view !== "stats" && (view === "queue" ? prioritized.length === 0 : view === "approved" ? approvedReports.length === 0 : rejectedReports.length === 0) ? (
            <div className="rounded-[4px] border border-slate-700/70 bg-slate-950/70 p-4 text-sm text-slate-400">
              No reports in this section.
            </div>
          ) : null}
        </section>
      </div>
    </div>
  );
}

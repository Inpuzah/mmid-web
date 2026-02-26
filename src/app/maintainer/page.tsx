import Link from "next/link";
import { requireMaintainerDashboardAccess } from "@/lib/authz";
import { prisma } from "@/lib/prisma";
import {
  ActivityFilter,
  MaintainerTab,
  getMaintainerOverviewData,
} from "@/lib/maintainer-dashboard";
import SeverityBadge from "@/components/reports/SeverityBadge";
import CopyValueButton from "@/components/reports/CopyValueButton.client";
import { addMaintainerNote, markReportResolved, saveMaintainerDraft, sendBackToOfficer } from "./reports/actions";
import { upsertEntry } from "../entries/new/actions";

export const dynamic = "force-dynamic";

type ActorFilter = "all" | "me" | "team" | "system";
type IntakeMode = "proposed" | "current" | "diff";

const STATUS_TAG_OPTIONS = ["Alt", "Needs Reviewed", "Legit", "History", "Confirmed Cheater", "Teaming"];
const CHEATING_TAG_OPTIONS = [
  "N/A",
  "General Hack Client",
  "ESP / X-Ray",
  "Blink",
  "Murder Finder/Callout",
  "Consistent Teaming",
  "Exploiter (Bug Abuse)",
  "Resource Pack Abuse/Large Knives Abuse",
  "Other",
  "Boosting",
];
const RED_FLAG_OPTIONS = [
  "Inconclusive",
  "Generally nice person",
  "Previously Banned",
  "Doxxer",
  "Catfish",
  "Harasses Others",
  "Pedophile",
  "Beamer",
];

function getTab(v: string | string[] | undefined): MaintainerTab {
  const value = Array.isArray(v) ? v[0] : v;
  if (["overview", "intake", "directory", "stale", "analytics"].includes(String(value))) {
    return value as MaintainerTab;
  }
  return "overview";
}

function getActivityFilter(v: string | string[] | undefined): ActivityFilter {
  const value = Array.isArray(v) ? v[0] : v;
  if (["reports", "directory", "stale"].includes(String(value))) {
    return value as ActivityFilter;
  }
  return "all";
}

function getIntakeMode(v: string | string[] | undefined): IntakeMode {
  const value = Array.isArray(v) ? v[0] : v;
  if (["current", "diff"].includes(String(value))) {
    return value as IntakeMode;
  }
  return "proposed";
}

function firstStr(v: string | string[] | undefined): string {
  return Array.isArray(v) ? v[0] ?? "" : v ?? "";
}

function normalizeUuid(value: string) {
  return value.replace(/-/g, "").toLowerCase();
}

function formatRelativeTime(value?: Date | null): string {
  if (!value) return "Unknown time";
  const diffMs = value.getTime() - Date.now();
  const abs = Math.abs(diffMs);
  const minute = 60 * 1000;
  const hour = 60 * minute;
  const day = 24 * hour;
  const rtf = new Intl.RelativeTimeFormat("en", { numeric: "auto" });

  if (abs < hour) return rtf.format(Math.round(diffMs / minute), "minute");
  if (abs < day) return rtf.format(Math.round(diffMs / hour), "hour");
  return rtf.format(Math.round(diffMs / day), "day");
}

function buildOverviewHref(tab: MaintainerTab, filter: ActivityFilter): string {
  if (filter === "all") return `/maintainer?tab=${tab}`;
  return `/maintainer?tab=${tab}&activity=${filter}`;
}

function getActorFilter(v: string | string[] | undefined): ActorFilter {
  const value = Array.isArray(v) ? v[0] : v;
  if (["me", "team", "system"].includes(String(value))) {
    return value as ActorFilter;
  }
  return "all";
}

function formatRoleLabel(role: string): string {
  if (role === "ADMIN") return "Admin";
  if (role === "REPLAY_OFFICER") return "Replay Officer";
  if (role === "MAINTAINER") return "Maintainer";
  return "User";
}

function buildOverviewHrefWithActor(
  tab: MaintainerTab,
  activity: ActivityFilter,
  actor: ActorFilter,
): string {
  const params = new URLSearchParams();
  params.set("tab", tab);
  if (activity !== "all") params.set("activity", activity);
  if (actor !== "all") params.set("actor", actor);
  return `/maintainer?${params.toString()}`;
}

export default async function MaintainerDashboardPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { role, session } = await requireMaintainerDashboardAccess();

  const sp = (await searchParams) ?? {};
  const tab = getTab(sp.tab);
  const activityFilter = getActivityFilter(sp.activity);
  const actorFilter = getActorFilter(sp.actor);
  const selectedReportId = firstStr(sp.reportId);
  const intakeMode = getIntakeMode(sp.mode);
  const roleLabel = formatRoleLabel(role);
  const currentActor =
    ((session.user as any)?.name as string | undefined) ??
    session.user?.email ??
    "Current user";

  const data = await getMaintainerOverviewData(activityFilter);
  const intakeOpenCount = data.approvedReports + (data.draftReports ?? 0);

  const selectedIntakeReport =
    data.recentApproved.find((report: any) => report.id === selectedReportId) ?? data.recentApproved[0] ?? null;

  const selectedDirectoryEntry = selectedIntakeReport?.subjectUuid
    ? await prisma.mmidEntry.findFirst({
        where: {
          OR: [
            { uuid: selectedIntakeReport.subjectUuid },
            { uuid: normalizeUuid(selectedIntakeReport.subjectUuid) },
          ],
        },
      })
    : null;

  const statusTagsCurrent =
    (selectedDirectoryEntry as any)?.statusTags && (selectedDirectoryEntry as any).statusTags.length > 0
      ? (selectedDirectoryEntry as any).statusTags
      : ((selectedDirectoryEntry?.status ?? "")
          .split(",")
          .map((item) => item.trim())
          .filter(Boolean));

  const proposedStatusTags = statusTagsCurrent;
  const proposedCheating = selectedDirectoryEntry?.typeOfCheating ?? [];
  const proposedRedFlags = selectedDirectoryEntry?.redFlags ?? [];
  const proposedConfidence = Math.max(1, Number(selectedDirectoryEntry?.confidenceScore ?? 3));

  const diffRows = selectedIntakeReport
    ? [
        {
          key: "Status Tags",
          current: statusTagsCurrent.join(", ") || "—",
          proposed: proposedStatusTags.join(", ") || "—",
        },
        {
          key: "Type of Cheating",
          current: (selectedDirectoryEntry?.typeOfCheating ?? []).join(", ") || "—",
          proposed: proposedCheating.join(", ") || "—",
        },
        {
          key: "Red Flags",
          current: (selectedDirectoryEntry?.redFlags ?? []).join(", ") || "—",
          proposed: proposedRedFlags.join(", ") || "—",
        },
        {
          key: "Confidence",
          current: `${selectedDirectoryEntry?.confidenceScore ?? "—"}`,
          proposed: `${proposedConfidence}`,
        },
      ]
    : [];

  const filteredActivityItems = data.activityItems.filter((item) => {
    const actor = item.actor.toLowerCase();
    const me = currentActor.toLowerCase();
    if (actorFilter === "all") return true;
    if (actorFilter === "system") return actor === "system";
    if (actorFilter === "me") return actor === me;
    return actor !== "system" && actor !== me;
  });

  const recentActionRows = filteredActivityItems.slice(0, 12).map((item) => {
    const tone =
      item.action === "Resolved report"
        ? "success"
        : item.action === "Rejected report" || item.kind === "stale"
          ? "warn"
          : "info";

    const label =
      item.action === "Resolved report"
        ? "Report Resolved"
        : item.action === "Rejected report"
          ? "Report Rejected"
          : item.action === "Approved report"
            ? "Report Approved"
            : item.action === "Stale marked"
              ? "Stale Entry"
              : "Entry Updated";

    return {
      ...item,
      actionType: { label, tone },
      timeLabel: formatRelativeTime(item.time),
    };
  });

  const recommendedActions: Array<{
    id: string;
    text: string;
    detail: string;
    href?: string;
    cta?: string;
    variant: "warning" | "info" | "success";
  }> = [
    data.staleEntries.length > 0
      ? {
          id: "stale",
          text: "Review stale entries",
          detail: `${data.staleEntries.length} entries waiting · ${data.staleOver14} older than 14 days`,
          href: "/maintainer?tab=stale",
          cta: "Start",
          variant: "warning",
        }
      : {
          id: "stale-clear",
          text: "Stale entries are clear",
          detail: "No entries are currently past the stale threshold",
          href: "/maintainer?tab=stale",
          cta: "View",
          variant: "success",
        },
    {
      id: "audit",
      text: "Review recent maintainer actions",
      detail: "Quickly check last 24h changes and note quality",
      href: "/admin/audit",
      cta: "Open",
      variant: "info",
    },
    data.pendingReports > 0
      ? {
          id: "pending",
          text: "New reports need triage",
          detail: `${data.pendingReports} pending report${data.pendingReports === 1 ? "" : "s"} waiting in the officer queue`,
          href: "/maintainer/reports?view=queue",
          cta: "Open",
          variant: "warning",
        }
      : {
          id: "pending-clear",
          text: "New reports are clear",
          detail: "No pending report triage is needed right now",
          href: "/maintainer/reports?view=queue",
          cta: "View",
          variant: "success",
        },
    intakeOpenCount > 0
      ? {
          id: "intake",
          text: "Report intake has waiting items",
          detail: `${intakeOpenCount} intake item${intakeOpenCount === 1 ? "" : "s"} waiting for maintainer action`,
          href: "/maintainer?tab=intake",
          cta: "Start",
          variant: "info",
        }
      : {
          id: "intake-clear",
          text: "Report intake is empty",
          detail: "No approved items are waiting for maintainer work",
          href: "/maintainer?tab=intake",
          cta: "View",
          variant: "success",
        },
  ];

  const queueActions = recommendedActions.filter((action) => action.variant !== "success");
  const clearActions = recommendedActions.filter((action) => action.variant === "success");

  return (
    <main className="mx-auto max-w-[1400px] px-4 py-5">
      <div className="grid gap-4 lg:grid-cols-[280px_minmax(0,1fr)] lg:items-start">
        <aside className="space-y-3 rounded-2xl border border-blue-900/50 bg-gradient-to-b from-slate-950/95 to-slate-950/85 p-3 xl:sticky xl:top-20 xl:max-h-[calc(100vh-6rem)] xl:overflow-auto">
          <section>
            <p className="mb-2 text-xs font-semibold uppercase tracking-[0.08em] text-slate-400">Operations</p>
            <div className="space-y-1.5">
              <Link
                href="/maintainer?tab=overview"
                className={`flex items-center justify-between rounded-[10px] border px-3 py-2.5 text-sm transition ${tab === "overview" ? "border-blue-700/80 bg-blue-950/40 text-slate-100" : "border-transparent bg-transparent text-slate-300 hover:border-blue-900/50 hover:bg-slate-900/80"}`}
              >
                <span>Overview</span>
              </Link>
              <Link
                href="/maintainer/reports?view=queue"
                className={`flex items-center justify-between rounded-[10px] border px-3 py-2.5 text-sm transition ${tab === "overview" ? "border-transparent bg-transparent text-slate-300 hover:border-blue-900/50 hover:bg-slate-900/80" : "border-transparent bg-transparent text-slate-300 hover:border-blue-900/50 hover:bg-slate-900/80"}`}
              >
                <span>New Reports</span>
                <span className="rounded-full border border-blue-900/70 bg-slate-900 px-2 py-0.5 text-[10px] font-semibold text-slate-200">{data.pendingReports}</span>
              </Link>
              <Link
                href="/maintainer?tab=intake"
                className={`flex items-center justify-between rounded-[10px] border px-3 py-2.5 text-sm transition ${tab === "intake" ? "border-blue-700/80 bg-blue-950/40 text-slate-100" : "border-transparent bg-transparent text-slate-300 hover:border-blue-900/50 hover:bg-slate-900/80"}`}
              >
                <span>Report Intake</span>
                <span className="rounded-full border border-blue-900/70 bg-slate-900 px-2 py-0.5 text-[10px] font-semibold text-slate-200">{intakeOpenCount}</span>
              </Link>
              <Link
                href="/maintainer?tab=stale"
                className={`flex items-center justify-between rounded-[10px] border px-3 py-2.5 text-sm transition ${tab === "stale" ? "border-blue-700/80 bg-blue-950/40 text-slate-100" : "border-transparent bg-transparent text-slate-300 hover:border-blue-900/50 hover:bg-slate-900/80"}`}
              >
                <span>Stale Entries</span>
                <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${data.staleEntries.length > 0 ? "border-amber-500/50 bg-amber-950/40 text-amber-200" : "border-blue-900/70 bg-slate-900 text-slate-200"}`}>{data.staleEntries.length}</span>
              </Link>
              <Link
                href="/admin/audit"
                className="flex items-center justify-between rounded-[10px] border border-transparent bg-transparent px-3 py-2.5 text-sm text-slate-300 transition hover:border-blue-900/50 hover:bg-slate-900/80"
              >
                <span>Audit Log</span>
              </Link>
              <a
                href="#recent-actions"
                className="flex items-center justify-between rounded-[3px] border border-slate-700/70 bg-slate-900/70 px-2.5 py-2 text-sm text-slate-300 transition hover:bg-slate-800/80"
              >
                <span>Recent Actions</span>
                <span className="text-xs text-slate-500">↓</span>
              </a>
            </div>
          </section>

          <section className="pt-1">
            <p className="mb-2 text-xs font-semibold uppercase tracking-[0.08em] text-slate-400">Reference</p>
            <div className="space-y-1.5">
              <Link href="/maintainer?tab=directory" className="flex rounded-[10px] border border-transparent bg-transparent px-3 py-2 text-sm text-slate-300 hover:border-blue-900/50 hover:bg-slate-900/80">Directory</Link>
              <Link href="/maintainer?tab=analytics" className="flex rounded-[10px] border border-transparent bg-transparent px-3 py-2 text-sm text-slate-300 hover:border-blue-900/50 hover:bg-slate-900/80">Analytics</Link>
            </div>
          </section>

          <section className="mt-auto space-y-2 border-t border-blue-900/40 pt-3">
            <div className="rounded-xl border border-blue-900/50 bg-slate-950/80 p-2.5 text-xs text-slate-300">
              <p className="text-[10px] uppercase tracking-[0.1em] text-slate-500">Role</p>
              <div className="mt-1 flex h-8 items-center justify-between rounded-md border border-blue-900/60 bg-slate-900 px-2 text-xs text-slate-200">
                <span>{roleLabel}</span>
                <span>▾</span>
              </div>
            </div>
          </section>
        </aside>

        <div className="min-w-0 space-y-5">

      {tab === "overview" ? (
        <div className="space-y-4">
          <section className="rounded-2xl border border-blue-900/50 bg-gradient-to-b from-slate-950/95 to-slate-950/85 p-4 shadow-[0_10px_30px_rgba(0,0,0,0.35)]">
            <div>
              <div>
                <h1 className="text-2xl font-extrabold text-slate-100">Maintainer Dashboard</h1>
                <p className="mt-2 text-sm text-slate-400">
                  A quick view of new reports, report intake, and stale entries.
                </p>
              </div>
            </div>

            <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-500/30 bg-gradient-to-r from-amber-950/20 to-amber-950/5 px-3 py-2.5">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-amber-300">Needs attention</p>
                <p className="text-sm text-slate-200">
                  {data.staleEntries.length} stale entries waiting ({data.staleOver14} older than 14d).
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Link
                  href="/maintainer?tab=stale"
                  className="rounded-md border border-amber-400/50 bg-gradient-to-b from-amber-300 to-amber-500 px-3 py-1.5 text-xs font-semibold text-amber-950 hover:brightness-105"
                >
                  Review entries
                </Link>
                <Link href="/maintainer?tab=analytics" className="text-xs font-semibold text-amber-200 hover:text-amber-100">
                  View details
                </Link>
              </div>
            </div>
          </section>

          <section className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
            <article className="relative overflow-hidden rounded-2xl border border-blue-900/35 bg-gradient-to-b from-slate-950/95 to-slate-950/85 p-4 shadow-[0_10px_24px_rgba(0,0,0,0.32)] before:absolute before:left-0 before:top-0 before:h-[2px] before:w-full before:bg-emerald-400/70 before:content-['']">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-slate-200">New Reports</p>
                <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-200">
                  {data.pendingReports > 0 ? "Active" : "Healthy"}
                </span>
              </div>
              <p className="mt-2 text-[38px] font-extrabold leading-none text-slate-100">{data.pendingReports}</p>
              <p className="mt-2 text-xs text-slate-400">
                {data.pendingReports > 0
                  ? data.oldestPendingCreatedAt
                    ? `Oldest pending report opened ${formatRelativeTime(data.oldestPendingCreatedAt)}`
                    : "Pending work available"
                  : `No pending reports. Last report resolved ${formatRelativeTime(data.activityItems.find((item) => item.action === "Resolved report")?.time)}`}
              </p>
              <Link
                href="/maintainer/reports?view=queue"
                className="mt-3 inline-flex rounded-md border border-blue-800/60 bg-blue-950/40 px-3 py-1.5 text-xs font-semibold text-slate-100 hover:bg-blue-900/50"
              >
                Open new reports
              </Link>
            </article>

            <article className="relative overflow-hidden rounded-2xl border border-blue-900/35 bg-gradient-to-b from-slate-950/95 to-slate-950/85 p-4 shadow-[0_10px_24px_rgba(0,0,0,0.32)] before:absolute before:left-0 before:top-0 before:h-[2px] before:w-full before:bg-blue-400/70 before:content-['']">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-slate-200">Report Intake</p>
                <span className="rounded-full border border-blue-500/30 bg-blue-500/10 px-2 py-0.5 text-[10px] font-semibold text-blue-200">
                  {intakeOpenCount > 0 ? "Active" : "Clear"}
                </span>
              </div>
              <p className="mt-2 text-[38px] font-extrabold leading-none text-slate-100">{intakeOpenCount}</p>
              <p className="mt-2 text-xs text-slate-400">
                {intakeOpenCount > 0
                    ? `${data.approvedReports} approved and ${data.draftReports ?? 0} draft item${intakeOpenCount === 1 ? "" : "s"} in intake.`
                    : "No approved items waiting for maintainer review."}
              </p>
              <Link
                href={buildOverviewHref("intake", activityFilter)}
                className="mt-3 inline-flex rounded-md border border-blue-800/60 bg-blue-950/40 px-3 py-1.5 text-xs font-semibold text-slate-100 hover:bg-blue-900/50"
              >
                Open intake
              </Link>
            </article>

            <article className="relative overflow-hidden rounded-2xl border border-blue-900/35 bg-gradient-to-b from-slate-950/95 to-slate-950/85 p-4 shadow-[0_10px_24px_rgba(0,0,0,0.32)] before:absolute before:left-0 before:top-0 before:h-[2px] before:w-full before:bg-amber-400/80 before:content-['']">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-slate-200">Stale Entries</p>
                <span className="rounded-full border border-amber-500/40 bg-amber-500/10 px-2 py-0.5 text-[10px] font-semibold text-amber-200">
                  Needs Attention
                </span>
              </div>
              <p className="mt-2 text-[38px] font-extrabold leading-none text-slate-100">{data.staleEntries.length}</p>
              <p className="mt-2 text-xs text-slate-400">
                {data.staleOver14} older than 14 days · {data.staleEscalated} older than 60 days
              </p>
              <Link
                href={buildOverviewHref("stale", activityFilter)}
                className="mt-3 inline-flex rounded-md border border-blue-800/60 bg-blue-950/40 px-3 py-1.5 text-xs font-semibold text-slate-100 hover:bg-blue-900/50"
              >
                Review entries
              </Link>
            </article>
          </section>

          <section className="grid grid-cols-1 gap-3 xl:grid-cols-[1.2fr,0.8fr]">
            <article className="rounded-2xl border border-blue-900/50 bg-gradient-to-b from-slate-950/95 to-slate-950/85 p-4 shadow-[0_10px_30px_rgba(0,0,0,0.35)]">
              <div className="mb-3 flex items-center justify-between">
                <div>
                  <h2 className="text-[15px] font-bold text-slate-100">Action Center</h2>
                  <p className="text-xs text-slate-400">Suggested next steps based on current queue status</p>
                </div>
                <Link
                  href={buildOverviewHref("overview", activityFilter)}
                  className="rounded-[4px] border border-blue-800/70 bg-blue-950/40 px-3 py-1 text-xs font-semibold text-slate-200 hover:bg-blue-950/60"
                >
                  Refresh
                </Link>
              </div>

              <div className="space-y-2.5">
                {queueActions.map((action) => {
                  const iconClass =
                    action.variant === "warning"
                      ? "bg-amber-500 text-amber-950"
                      : action.variant === "info"
                        ? "bg-blue-500 text-blue-950"
                        : "bg-emerald-500 text-emerald-950";

                  return (
                    <div
                      key={action.id}
                      className="grid grid-cols-[auto,1fr,auto] items-center gap-3 rounded-[10px] border border-blue-900/30 bg-slate-950/65 px-3 py-2.5"
                    >
                      <div className="flex items-start gap-3">
                        <span className={`mt-0.5 inline-flex h-5 w-5 items-center justify-center rounded text-xs font-black ${iconClass}`}>
                          {action.variant === "warning" ? "!" : action.variant === "info" ? "i" : "✓"}
                        </span>
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-slate-100">{action.text}</p>
                        <p className="text-xs text-slate-400">{action.detail}</p>
                        <p className="mt-1 text-[11px] text-slate-500">
                          {action.id === "stale"
                            ? `Assignment: Unassigned · Oldest item: ${data.oldestStaleDays}d`
                            : action.id === "pending"
                              ? `Assignment: Unassigned · ${data.oldestPendingCreatedAt ? `Oldest opened ${formatRelativeTime(data.oldestPendingCreatedAt)}` : "Pending items available"}`
                              : "Assignment: Assigned to you · Quick start available"}
                        </p>
                      </div>

                      {action.href ? (
                        <Link
                          href={action.href}
                          className="shrink-0 rounded-lg border border-blue-800/70 bg-blue-950/50 px-3 py-1 text-xs font-semibold text-slate-100 hover:bg-blue-900/60"
                        >
                          {action.cta ?? "Open"}
                        </Link>
                      ) : null}
                    </div>
                  );
                })}

                {clearActions.length > 0 ? (
                  <details className="rounded-[10px] border border-blue-900/30 bg-slate-950/60 px-3 py-2">
                    <summary className="cursor-pointer text-xs font-semibold text-slate-300">
                      All clear ({clearActions.length})
                    </summary>
                    <div className="mt-2 space-y-1.5">
                      {clearActions.map((action) => (
                        <p key={action.id} className="text-xs text-slate-400">
                          {action.text}
                        </p>
                      ))}
                    </div>
                  </details>
                ) : null}
              </div>
            </article>

            <div className="space-y-3">
              <article className="rounded-2xl border border-blue-900/50 bg-gradient-to-b from-slate-950/95 to-slate-950/85 p-4 shadow-[0_10px_30px_rgba(0,0,0,0.35)]">
                <h2 className="text-[15px] font-bold text-slate-100">Queue Health</h2>
                <p className="text-xs text-slate-400">Quick operational snapshot</p>

                <div className="mt-3 space-y-2 text-sm">
                  <div className="flex items-center justify-between rounded-[4px] border border-blue-900/40 bg-slate-950/70 px-3 py-2">
                    <p className="text-slate-300">Oldest stale entry</p>
                    <p className="font-bold text-slate-100">{data.oldestStaleDays}d</p>
                  </div>
                  <div className="flex items-center justify-between rounded-[4px] border border-blue-900/40 bg-slate-950/70 px-3 py-2">
                    <p className="text-slate-300">Resolved in last 24h</p>
                    <p className="font-bold text-slate-100">{data.resolvedLast24h}</p>
                  </div>
                  <div className="flex items-center justify-between rounded-[4px] border border-blue-900/40 bg-slate-950/70 px-3 py-2">
                    <p className="text-slate-300">Average review time</p>
                    <p className="font-bold text-slate-100">{data.avgReviewLatencyDays}</p>
                  </div>
                  <div className="flex items-center justify-between rounded-[4px] border border-blue-900/40 bg-slate-950/70 px-3 py-2">
                    <p className="text-slate-300">Staff active today</p>
                    <p className="font-bold text-slate-100">{data.staffActiveToday}</p>
                  </div>
                  <div className="flex items-center justify-between rounded-[4px] border border-blue-900/25 bg-slate-950/50 px-3 py-2">
                    <p className="text-slate-400">Directory size</p>
                    <p className="font-semibold text-slate-300">{data.entries.toLocaleString()}</p>
                  </div>
                </div>
              </article>

              <article className="rounded-2xl border border-blue-900/50 bg-gradient-to-b from-slate-950/95 to-slate-950/85 p-4 shadow-[0_10px_30px_rgba(0,0,0,0.35)]">
                <h2 className="text-[15px] font-bold text-slate-100">7-Day Activity Trend</h2>
                <p className="text-xs text-slate-400">Recent resolved actions and completed reviews</p>

                <div className="mt-3 rounded-xl border border-blue-900/40 bg-gradient-to-b from-slate-900/90 to-slate-950/95 p-3">
                  <svg
                    viewBox="0 0 100 100"
                    className="h-24 w-full"
                    preserveAspectRatio="none"
                    role="img"
                    aria-label="Activity trend chart"
                  >
                    <polyline
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.5"
                      className="text-blue-300"
                      points={data.trendPoints}
                    />
                  </svg>
                  <div className="mt-1 grid grid-cols-7 text-[10px] text-slate-500">
                    {data.trendBuckets.map((bucket) => (
                      <span key={bucket.day.toISOString()} className="text-center">
                        {bucket.day.toLocaleDateString(undefined, { weekday: "short" })}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="mt-3 flex items-center justify-between text-xs text-slate-400">
                  <span>
                    {data.trendImproving
                      ? "Activity is trending up over the last 3 days"
                      : "Activity is steady compared to the previous period"}
                  </span>
                  <Link href={buildOverviewHref("analytics", activityFilter)} className="font-semibold text-slate-300 hover:text-white">
                    Open analytics →
                  </Link>
                </div>
              </article>
            </div>
          </section>

          <section
            id="recent-actions"
            className="rounded-2xl border border-blue-900/50 bg-gradient-to-b from-slate-950/95 to-slate-950/85 shadow-[0_10px_30px_rgba(0,0,0,0.35)]"
          >
            <div className="flex flex-wrap items-center justify-between gap-3 px-4 pb-2 pt-4">
              <div>
                <h2 className="text-[15px] font-bold text-slate-100">Recent Actions</h2>
                <p className="text-xs text-slate-400">
                  Activity feed for maintainers and officers
                </p>
              </div>
              <div className="inline-flex items-center gap-1 rounded-xl border border-blue-900/60 bg-slate-950/70 p-1">
                {([
                  { id: "all", label: "All" },
                  { id: "reports", label: "New Reports" },
                  { id: "directory", label: "Directory" },
                  { id: "stale", label: "Stale Entries" },
                ] as const).map((filter) => {
                  const active = activityFilter === filter.id;
                  return (
                    <Link
                      key={filter.id}
                      href={buildOverviewHref("overview", filter.id)}
                      className={`rounded-md px-2.5 py-1 text-xs font-semibold ${
                        active
                          ? "border border-blue-800/80 bg-blue-950/40 text-slate-100"
                          : "text-slate-300 hover:bg-slate-800/80"
                      }`}
                    >
                      {filter.label}
                    </Link>
                  );
                })}
              </div>
              <div className="inline-flex items-center gap-1 rounded-xl border border-blue-900/60 bg-slate-950/70 p-1">
                {([
                  { id: "all", label: "All Actors" },
                  { id: "me", label: "Me" },
                  { id: "team", label: "Team" },
                  { id: "system", label: "System" },
                ] as const).map((filter) => {
                  const active = actorFilter === filter.id;
                  return (
                    <Link
                      key={filter.id}
                      href={buildOverviewHrefWithActor("overview", activityFilter, filter.id)}
                      className={`rounded-md px-2.5 py-1 text-xs font-semibold ${
                        active
                          ? "border border-blue-800/80 bg-blue-950/40 text-slate-100"
                          : "text-slate-300 hover:bg-slate-800/80"
                      }`}
                    >
                      {filter.label}
                    </Link>
                  );
                })}
              </div>
            </div>

            <div className="overflow-x-auto px-4 pb-4">
              <table className="w-full min-w-[760px] border-collapse text-sm">
                <thead>
                  <tr className="sticky top-0 z-10 border-b border-blue-900/40 bg-slate-950/95 text-left text-[11px] uppercase tracking-[0.08em] text-slate-500 backdrop-blur">
                    <th className="px-3 py-2 font-semibold">Action</th>
                    <th className="px-3 py-2 font-semibold">Target</th>
                    <th className="px-3 py-2 font-semibold">Actor</th>
                    <th className="px-3 py-2 font-semibold">Notes</th>
                    <th className="px-3 py-2 font-semibold">Time</th>
                  </tr>
                </thead>
                <tbody>
                  {recentActionRows.length > 0 ? (
                    recentActionRows.map((item) => (
                      <tr key={item.id} className="border-b border-blue-900/20 transition hover:bg-slate-900/40">
                        <td className="px-3 py-2.5">
                          <Link
                            href={item.href}
                            className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold ${
                              item.actionType.tone === "success"
                                ? "border-emerald-500/35 bg-emerald-950/40 text-emerald-200"
                                : item.actionType.tone === "warn"
                                  ? "border-amber-500/35 bg-amber-950/40 text-amber-200"
                                  : "border-blue-500/35 bg-blue-950/40 text-blue-200"
                            }`}
                          >
                            {item.actionType.label}
                          </Link>
                        </td>
                        <td className="px-3 py-2.5 text-slate-200">
                          <Link href={item.href} className="font-medium text-slate-200 hover:text-white">
                            {item.target}
                          </Link>
                        </td>
                        <td className="px-3 py-2.5 text-slate-300">{item.actor}</td>
                        <td className="px-3 py-2.5 text-slate-400">{item.notes}</td>
                        <td className="px-3 py-2.5 text-slate-500">{item.timeLabel}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={5} className="px-3 py-6 text-center text-sm text-slate-400">
                        No recent activity for this filter.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      ) : null}

      {tab === "intake" ? (
        <section className="space-y-3">
          <div className="rounded-2xl border border-blue-900/50 bg-gradient-to-b from-slate-950/95 to-slate-950/85 p-4">
            <h2 className="text-base font-bold text-slate-100">Report Intake Workspace</h2>
            <p className="mt-1 text-xs text-slate-400">
              Select a report on the left. Evidence and directory tools appear here without leaving this page.
            </p>
            <p className="mt-1 text-xs text-slate-500">Approved: {data.approvedReports} · Draft: {data.draftReports ?? 0}</p>
          </div>

          {data.recentApproved.length > 0 ? (
            <div className="grid items-start gap-3 xl:grid-cols-[340px_minmax(0,1fr)]">
              <aside className="space-y-2 rounded-2xl border border-blue-900/50 bg-gradient-to-b from-slate-950/95 to-slate-950/85 p-3 xl:sticky xl:top-20">
                <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">Reports</p>
                {data.recentApproved.map((report: any) => {
                  const active = selectedIntakeReport?.id === report.id;
                  const href = `/maintainer?tab=intake&reportId=${encodeURIComponent(report.id)}&mode=${intakeMode}`;
                  return (
                    <Link
                      key={report.id}
                      href={href}
                      className={`block rounded-lg border px-3 py-2 ${
                        active
                          ? "border-blue-700/80 bg-blue-950/35"
                          : "border-slate-700/80 bg-slate-900/45 hover:border-blue-900/60 hover:bg-slate-900/70"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <p className="truncate text-sm font-semibold text-slate-100">{report.subjectUsername}</p>
                        <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${report.status === "MAINTAINER_DRAFT" ? "border-amber-500/50 bg-amber-950/35 text-amber-200" : "border-blue-900/60 bg-blue-950/30 text-blue-200"}`}>
                          {report.status === "MAINTAINER_DRAFT" ? "Draft" : "Approved"}
                        </span>
                      </div>
                      <p className="mt-1 text-[11px] text-slate-400">{report.approvedAt?.toLocaleString() ?? "—"}</p>
                    </Link>
                  );
                })}
              </aside>

              <div className="space-y-3">
                {selectedIntakeReport ? (
                  <>
                    <section className="rounded-2xl border border-blue-900/50 bg-gradient-to-b from-slate-950/95 to-slate-950/85 p-4">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <h3 className="text-lg font-extrabold text-slate-100">{selectedIntakeReport.subjectUsername}</h3>
                          <p className="text-xs text-slate-400">
                            Approved by {selectedIntakeReport.reviewedBy?.name ?? selectedIntakeReport.reviewedBy?.email ?? "Officer"}
                          </p>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          <SeverityBadge severity={selectedIntakeReport.severity} />
                          <span className="rounded-full border border-blue-900/70 bg-blue-950/30 px-2 py-0.5 text-[10px] font-semibold text-blue-200">
                            {(selectedIntakeReport.replayEvidence?.length ?? 0) + (selectedIntakeReport.videoEvidence?.length ?? 0) + (selectedIntakeReport.attachments?.length ?? 0)} evidence
                          </span>
                        </div>
                      </div>

                      <div className="mt-3 grid gap-2 md:grid-cols-2">
                        <div className="rounded-lg border border-slate-700/70 bg-slate-900/50 p-2">
                          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-300">Reason</p>
                          <p className="mt-1 text-sm text-slate-200 whitespace-pre-wrap">{selectedIntakeReport.reason}</p>
                        </div>
                        <div className="rounded-lg border border-slate-700/70 bg-slate-900/50 p-2">
                          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-300">Evidence Description</p>
                          <p className="mt-1 text-sm text-slate-200 whitespace-pre-wrap">{selectedIntakeReport.evidenceDescription}</p>
                        </div>
                      </div>

                      <div className="mt-3 grid gap-2 md:grid-cols-3">
                        <section className="rounded-lg border border-slate-700/70 bg-slate-900/50 p-2">
                          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-300">Replay IDs</p>
                          <ul className="mt-1 space-y-1 text-xs text-slate-200">
                            {selectedIntakeReport.replayEvidence?.length ? selectedIntakeReport.replayEvidence.map((item: any) => (
                              <li key={item.id} className="flex items-center justify-between gap-2 rounded border border-slate-800/70 bg-slate-950/70 px-2 py-1">
                                <span className="truncate">{item.replayId}</span>
                                <CopyValueButton value={item.replayId} />
                              </li>
                            )) : <li className="text-slate-500">None</li>}
                          </ul>
                        </section>

                        <section className="rounded-lg border border-slate-700/70 bg-slate-900/50 p-2">
                          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-300">Video Links</p>
                          <ul className="mt-1 space-y-1 text-xs text-slate-200">
                            {selectedIntakeReport.videoEvidence?.length ? selectedIntakeReport.videoEvidence.map((item: any) => (
                              <li key={item.id} className="space-y-1 rounded border border-slate-800/70 bg-slate-950/70 px-2 py-1">
                                <a href={item.url} target="_blank" rel="noreferrer" className="block break-all text-blue-300 underline">{item.url}</a>
                                <CopyValueButton value={item.url} />
                              </li>
                            )) : <li className="text-slate-500">None</li>}
                          </ul>
                        </section>

                        <section className="rounded-lg border border-slate-700/70 bg-slate-900/50 p-2">
                          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-300">Attachments</p>
                          <ul className="mt-1 space-y-1 text-xs text-slate-200">
                            {selectedIntakeReport.attachments?.length ? selectedIntakeReport.attachments.map((item: any) => (
                              <li key={item.id} className="space-y-1 rounded border border-slate-800/70 bg-slate-950/70 px-2 py-1">
                                <a href={item.storagePath} target="_blank" rel="noreferrer" className="block break-all text-blue-300 underline">{item.originalName}</a>
                                <CopyValueButton value={item.storagePath} label="Copy link" />
                              </li>
                            )) : <li className="text-slate-500">None</li>}
                          </ul>
                        </section>
                      </div>
                    </section>

                    <section className="rounded-2xl border border-blue-900/50 bg-gradient-to-b from-slate-950/95 to-slate-950/85 p-4">
                      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                        <h3 className="text-base font-bold text-slate-100">Directory Intake Editor</h3>
                        <div className="inline-flex rounded-lg border border-blue-900/60 bg-slate-950/70 p-1">
                          {([
                            { key: "proposed", label: "Proposed" },
                            { key: "current", label: "Current" },
                            { key: "diff", label: "Diff" },
                          ] as const).map((mode) => (
                            <Link
                              key={mode.key}
                              href={`/maintainer?tab=intake&reportId=${encodeURIComponent(selectedIntakeReport.id)}&mode=${mode.key}`}
                              className={`rounded-md px-2.5 py-1 text-xs font-semibold ${
                                intakeMode === mode.key
                                  ? "border border-blue-800/80 bg-blue-950/40 text-slate-100"
                                  : "text-slate-300 hover:bg-slate-800/80"
                              }`}
                            >
                              {mode.label}
                            </Link>
                          ))}
                        </div>
                      </div>

                      {intakeMode === "current" ? (
                        <div className="grid gap-2 md:grid-cols-2">
                          <div className="rounded-lg border border-slate-700/70 bg-slate-900/50 p-3">
                            <p className="text-[11px] uppercase tracking-[0.12em] text-slate-400">Entry Target</p>
                            <p className="mt-1 text-sm text-slate-100">{selectedDirectoryEntry ? "Existing directory entry" : "New directory entry (not found by UUID)"}</p>
                            <p className="mt-1 text-xs text-slate-400">UUID: {selectedDirectoryEntry?.uuid ?? selectedIntakeReport.subjectUuid ?? "Not provided"}</p>
                          </div>
                          <div className="rounded-lg border border-slate-700/70 bg-slate-900/50 p-3">
                            <p className="text-[11px] uppercase tracking-[0.12em] text-slate-400">Current MMID Tags</p>
                            <p className="mt-1 text-sm text-slate-100">{(statusTagsCurrent ?? []).join(", ") || "None"}</p>
                            <p className="mt-1 text-xs text-slate-400">Confidence: {selectedDirectoryEntry?.confidenceScore ?? "—"}/5</p>
                          </div>
                        </div>
                      ) : null}

                      {intakeMode === "diff" ? (
                        <div className="rounded-lg border border-amber-500/35 bg-amber-950/15 p-3">
                          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-amber-200">Current vs Proposed</p>
                          <div className="mt-2 space-y-2">
                            {diffRows.map((row) => (
                              <div key={row.key} className="grid gap-1 rounded border border-slate-700/70 bg-slate-900/60 p-2 md:grid-cols-[160px_minmax(0,1fr)_minmax(0,1fr)]">
                                <p className="text-[11px] font-semibold text-slate-300">{row.key}</p>
                                <p className="text-xs text-slate-400">Current: {row.current}</p>
                                <p className="text-xs text-slate-200">Proposed: {row.proposed}</p>
                              </div>
                            ))}
                          </div>
                        </div>
                      ) : null}

                      {intakeMode === "proposed" ? (
                        <form action={upsertEntry} className="space-y-3">
                          <input type="hidden" name="reportId" value={selectedIntakeReport.id} />
                          <input type="hidden" name="returnTo" value={`/maintainer?tab=intake&reportId=${encodeURIComponent(selectedIntakeReport.id)}&mode=proposed`} />
                          <input type="hidden" name="targetUuid" value={selectedDirectoryEntry?.uuid ?? ""} />

                          <div className="grid gap-2 md:grid-cols-2">
                            <label className="grid gap-1">
                              <span className="text-[11px] uppercase tracking-[0.12em] text-slate-300">UUID</span>
                              <input name="uuid" defaultValue={selectedDirectoryEntry?.uuid ?? selectedIntakeReport.subjectUuid ?? ""} required className="rounded border border-blue-900/60 bg-slate-950/80 px-3 py-2 text-sm text-slate-100" />
                            </label>
                            <label className="grid gap-1">
                              <span className="text-[11px] uppercase tracking-[0.12em] text-slate-300">Username</span>
                              <input name="username" defaultValue={selectedDirectoryEntry?.username ?? selectedIntakeReport.subjectUsername ?? ""} required className="rounded border border-blue-900/60 bg-slate-950/80 px-3 py-2 text-sm text-slate-100" />
                            </label>
                            <label className="grid gap-1">
                              <span className="text-[11px] uppercase tracking-[0.12em] text-slate-300">Guild</span>
                              <input name="guild" defaultValue={selectedDirectoryEntry?.guild ?? ""} className="rounded border border-blue-900/60 bg-slate-950/80 px-3 py-2 text-sm text-slate-100" />
                            </label>
                            <label className="grid gap-1">
                              <span className="text-[11px] uppercase tracking-[0.12em] text-slate-300">Rank</span>
                              <input name="rank" defaultValue={selectedDirectoryEntry?.rank ?? ""} className="rounded border border-blue-900/60 bg-slate-950/80 px-3 py-2 text-sm text-slate-100" />
                            </label>
                          </div>

                          <div>
                            <p className="mb-1 text-[11px] uppercase tracking-[0.12em] text-slate-300">Status Tags</p>
                            <div className="flex flex-wrap gap-1.5">
                              {STATUS_TAG_OPTIONS.map((opt) => (
                                <label key={opt} className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] ${(proposedStatusTags ?? []).includes(opt) ? "border-amber-400/80 bg-amber-500/20 text-amber-50" : "border-slate-500/50 bg-slate-900/70 text-slate-100"}`}>
                                  <input type="checkbox" name="statusTags" value={opt} defaultChecked={(proposedStatusTags ?? []).includes(opt)} className="h-3 w-3" />
                                  <span>{opt}</span>
                                </label>
                              ))}
                            </div>
                          </div>

                          <div className="grid gap-2 md:grid-cols-2">
                            <div>
                              <p className="mb-1 text-[11px] uppercase tracking-[0.12em] text-slate-300">Type of Cheating</p>
                              <div className="flex flex-wrap gap-1.5">
                                {CHEATING_TAG_OPTIONS.map((opt) => (
                                  <label key={opt} className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] ${(proposedCheating ?? []).includes(opt) ? "border-emerald-400/80 bg-emerald-500/20 text-emerald-50" : "border-slate-500/50 bg-slate-900/70 text-slate-100"}`}>
                                    <input type="checkbox" name="typeOfCheating" value={opt} defaultChecked={(proposedCheating ?? []).includes(opt)} className="h-3 w-3" />
                                    <span>{opt}</span>
                                  </label>
                                ))}
                              </div>
                            </div>
                            <div>
                              <p className="mb-1 text-[11px] uppercase tracking-[0.12em] text-slate-300">Red Flags</p>
                              <div className="flex flex-wrap gap-1.5">
                                {RED_FLAG_OPTIONS.map((opt) => (
                                  <label key={opt} className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] ${(proposedRedFlags ?? []).includes(opt) ? "border-rose-400/80 bg-rose-500/20 text-rose-50" : "border-slate-500/50 bg-slate-900/70 text-slate-100"}`}>
                                    <input type="checkbox" name="redFlags" value={opt} defaultChecked={(proposedRedFlags ?? []).includes(opt)} className="h-3 w-3" />
                                    <span>{opt}</span>
                                  </label>
                                ))}
                              </div>
                            </div>
                          </div>

                          <div className="grid gap-2 md:grid-cols-2">
                            <label className="grid gap-1">
                              <span className="text-[11px] uppercase tracking-[0.12em] text-slate-300">Reviewed By</span>
                              <input name="reviewedBy" defaultValue={selectedDirectoryEntry?.reviewedBy ?? selectedIntakeReport.reviewedBy?.name ?? selectedIntakeReport.reviewedBy?.email ?? ""} className="rounded border border-blue-900/60 bg-slate-950/80 px-3 py-2 text-sm text-slate-100" />
                            </label>
                            <label className="grid gap-1">
                              <span className="text-[11px] uppercase tracking-[0.12em] text-slate-300">Confidence (1-5)</span>
                              <input type="number" min={1} max={5} name="confidenceScore" defaultValue={proposedConfidence} className="rounded border border-blue-900/60 bg-slate-950/80 px-3 py-2 text-sm text-slate-100" />
                            </label>
                          </div>

                          <label className="grid gap-1">
                            <span className="text-[11px] uppercase tracking-[0.12em] text-slate-300">Notes</span>
                            <textarea name="notesEvidence" rows={4} defaultValue={selectedDirectoryEntry?.notesEvidence ?? ""} className="rounded border border-blue-900/60 bg-slate-950/80 px-3 py-2 text-sm text-slate-100" />
                          </label>

                          <label className="grid gap-1">
                            <span className="text-[11px] uppercase tracking-[0.12em] text-slate-300">Attachment / Link Notes</span>
                            <textarea name="notesAttachments" rows={3} defaultValue={(selectedIntakeReport.attachments ?? []).map((item: any) => item.storagePath).join("\n")} className="rounded border border-blue-900/60 bg-slate-950/80 px-3 py-2 text-sm text-slate-100" />
                          </label>

                          <div className="rounded-lg border border-blue-900/40 bg-blue-950/15 p-3">
                            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-blue-200">Attachment Visibility</p>
                            <p className="mt-1 text-xs text-slate-300">Hide sensitive files from the public directory card.</p>
                            <div className="mt-2 space-y-1">
                              {selectedIntakeReport.attachments?.length ? selectedIntakeReport.attachments.map((item: any) => (
                                <label key={item.id} className="flex items-center justify-between gap-2 rounded border border-slate-700/70 bg-slate-950/70 px-2 py-1 text-xs text-slate-200">
                                  <span className="truncate">{item.originalName}</span>
                                  <span className="inline-flex items-center gap-1">
                                    <input type="checkbox" name="hiddenAttachmentIds" value={item.id} defaultChecked={Boolean(item.hideFromDirectory)} />
                                    Hide
                                  </span>
                                </label>
                              )) : <p className="text-xs text-slate-500">No attachments</p>}
                            </div>
                          </div>

                          <div className="rounded-lg border border-emerald-500/35 bg-emerald-950/15 p-3">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-emerald-200">Apply & Resolve</p>
                              <button className="rounded-md border border-emerald-500/60 bg-emerald-600 px-3 py-1.5 text-xs font-bold text-emerald-50 hover:bg-emerald-500">
                                Apply Changes & Resolve Intake
                              </button>
                            </div>
                          </div>
                        </form>
                      ) : null}
                    </section>

                    <section className="grid gap-3 lg:grid-cols-3">
                      <form action={saveMaintainerDraft} className="rounded-xl border border-blue-900/45 bg-blue-950/15 p-3 space-y-2">
                        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-blue-200">Save Draft</p>
                        <input type="hidden" name="reportId" value={selectedIntakeReport.id} />
                        <textarea name="note" rows={3} placeholder="Draft note for handoff" className="w-full rounded border border-slate-700 bg-slate-950/80 px-2 py-1.5 text-xs text-slate-100" />
                        <button className="w-full rounded-md border border-blue-700/80 bg-blue-950/50 px-2.5 py-1.5 text-xs font-semibold text-slate-100 hover:bg-blue-900/60">Save Draft</button>
                      </form>

                      <form action={sendBackToOfficer} className="rounded-xl border border-amber-500/35 bg-amber-950/15 p-3 space-y-2">
                        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-amber-200">Send Back To Officer</p>
                        <input type="hidden" name="reportId" value={selectedIntakeReport.id} />
                        <textarea name="reason" required rows={3} placeholder="Reason for sending back" className="w-full rounded border border-slate-700 bg-slate-950/80 px-2 py-1.5 text-xs text-slate-100" />
                        <button className="w-full rounded-md border border-amber-500/60 bg-amber-600 px-2.5 py-1.5 text-xs font-semibold text-amber-950 hover:bg-amber-500">Send Back</button>
                      </form>

                      <div className="rounded-xl border border-slate-700/80 bg-slate-900/45 p-3 space-y-2">
                        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-300">Resolve / Notes</p>
                        <form action={addMaintainerNote} className="space-y-2">
                          <input type="hidden" name="reportId" value={selectedIntakeReport.id} />
                          <textarea name="note" required rows={2} placeholder="Add intake note" className="w-full rounded border border-slate-700 bg-slate-950/80 px-2 py-1.5 text-xs text-slate-100" />
                          <button className="w-full rounded-md border border-slate-600 bg-slate-800 px-2.5 py-1 text-xs text-slate-100 hover:bg-slate-700">Add Note</button>
                        </form>
                        <form action={markReportResolved}>
                          <input type="hidden" name="reportId" value={selectedIntakeReport.id} />
                          <button className="w-full rounded-md border border-emerald-500/50 bg-emerald-600 px-2.5 py-1.5 text-xs font-semibold text-emerald-50 hover:bg-emerald-500">Resolve Without Changes</button>
                        </form>
                      </div>
                    </section>
                  </>
                ) : null}
              </div>
            </div>
          ) : (
            <div className="rounded-[4px] border border-slate-700/70 bg-slate-950/70 p-4 text-sm text-slate-400">
              0 intake reports. Nothing is waiting.
            </div>
          )}
        </section>
      ) : null}

      {tab === "directory" ? (
        <section className="rounded-[4px] border border-slate-700/80 bg-slate-950/80 p-4">
          <h2 className="text-sm font-semibold text-slate-200">Directory Reference</h2>
          <p className="mt-1 text-sm text-slate-300">
            Directory changes stay report-linked. Open an approved report, then apply updates in
            the directory.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Link
              href="/directory"
              className="rounded-[3px] border border-slate-600 bg-slate-900/70 px-3 py-2 text-sm text-slate-100 hover:bg-slate-800"
            >
              Open Directory
            </Link>
            <Link
              href="/maintainer/queue"
              className="rounded-[3px] border border-slate-600/80 bg-slate-900/70 px-3 py-2 text-sm text-slate-200 hover:bg-slate-800"
            >
              Open Report Intake
            </Link>
          </div>
        </section>
      ) : null}

      {tab === "stale" ? (
        <section className="space-y-3">
          <div className="rounded-[4px] border border-slate-700/80 bg-slate-950/80 p-4">
            <h2 className="text-sm font-semibold text-slate-200">Stale Entries</h2>
            <p className="mt-1 text-xs text-slate-400">
              Entries older than 30 days are listed here for verification.
            </p>
          </div>
          {data.staleEntries.length > 0 ? (
            data.staleEntries.map((entry) => (
              <article
                key={entry.uuid}
                className="rounded-[4px] border border-slate-700/80 bg-slate-950/80 p-3"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="font-semibold text-slate-100">{entry.username}</p>
                    <p className="text-xs text-slate-400">
                      Last Updated: {entry.lastUpdated ? entry.lastUpdated.toLocaleString() : "Never"}
                    </p>
                  </div>
                  <div className="text-xs text-slate-300">Flags: {entry.redFlags.length}</div>
                </div>
                <div className="mt-2">
                  <Link
                    href={`/directory?view=cards&entryUuid=${encodeURIComponent(entry.uuid)}`}
                    className="rounded-[3px] border border-slate-600/80 bg-slate-900/70 px-2.5 py-1 text-xs text-slate-200 hover:bg-slate-800"
                  >
                    Open entry
                  </Link>
                </div>
              </article>
            ))
          ) : (
            <div className="rounded-[4px] border border-slate-700/70 bg-slate-950/70 p-4 text-sm text-slate-400">
              0 stale entries. Everything looks up to date.
            </div>
          )}
        </section>
      ) : null}

      {tab === "analytics" ? (
        <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          <article className="rounded-[4px] border border-slate-700/70 bg-slate-950/80 p-4">
            <p className="text-xs font-semibold text-slate-400">Total Reports</p>
            <p className="mt-1 text-2xl font-extrabold text-slate-50">{data.totalReports}</p>
            <p className="mt-1 text-xs text-slate-500">Total reports over time</p>
          </article>
          <article className="rounded-[4px] border border-slate-700/70 bg-slate-950/80 p-4">
            <p className="text-xs font-semibold text-slate-400">Resolved</p>
            <p className="mt-1 text-2xl font-extrabold text-slate-100">{data.resolvedReports}</p>
            <p className="mt-1 text-xs text-slate-500">
              {data.resolvedReports > 0 ? "Completed through the workflow" : "No resolved reports yet"}
            </p>
          </article>
          <article className="rounded-[4px] border border-slate-700/70 bg-slate-950/80 p-4">
            <p className="text-xs font-semibold text-slate-400">Resolved (Last 24h)</p>
            <p className="mt-1 text-2xl font-extrabold text-slate-100">{data.resolvedLast24h}</p>
            <p className="mt-1 text-xs text-slate-500">Reports resolved in the last day</p>
          </article>
          <article className="rounded-[4px] border border-slate-700/70 bg-slate-950/80 p-4">
            <p className="text-xs font-semibold text-slate-400">Active Queue</p>
            <p className="mt-1 text-2xl font-extrabold text-slate-100">
              {data.pendingReports + intakeOpenCount}
            </p>
            <p className="mt-1 text-xs text-slate-500">
              {data.pendingReports + intakeOpenCount > 0
                ? "Needs active attention"
                : "No active queue items"}
            </p>
          </article>
          <article className="rounded-[4px] border border-slate-700/70 bg-slate-950/80 p-4">
            <p className="text-xs font-semibold text-slate-400">Avg Review Latency</p>
            <p className="mt-1 text-2xl font-extrabold text-slate-100">{data.avgReviewLatencyHours}</p>
            <p className="mt-1 text-xs text-slate-500">Based on recent reviewed reports</p>
          </article>
          <article className="rounded-[4px] border border-slate-700/70 bg-slate-950/80 p-4">
            <p className="text-xs font-semibold text-slate-400">Staff Active Today</p>
            <p className="mt-1 text-2xl font-extrabold text-slate-100">{data.staffActiveToday}</p>
            <p className="mt-1 text-xs text-slate-500">Unique reviewers with actions today</p>
          </article>
        </section>
      ) : null}
        </div>
      </div>
    </main>
  );
}

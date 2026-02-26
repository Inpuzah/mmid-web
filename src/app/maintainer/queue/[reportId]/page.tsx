import Link from "next/link";
import { notFound } from "next/navigation";
import { requireMaintainerDashboardAccess } from "@/lib/authz";
import { prisma } from "@/lib/prisma";
import { isReportSchemaReady } from "@/lib/report-schema";
import ImmutableSection from "@/components/reports/ImmutableSection";
import SeverityBadge from "@/components/reports/SeverityBadge";
import CopyValueButton from "@/components/reports/CopyValueButton.client";
import { addMaintainerNote, markReportResolved } from "../../reports/actions";

export const dynamic = "force-dynamic";

export default async function ReportDirectoryActionPage({
  params,
}: {
  params: Promise<{ reportId: string }>;
}) {
  await requireMaintainerDashboardAccess();
  const ready = await isReportSchemaReady();
  if (!ready) {
    return (
      <div className="space-y-4">
        <div className="rounded-[4px] border border-slate-700/80 bg-slate-950/80 px-4 py-3 text-sm text-slate-200">
          Report system tables are missing in this database. Run `npx prisma migrate deploy`.
        </div>
      </div>
    );
  }

  const { reportId } = await params;
  const reportDb = prisma as any;
  const report = await reportDb.report.findUnique({
    where: { id: reportId },
    include: {
      reporter: { select: { name: true, email: true } },
      reviewedBy: { select: { name: true, email: true } },
      replayEvidence: true,
      videoEvidence: true,
      attachments: true,
      maintainerNotes: {
        include: { author: { select: { name: true, email: true } } },
        orderBy: { createdAt: "desc" },
      },
    },
  });

  if (!report) notFound();

  const directoryHref = report.subjectUuid
    ? `/directory?view=cards&entryUuid=${encodeURIComponent(report.subjectUuid)}&reportId=${encodeURIComponent(report.id)}`
    : `/directory?view=cards&q=${encodeURIComponent(report.subjectUsername)}&reportId=${encodeURIComponent(report.id)}`;

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-extrabold text-slate-100">
        Report → Directory Action
      </h1>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <div className="space-y-3">
          <ImmutableSection title="Report Summary">
            <div className="space-y-2 text-sm text-slate-200">
              <p className="font-semibold text-slate-100">{report.subjectUsername}</p>
              {report.subjectUuid ? <p className="text-xs text-slate-400">UUID: {report.subjectUuid}</p> : null}
              <SeverityBadge severity={report.severity} />
              <p className="text-xs text-slate-400">Status: {report.status}</p>
              <p className="text-xs text-slate-400">
                Reporter: {report.reporter?.name ?? report.reporter?.email ?? "Unknown"}
              </p>
              <p className="text-xs text-slate-400">
                Approved by: {report.reviewedBy?.name ?? report.reviewedBy?.email ?? "Officer"}
              </p>
            </div>
          </ImmutableSection>

          <ImmutableSection title="Evidence">
            <p className="text-xs text-slate-300">Replay IDs</p>
            <ul className="mb-2 mt-1 space-y-1 text-sm text-slate-200">
              {report.replayEvidence.length ? report.replayEvidence.map((row: any) => (
                <li key={row.id} className="flex items-center justify-between gap-2 rounded border border-slate-700/70 bg-slate-900/50 px-2 py-1">
                  <span className="truncate">{row.replayId}</span>
                  <CopyValueButton value={row.replayId} />
                </li>
              )) : <li className="text-slate-500">None</li>}
            </ul>

            <p className="text-xs text-slate-300">Videos</p>
            <ul className="mb-2 mt-1 space-y-1 text-sm text-slate-200">
              {report.videoEvidence.length ? report.videoEvidence.map((row: any) => (
                <li key={row.id} className="space-y-1 rounded border border-slate-700/70 bg-slate-900/50 px-2 py-1">
                  <a href={row.url} target="_blank" rel="noreferrer" className="block break-all text-blue-300 underline">{row.url}</a>
                  <CopyValueButton value={row.url} />
                </li>
              )) : <li className="text-slate-500">None</li>}
            </ul>

            <p className="text-xs text-slate-300">Attachments</p>
            <ul className="mt-1 space-y-1 text-sm text-slate-200">
              {report.attachments.length ? report.attachments.map((row: any) => (
                <li key={row.id} className="space-y-1 rounded border border-slate-700/70 bg-slate-900/50 px-2 py-1">
                  <a href={row.storagePath} target="_blank" rel="noreferrer" className="block break-all text-blue-300 underline">{row.originalName}</a>
                  <CopyValueButton value={row.storagePath} label="Copy link" />
                </li>
              )) : <li className="text-slate-500">None</li>}
            </ul>
          </ImmutableSection>
        </div>

        <div className="space-y-3">
          <section className="rounded-[4px] border border-slate-700/80 bg-slate-950/85 p-4">
            <h2 className="text-sm font-semibold uppercase tracking-[0.16em] text-slate-200">Directory Actions</h2>
            <p className="mt-2 text-sm text-slate-300">Open evidence above, then add or update the directory entry in report-linked mode.</p>

            <div className="mt-3 flex flex-wrap gap-2">
              <Link
                href={directoryHref}
                className="rounded-[3px] border border-slate-500 bg-slate-200 px-3 py-2 text-[12px] font-semibold text-slate-900 hover:bg-slate-100"
              >
                Apply in Directory
              </Link>
              <form action={markReportResolved}>
                <input type="hidden" name="reportId" value={report.id} />
                <button className="rounded-[3px] border border-emerald-500/50 bg-emerald-600 px-3 py-2 text-[12px] font-semibold text-emerald-50 hover:bg-emerald-500">
                  Resolve Without Directory Update
                </button>
              </form>
            </div>
          </section>

          <section className="rounded-[4px] border border-slate-700/80 bg-slate-950/80 p-4">
            <h2 className="text-sm font-semibold uppercase tracking-[0.16em] text-slate-200">Maintainer Notes</h2>
            <form action={addMaintainerNote} className="mt-3 space-y-2">
              <input type="hidden" name="reportId" value={report.id} />
              <textarea
                name="note"
                required
                rows={4}
                placeholder="Add context for directory action"
                className="w-full rounded-[3px] border border-slate-700 bg-slate-950/80 px-3 py-2 text-sm text-slate-100"
              />
              <button className="rounded-[3px] border border-slate-600 bg-slate-800 px-3 py-2 text-sm text-slate-100 hover:bg-slate-700">
                Add Note
              </button>
            </form>

            <ul className="mt-3 space-y-2">
              {report.maintainerNotes.map((note: any) => (
                <li key={note.id} className="rounded-[3px] border border-slate-700/70 bg-slate-900/60 p-2 text-sm text-slate-200">
                  <p>{note.note}</p>
                  <p className="mt-1 text-xs text-slate-500">
                    {note.author?.name ?? note.author?.email ?? "Maintainer"} · {note.createdAt.toLocaleString()}
                  </p>
                </li>
              ))}
              {report.maintainerNotes.length === 0 ? (
                <li className="text-xs text-slate-500">No notes yet.</li>
              ) : null}
            </ul>
          </section>
        </div>
      </div>
    </div>
  );
}

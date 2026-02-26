import { requireMaintainerDashboardAccess } from "@/lib/authz";
import { prisma } from "@/lib/prisma";
import { addMaintainerNote, markReportResolved } from "../reports/actions";
import Link from "next/link";
import { isReportSchemaReady } from "@/lib/report-schema";

export const dynamic = "force-dynamic";

export default async function MaintainerQueuePage() {
  const { role } = await requireMaintainerDashboardAccess();
  const reportsReady = await isReportSchemaReady();
  if (!reportsReady) {
    return (
      <div className="space-y-4">
        <h1 className="text-xl font-extrabold text-slate-100">
          Directory Review Queue
        </h1>
        <div className="mt-4 rounded-[4px] border border-slate-700/80 bg-slate-950/80 px-4 py-3 text-sm text-slate-200">
          Report system tables are missing in this database. Run `npx prisma migrate deploy`.
        </div>
      </div>
    );
  }

  const reportDb = prisma as any;

  let supportsDraftStatus = false;
  try {
    await reportDb.report.count({ where: { status: "MAINTAINER_DRAFT" } });
    supportsDraftStatus = true;
  } catch {
    supportsDraftStatus = false;
  }

  const reports = await reportDb.report.findMany({
    where: {
      status: {
        in: supportsDraftStatus
          ? ["APPROVED_FOR_MAINTAINER", "MAINTAINER_DRAFT"]
          : ["APPROVED_FOR_MAINTAINER"],
      },
    },
    include: {
      replayEvidence: true,
      videoEvidence: true,
      attachments: true,
      maintainerNotes: {
        include: {
          author: { select: { name: true, email: true } },
        },
        orderBy: { createdAt: "desc" },
      },
      reviewedBy: { select: { name: true, email: true } },
    },
    orderBy: { approvedAt: "asc" },
  });

  const canMaintain = role === "ADMIN" || role === "MAINTAINER";

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-extrabold text-slate-100">
        Directory Review Queue
      </h1>

      <p className="mt-2 text-sm text-slate-300">
        Approved reports waiting on maintainer action. Evidence stays immutable; maintainers add notes only.
      </p>

      <div className="mt-5 space-y-4">
        {reports.map((report: any) => {
          const reportEntryTarget = report.subjectUuid
            ? `/directory?view=cards&entryUuid=${encodeURIComponent(report.subjectUuid)}&reportId=${encodeURIComponent(report.id)}`
            : `/directory?view=cards&q=${encodeURIComponent(report.subjectUsername)}&reportId=${encodeURIComponent(report.id)}`;

          return (
          <section
            key={report.id}
            className="rounded-[4px] border border-slate-700/80 bg-slate-950/85 p-4"
          >
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <h2 className="text-base font-bold text-slate-100">{report.subjectUsername}</h2>
                <p className="text-xs text-slate-400">
                  Approved by {report.reviewedBy?.name ?? report.reviewedBy?.email ?? "Officer"} · {report.approvedAt?.toLocaleString()}
                </p>
                <p className="text-xs text-slate-400">Severity {report.severity}</p>
              </div>
              <div className="text-xs text-slate-400">Status {report.status}</div>
            </div>

            <div className="mt-3 grid gap-3 md:grid-cols-2 text-sm">
              <div>
                <p className="font-semibold text-slate-200">Reason</p>
                <p className="text-slate-300 whitespace-pre-wrap">{report.reason}</p>
              </div>
              <div>
                <p className="font-semibold text-slate-200">Evidence Summary</p>
                <p className="text-slate-300 whitespace-pre-wrap">{report.evidenceDescription}</p>
              </div>
            </div>

            <div className="mt-3 text-sm text-slate-300">
              <span className="font-semibold text-slate-200">Evidence Counts:</span>{" "}
              {report.replayEvidence.length} replay IDs, {report.videoEvidence.length} links, {report.attachments.length} files
            </div>

            <div className="mt-2 grid gap-2 text-xs text-slate-300 md:grid-cols-3">
              <div className="rounded border border-slate-700/70 bg-slate-900/50 p-2">
                <p className="font-semibold text-slate-200">Replay IDs</p>
                <ul className="mt-1 space-y-1">
                  {report.replayEvidence.slice(0, 3).map((item: any) => (
                    <li key={item.id} className="break-all">{item.replayId}</li>
                  ))}
                  {report.replayEvidence.length === 0 ? <li className="text-slate-500">None</li> : null}
                </ul>
              </div>
              <div className="rounded border border-slate-700/70 bg-slate-900/50 p-2">
                <p className="font-semibold text-slate-200">Video links</p>
                <ul className="mt-1 space-y-1">
                  {report.videoEvidence.slice(0, 2).map((item: any) => (
                    <li key={item.id} className="break-all"><a href={item.url} target="_blank" rel="noreferrer" className="underline text-blue-300">Open video</a></li>
                  ))}
                  {report.videoEvidence.length === 0 ? <li className="text-slate-500">None</li> : null}
                </ul>
              </div>
              <div className="rounded border border-slate-700/70 bg-slate-900/50 p-2">
                <p className="font-semibold text-slate-200">Attachments</p>
                <ul className="mt-1 space-y-1">
                  {report.attachments.slice(0, 2).map((item: any) => (
                    <li key={item.id} className="break-all"><a href={item.storagePath} target="_blank" rel="noreferrer" className="underline text-blue-300">{item.originalName}</a></li>
                  ))}
                  {report.attachments.length === 0 ? <li className="text-slate-500">None</li> : null}
                </ul>
              </div>
            </div>

            {canMaintain ? (
              <div className="mt-3 flex flex-wrap gap-2">
                <Link
                  href={`/maintainer/queue/${encodeURIComponent(report.id)}`}
                  className="inline-flex rounded-[3px] border border-slate-600/80 bg-slate-900/70 px-3 py-2 text-[12px] font-semibold text-slate-200 hover:bg-slate-800"
                >
                  View Report
                </Link>
                <Link
                  href={reportEntryTarget}
                  className="inline-flex rounded-[3px] border border-slate-500 bg-slate-200 px-3 py-2 text-[12px] font-semibold text-slate-900 hover:bg-slate-100"
                >
                  Apply in Directory
                </Link>
              </div>
            ) : null}

            <div className="mt-4 space-y-2">
              <p className="text-sm font-semibold text-slate-200">Maintainer Notes</p>
              {report.maintainerNotes.length > 0 ? (
                <ul className="space-y-2">
                  {report.maintainerNotes.map((note: any) => (
                    <li key={note.id} className="rounded border border-slate-700/70 bg-slate-900/60 p-2 text-sm">
                      <p className="text-slate-300 whitespace-pre-wrap">{note.note}</p>
                      <p className="mt-1 text-xs text-slate-500">
                        {note.author.name ?? note.author.email ?? "Maintainer"} · {note.createdAt.toLocaleString()}
                      </p>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-xs text-slate-500">No notes yet.</p>
              )}

              {canMaintain ? (
                <form action={addMaintainerNote} className="flex flex-wrap items-center gap-2">
                  <input type="hidden" name="reportId" value={report.id} />
                  <input
                    name="note"
                    required
                    placeholder="Add maintainer note"
                    className="min-w-[280px] flex-1 px-3 py-2 rounded-[3px] border border-slate-700 bg-slate-950/80 text-slate-100 text-sm"
                  />
                  <button className="px-3 py-2 rounded-[3px] border border-slate-600 bg-slate-800 hover:bg-slate-700 text-slate-100">
                    Add Note
                  </button>
                </form>
              ) : null}
            </div>

            {canMaintain ? (
              <form action={markReportResolved} className="mt-4">
                <input type="hidden" name="reportId" value={report.id} />
                <button className="px-3 py-2 rounded-[3px] border border-emerald-500/50 bg-emerald-600 hover:bg-emerald-500 text-emerald-50">
                  Mark Resolved
                </button>
              </form>
            ) : null}
          </section>
          );
        })}

        {reports.length === 0 ? (
          <div className="rounded-[4px] border border-slate-700/70 bg-slate-950/70 p-4 text-sm text-slate-400">
            No approved reports waiting for maintainer action.
          </div>
        ) : null}
      </div>
    </div>
  );
}

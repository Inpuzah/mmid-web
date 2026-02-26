import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/auth";
import { isReportSchemaReady } from "@/lib/report-schema";

export const dynamic = "force-dynamic";

function fmtDate(d: Date | null | undefined) {
  if (!d) return "—";
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(d);
}

export default async function ProfilePage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  const userId = (session.user as any)?.id as string | undefined;
  const email = session.user?.email ?? undefined;

  const user = userId
    ? await prisma.user.findUnique({ where: { id: userId } })
    : email
    ? await prisma.user.findUnique({ where: { email } })
    : null;

  if (!user) redirect("/login");

  const reportsReady = await isReportSchemaReady();
  const reportDb = prisma as any;
  const [
    totalReports,
    pendingReports,
    approvedReports,
    rejectedReports,
    resolvedReports,
    recentReports,
    forumThreadsCount,
    forumPostsCount,
  ] = await Promise.all([
    reportsReady ? reportDb.report.count({ where: { reporterId: user.id } }) : Promise.resolve(0),
    reportsReady
      ? reportDb.report.count({ where: { reporterId: user.id, status: { in: ["SUBMITTED", "UNDER_REVIEW"] } } })
      : Promise.resolve(0),
    reportsReady
      ? reportDb.report.count({ where: { reporterId: user.id, status: "APPROVED_FOR_MAINTAINER" } })
      : Promise.resolve(0),
    reportsReady
      ? reportDb.report.count({ where: { reporterId: user.id, status: "REJECTED" } })
      : Promise.resolve(0),
    reportsReady
      ? reportDb.report.count({ where: { reporterId: user.id, status: "RESOLVED" } })
      : Promise.resolve(0),
    reportsReady
      ? reportDb.report.findMany({
          where: { reporterId: user.id },
          orderBy: { createdAt: "desc" },
          take: 25,
          select: {
            id: true,
            subjectUsername: true,
            subjectUuid: true,
            severity: true,
            status: true,
            createdAt: true,
          },
        })
      : Promise.resolve([]),
    prisma.forumThread.count({ where: { authorId: user.id } }),
    prisma.forumPost.count({ where: { authorId: user.id } }),
  ]);

  const displayName = user.email ?? user.name ?? "Account";

  return (
    <main className="space-y-6 py-6 text-sm text-foreground">
      <section className="mx-auto max-w-5xl rounded-[3px] border-2 border-black/80 bg-[radial-gradient(circle_at_top,#1f2937_0%,#020617_65%)] px-5 py-4 shadow-[0_0_0_1px_rgba(0,0,0,0.85),0_10px_0_0_rgba(0,0,0,0.9)]">
        <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-amber-300">Murder Mystery · Profile</p>
            <h1 className="mt-1 text-2xl font-extrabold text-white drop-shadow-[0_0_6px_rgba(0,0,0,0.9)]">{displayName}</h1>
            <p className="mt-1 text-xs text-slate-300/90">Signed in as <span className="font-medium text-slate-50">{displayName}</span></p>
          </div>
          <div className="rounded-[3px] border border-yellow-400/40 bg-black/40 px-3 py-2 text-right shadow-[0_0_0_1px_rgba(0,0,0,0.85)]">
            <div className="text-[10px] uppercase tracking-[0.18em] text-yellow-300/80">Joined MMID</div>
            <div className="text-sm font-semibold text-slate-50">{fmtDate(user.createdAt)}</div>
          </div>
        </header>

        <section className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-5">
          <div className="rounded-[3px] border border-slate-900 bg-slate-950/80 px-3 py-3 text-center shadow-[0_0_0_1px_rgba(0,0,0,0.8)]">
            <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-300/80">Total Reports</div>
            <div className="mt-1 text-2xl font-extrabold text-slate-50">{totalReports}</div>
          </div>
          <div className="rounded-[3px] border border-amber-400/70 bg-amber-900/40 px-3 py-3 text-center shadow-[0_0_0_1px_rgba(0,0,0,0.8)]">
            <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-amber-200/90">Pending</div>
            <div className="mt-1 text-2xl font-extrabold text-amber-300">{pendingReports}</div>
          </div>
          <div className="rounded-[3px] border border-emerald-500/70 bg-emerald-900/40 px-3 py-3 text-center shadow-[0_0_0_1px_rgba(0,0,0,0.8)]">
            <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-emerald-200/90">Approved</div>
            <div className="mt-1 text-2xl font-extrabold text-emerald-300">{approvedReports}</div>
          </div>
          <div className="rounded-[3px] border border-rose-500/70 bg-rose-900/40 px-3 py-3 text-center shadow-[0_0_0_1px_rgba(0,0,0,0.8)]">
            <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-rose-200/90">Rejected</div>
            <div className="mt-1 text-2xl font-extrabold text-rose-300">{rejectedReports}</div>
          </div>
          <div className="rounded-[3px] border border-cyan-400/70 bg-cyan-900/30 px-3 py-3 text-center shadow-[0_0_0_1px_rgba(0,0,0,0.8)]">
            <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-cyan-200/90">Resolved</div>
            <div className="mt-1 text-2xl font-extrabold text-cyan-200">{resolvedReports}</div>
          </div>
        </section>
      </section>

      <section className="mx-auto max-w-5xl">
        <div className="mt-1 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="rounded-[3px] border border-slate-900 bg-slate-950/80 px-3 py-3 text-left shadow-[0_0_0_1px_rgba(0,0,0,0.8)]">
            <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-300/80">Forum Threads</div>
            <div className="mt-1 text-2xl font-extrabold text-slate-50">{forumThreadsCount}</div>
          </div>
          <div className="rounded-[3px] border border-slate-900 bg-slate-950/80 px-3 py-3 text-left shadow-[0_0_0_1px_rgba(0,0,0,0.8)]">
            <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-300/80">Forum Replies</div>
            <div className="mt-1 text-2xl font-extrabold text-slate-50">{forumPostsCount}</div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-5xl space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-yellow-200 drop-shadow-[0_0_4px_rgba(0,0,0,0.9)]">Recent Reports</h2>
          <span className="text-[11px] font-medium uppercase tracking-[0.18em] text-slate-400">Showing latest {recentReports.length} reports</span>
        </div>
        {!reportsReady ? (
          <div className="rounded-[3px] border border-amber-500/60 bg-amber-950/60 px-4 py-3 text-xs text-amber-200">
            Report system tables are missing in this database. Run `npx prisma migrate deploy`.
          </div>
        ) : null}
        <div className="overflow-hidden rounded-[3px] border-2 border-black/80 bg-slate-950/80 shadow-[0_0_0_1px_rgba(0,0,0,0.85),0_6px_0_0_rgba(0,0,0,0.9)]">
          <table className="w-full text-xs">
            <thead className="bg-slate-900/90 text-slate-200">
              <tr className="uppercase tracking-[0.18em] text-[10px]">
                <th className="px-4 py-2 text-left">When</th>
                <th className="px-4 py-2 text-left">Subject</th>
                <th className="px-4 py-2 text-left">Severity</th>
                <th className="px-4 py-2 text-left">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {recentReports.map((report: any) => (
                <tr key={report.id} className="bg-black/40 hover:bg-black/70">
                  <td className="px-4 py-2 whitespace-nowrap text-[11px] text-slate-200">{fmtDate(report.createdAt)}</td>
                  <td className="px-4 py-2 text-[11px] text-slate-100">{report.subjectUsername} {report.subjectUuid ? <span className="text-slate-500">({report.subjectUuid})</span> : null}</td>
                  <td className="px-4 py-2 text-[11px] text-slate-200">{report.severity}</td>
                  <td className="px-4 py-2 text-[11px] text-slate-200">{report.status}</td>
                </tr>
              ))}
              {recentReports.length === 0 ? (
                <tr>
                  <td className="px-4 py-6 text-center text-slate-400" colSpan={4}>No reports submitted yet.</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}

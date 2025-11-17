import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/auth";
import { setVoteHistoryPreference } from "./actions";

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

  const includeVoteHistory = user.showVoteHistoryOnProfile;

  const [totalProposals, approvedProposals, rejectedProposals, pendingProposals, votesCast, recentProposals, recentVotes] =
    await Promise.all([
      prisma.mmidEntryProposal.count({ where: { proposerId: user.id } }),
      prisma.mmidEntryProposal.count({ where: { proposerId: user.id, status: "APPROVED" } }),
      prisma.mmidEntryProposal.count({ where: { proposerId: user.id, status: "REJECTED" } }),
      prisma.mmidEntryProposal.count({ where: { proposerId: user.id, status: "PENDING" } }),
      prisma.mmidEntryVote.count({ where: { userId: user.id } }),
      prisma.mmidEntryProposal.findMany({
        where: { proposerId: user.id },
        orderBy: { createdAt: "desc" },
        take: 25,
        include: { target: true },
      }),
      includeVoteHistory
        ? prisma.mmidEntryVote.findMany({
            where: { userId: user.id },
            orderBy: { createdAt: "desc" },
            take: 25,
            include: { entry: true },
          })
        : Promise.resolve([]),
    ]);

  const displayName = user.email ?? user.name ?? "Account";

  return (
    <main className="space-y-6 py-6 text-sm text-foreground">
      {/* Top profile stat board */}
      <section className="mx-auto max-w-5xl rounded-[3px] border-2 border-black/80 bg-[radial-gradient(circle_at_top,#1f2937_0%,#020617_65%)] px-5 py-4 shadow-[0_0_0_1px_rgba(0,0,0,0.85),0_10px_0_0_rgba(0,0,0,0.9)]">
        <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-amber-300">
              Murder Mystery · Profile
            </p>
            <h1 className="mt-1 text-2xl font-extrabold text-white drop-shadow-[0_0_6px_rgba(0,0,0,0.9)]">
              {displayName}
            </h1>
            <p className="mt-1 text-xs text-slate-300/90">
              Signed in as <span className="font-medium text-slate-50">{displayName}</span>
            </p>
          </div>
          <div className="flex flex-col gap-2 text-xs text-slate-300 sm:items-end">
            <div className="rounded-[3px] border border-yellow-400/40 bg-black/40 px-3 py-2 text-right shadow-[0_0_0_1px_rgba(0,0,0,0.85)]">
              <div className="text-[10px] uppercase tracking-[0.18em] text-yellow-300/80">
                Joined MMID
              </div>
              <div className="text-sm font-semibold text-slate-50">{fmtDate(user.createdAt)}</div>
            </div>
            <form
              action={setVoteHistoryPreference}
              className="flex items-center gap-2 rounded-[3px] border border-slate-700/80 bg-black/40 px-3 py-2 text-[11px] shadow-[0_0_0_1px_rgba(0,0,0,0.85)]"
            >
              <input
                id="showVoteHistory"
                type="checkbox"
                name="showVoteHistory"
                defaultChecked={includeVoteHistory}
                className="h-3.5 w-3.5 rounded-[2px] border border-slate-500 bg-slate-950 align-middle"
              />
              <label htmlFor="showVoteHistory" className="cursor-pointer text-[11px] text-slate-200">
                Show my recent vote activity on my profile
              </label>
              <button
                type="submit"
                className="rounded-[3px] border border-amber-400/60 bg-amber-400 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-black shadow-[0_0_0_1px_rgba(0,0,0,0.85),0_3px_0_0_rgba(0,0,0,0.9)] hover:brightness-110 active:translate-y-[1px] active:shadow-[0_0_0_1px_rgba(0,0,0,0.85),0_1px_0_0_rgba(0,0,0,0.9)]"
              >
                Save
              </button>
            </form>
          </div>
        </header>

        {/* Key stats row */}
        <section className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-5">
          <div className="rounded-[3px] border border-slate-900 bg-slate-950/80 px-3 py-3 text-center shadow-[0_0_0_1px_rgba(0,0,0,0.8)]">
            <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-300/80">
              Total Proposals
            </div>
            <div className="mt-1 text-2xl font-extrabold text-slate-50">{totalProposals}</div>
          </div>
          <div className="rounded-[3px] border border-emerald-500/70 bg-emerald-900/40 px-3 py-3 text-center shadow-[0_0_0_1px_rgba(0,0,0,0.8)]">
            <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-emerald-200/90">
              Approved
            </div>
            <div className="mt-1 text-2xl font-extrabold text-emerald-300">{approvedProposals}</div>
          </div>
          <div className="rounded-[3px] border border-rose-500/70 bg-rose-900/40 px-3 py-3 text-center shadow-[0_0_0_1px_rgba(0,0,0,0.8)]">
            <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-rose-200/90">
              Rejected
            </div>
            <div className="mt-1 text-2xl font-extrabold text-rose-300">{rejectedProposals}</div>
          </div>
          <div className="rounded-[3px] border border-amber-400/70 bg-amber-900/40 px-3 py-3 text-center shadow-[0_0_0_1px_rgba(0,0,0,0.8)]">
            <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-amber-200/90">
              Pending
            </div>
            <div className="mt-1 text-2xl font-extrabold text-amber-300">{pendingProposals}</div>
          </div>
          <div className="rounded-[3px] border border-cyan-400/70 bg-cyan-900/30 px-3 py-3 text-center shadow-[0_0_0_1px_rgba(0,0,0,0.8)]">
            <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-cyan-200/90">
              Votes Cast
            </div>
            <div className="mt-1 text-2xl font-extrabold text-cyan-200">{votesCast}</div>
          </div>
        </section>
      </section>

      {/* Recent proposals table */}
      <section className="mx-auto max-w-5xl space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-yellow-200 drop-shadow-[0_0_4px_rgba(0,0,0,0.9)]">
            Recent Proposals
          </h2>
          <span className="text-[11px] font-medium uppercase tracking-[0.18em] text-slate-400">
            Showing latest {recentProposals.length} proposals
          </span>
        </div>
        <div className="overflow-hidden rounded-[3px] border-2 border-black/80 bg-slate-950/80 shadow-[0_0_0_1px_rgba(0,0,0,0.85),0_6px_0_0_rgba(0,0,0,0.9)]">
          <table className="w-full text-xs">
            <thead className="bg-slate-900/90 text-slate-200">
              <tr className="uppercase tracking-[0.18em] text-[10px]">
                <th className="px-4 py-2 text-left">When</th>
                <th className="px-4 py-2 text-left">Action</th>
                <th className="px-4 py-2 text-left">Entry</th>
                <th className="px-4 py-2 text-left">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {recentProposals.map((p) => (
                <tr key={p.id} className="bg-black/40 hover:bg-black/70">
                  <td className="px-4 py-2 whitespace-nowrap text-[11px] text-slate-200">
                    {fmtDate(p.createdAt)}
                  </td>
                  <td className="px-4 py-2 text-[11px] text-slate-200">{p.action}</td>
                  <td className="px-4 py-2 text-[11px] text-slate-100">
                    {p.target?.username ?? p.targetUuid ?? "New entry"}
                  </td>
                  <td className="px-4 py-2">
                    <span
                      className={`inline-flex items-center rounded-[999px] px-2 py-0.5 text-[10px] font-semibold ${
                        p.status === "APPROVED"
                          ? "bg-emerald-500 text-black"
                          : p.status === "REJECTED"
                          ? "bg-rose-500 text-black"
                          : "bg-slate-700 text-slate-100"
                      }`}
                    >
                      {p.status}
                    </span>
                  </td>
                </tr>
              ))}
              {recentProposals.length === 0 && (
                <tr>
                  <td className="px-4 py-6 text-center text-slate-400" colSpan={4}>
                    You haven't submitted any proposals yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {includeVoteHistory && (
        <section className="mx-auto max-w-5xl space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-cyan-200 drop-shadow-[0_0_4px_rgba(0,0,0,0.9)]">
              Recent Votes
            </h2>
            <span className="text-[11px] font-medium uppercase tracking-[0.18em] text-slate-400">
              Showing latest {recentVotes.length} votes
            </span>
          </div>
          <div className="overflow-hidden rounded-[3px] border-2 border-black/80 bg-slate-950/80 shadow-[0_0_0_1px_rgba(0,0,0,0.85),0_6px_0_0_rgba(0,0,0,0.9)]">
            <table className="w-full text-xs">
              <thead className="bg-slate-900/90 text-slate-200">
                <tr className="uppercase tracking-[0.18em] text-[10px]">
                  <th className="px-4 py-2 text-left">When</th>
                  <th className="px-4 py-2 text-left">Entry</th>
                  <th className="px-4 py-2 text-left">Direction</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {recentVotes.map((v) => (
                  <tr key={v.id} className="bg-black/40 hover:bg-black/70">
                    <td className="px-4 py-2 whitespace-nowrap text-[11px] text-slate-200">
                      {fmtDate(v.createdAt)}
                    </td>
                    <td className="px-4 py-2 text-[11px] text-slate-100">
                      {v.entry?.username ?? v.entryUuid}
                    </td>
                    <td className="px-4 py-2">
                      <span
                        className={`inline-flex items-center rounded-[999px] px-2 py-0.5 text-[10px] font-semibold ${
                          v.value > 0
                            ? "bg-emerald-500 text-black"
                            : "bg-rose-500 text-black"
                        }`}
                      >
                        {v.value > 0 ? "Upvote" : "Downvote"}
                      </span>
                    </td>
                  </tr>
                ))}
                {recentVotes.length === 0 && (
                  <tr>
                    <td className="px-4 py-6 text-center text-slate-400" colSpan={3}>
                      You haven't voted on any entries yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </main>
  );
}

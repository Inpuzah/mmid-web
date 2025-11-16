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

  return (
    <main className="mx-auto max-w-5xl px-5 py-8 space-y-8">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Profile</h1>
          <p className="text-sm text-slate-400">
            Signed in as {user.email ?? user.name ?? "account"}
          </p>
        </div>
        <div className="flex flex-col gap-3 sm:items-end text-sm text-slate-400">
          <div>
            <div>Joined MMID</div>
            <div className="font-medium text-slate-100">{fmtDate(user.createdAt)}</div>
          </div>
          <form action={setVoteHistoryPreference} className="flex items-center gap-2 text-xs text-slate-300">
            <input
              id="showVoteHistory"
              type="checkbox"
              name="showVoteHistory"
              defaultChecked={includeVoteHistory}
              className="h-3.5 w-3.5 rounded border border-white/30 bg-slate-900"
            />
            <label htmlFor="showVoteHistory" className="cursor-pointer">
              Show my recent vote activity on my profile
            </label>
            <button
              type="submit"
              className="rounded-md border border-white/20 px-2 py-1 text-[11px] text-slate-100 hover:bg-white/10"
            >
              Save
            </button>
          </form>
        </div>
      </header>

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
          <div className="text-xs text-slate-300 uppercase tracking-wide">Total proposals</div>
          <div className="mt-2 text-2xl font-semibold">{totalProposals}</div>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
          <div className="text-xs text-slate-300 uppercase tracking-wide">Approved</div>
          <div className="mt-2 text-2xl font-semibold text-emerald-400">{approvedProposals}</div>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
          <div className="text-xs text-slate-300 uppercase tracking-wide">Rejected</div>
          <div className="mt-2 text-2xl font-semibold text-rose-400">{rejectedProposals}</div>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
          <div className="text-xs text-slate-300 uppercase tracking-wide">Pending proposals</div>
          <div className="mt-2 text-2xl font-semibold text-amber-300">{pendingProposals}</div>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
          <div className="text-xs text-slate-300 uppercase tracking-wide">Votes cast</div>
          <div className="mt-2 text-2xl font-semibold">{votesCast}</div>
        </div>
      </section>

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Your recent proposals</h2>
          <span className="text-xs text-slate-400">Showing latest {recentProposals.length} proposals</span>
        </div>
        <div className="overflow-hidden rounded-xl border border-white/10">
          <table className="w-full text-sm">
            <thead className="bg-slate-800/60 text-slate-300">
              <tr>
                <th className="px-4 py-2 text-left">When</th>
                <th className="px-4 py-2 text-left">Action</th>
                <th className="px-4 py-2 text-left">Entry</th>
                <th className="px-4 py-2 text-left">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {recentProposals.map((p) => (
                <tr key={p.id} className="hover:bg-white/5">
                  <td className="px-4 py-2 whitespace-nowrap">{fmtDate(p.createdAt)}</td>
                  <td className="px-4 py-2">{p.action}</td>
                  <td className="px-4 py-2">
                    {p.target?.username ?? p.targetUuid ?? "New entry"}
                  </td>
                  <td className="px-4 py-2">
                    <span
                      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${
                        p.status === "APPROVED"
                          ? "bg-emerald-600/80 text-white"
                          : p.status === "REJECTED"
                          ? "bg-rose-600/80 text-white"
                          : "bg-slate-700/80 text-slate-100"
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
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Your recent votes</h2>
            <span className="text-xs text-slate-400">Showing latest {recentVotes.length} votes</span>
          </div>
          <div className="overflow-hidden rounded-xl border border-white/10">
            <table className="w-full text-sm">
              <thead className="bg-slate-800/60 text-slate-300">
                <tr>
                  <th className="px-4 py-2 text-left">When</th>
                  <th className="px-4 py-2 text-left">Entry</th>
                  <th className="px-4 py-2 text-left">Direction</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {recentVotes.map((v) => (
                  <tr key={v.id} className="hover:bg-white/5">
                    <td className="px-4 py-2 whitespace-nowrap">{fmtDate(v.createdAt)}</td>
                    <td className="px-4 py-2">
                      {v.entry?.username ?? v.entryUuid}
                    </td>
                    <td className="px-4 py-2">
                      <span
                        className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${
                          v.value > 0
                            ? "bg-emerald-600/80 text-white"
                            : "bg-rose-600/80 text-white"
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

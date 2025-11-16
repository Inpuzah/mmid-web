import { prisma } from "@/lib/prisma";
import { requireMaintainer } from "@/lib/authz";

export const dynamic = "force-dynamic";

const FLAG_THRESHOLD = -2; // TODO: raise this when the site is public

export default async function CommunityFlagsPage() {
  await requireMaintainer();

  const grouped = await prisma.mmidEntryVote.groupBy({
    by: ["entryUuid"],
    _sum: { value: true },
    _count: { _all: true },
  });

  const flagged = grouped.filter((g) => (g._sum.value ?? 0) <= FLAG_THRESHOLD);
  const uuids = flagged.map((f) => f.entryUuid);

  const entries = uuids.length
    ? await prisma.mmidEntry.findMany({ where: { uuid: { in: uuids } } })
    : [];
  const entryById = new Map(entries.map((e) => [e.uuid, e] as const));

  const rows = flagged
    .map((f) => ({
      entry: entryById.get(f.entryUuid) ?? null,
      score: f._sum.value ?? 0,
      totalVotes: f._count._all,
    }))
    .sort((a, b) => a.score - b.score);

  return (
    <main className="mx-auto max-w-6xl px-5 py-6 space-y-6">
      <header className="flex items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-semibold">Community flags</h1>
          <p className="text-sm text-slate-400">
            Entries with strong negative community feedback (net score ≤ -2 for now).
          </p>
        </div>
      </header>

      <section className="rounded-xl border border-white/10 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-800/60 text-slate-300">
            <tr>
              <th className="px-4 py-2 text-left">Player</th>
              <th className="px-4 py-2 text-left">Guild</th>
              <th className="px-4 py-2 text-left">Status</th>
              <th className="px-4 py-2 text-left">Score</th>
              <th className="px-4 py-2 text-left">Total votes</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {rows.map((r, idx) => (
              <tr key={r.entry?.uuid ?? idx} className="hover:bg-white/5">
                <td className="px-4 py-2">
                  {r.entry ? (
                    <div>
                      <div className="font-medium">{r.entry.username}</div>
                      <div className="text-xs text-slate-400 break-all">{r.entry.uuid}</div>
                    </div>
                  ) : (
                    <span className="text-slate-400">Unknown entry</span>
                  )}
                </td>
                <td className="px-4 py-2">{r.entry?.guild ?? "—"}</td>
                <td className="px-4 py-2">{r.entry?.status ?? "—"}</td>
                <td className="px-4 py-2 font-semibold text-rose-300">{r.score}</td>
                <td className="px-4 py-2">{r.totalVotes}</td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td className="px-4 py-6 text-center text-slate-400" colSpan={5}>
                  No heavily downvoted entries right now.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </section>
    </main>
  );
}

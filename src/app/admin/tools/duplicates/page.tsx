import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/authz";

export const dynamic = "force-dynamic";

export default async function DuplicatesPage() {
  await requireAdmin();

  const dupes = await prisma.$queryRaw<Array<{ username: string; count: bigint }>>`
    SELECT "username", COUNT(*)::bigint AS count
    FROM "MmidEntry"
    GROUP BY "username"
    HAVING COUNT(*) > 1
    ORDER BY COUNT(*) DESC, "username" ASC
    LIMIT 200
  `;

  return (
    <main className="mx-auto max-w-6xl px-5 py-6">
      <h1 className="text-xl font-extrabold tracking-[0.18em] uppercase text-yellow-200 drop-shadow-[0_0_6px_rgba(0,0,0,0.9)] mb-6">
        Potential Duplicates
      </h1>
      <div className="rounded-[4px] border-2 border-black/80 bg-slate-950/85 overflow-hidden shadow-[0_0_0_1px_rgba(0,0,0,0.9),0_8px_0_0_rgba(0,0,0,0.9)]">
        <table className="w-full text-sm">
          <thead className="bg-black/30 text-white/70">
            <tr>
              <th className="p-3 text-left">Username</th>
              <th className="p-3 text-left">Count</th>
              <th className="p-3 text-left">View</th>
            </tr>
          </thead>
          <tbody>
            {dupes.map((d) => (
              <tr key={d.username} className="border-t border-white/10">
                <td className="p-3 text-white/90">{d.username}</td>
                <td className="p-3 text-white/70">{String(d.count)}</td>
                <td className="p-3">
                  <a className="underline text-white/80" href={`/directory?q=${encodeURIComponent(d.username)}`}>Open in directory</a>
                </td>
              </tr>
            ))}
            {dupes.length === 0 && (
              <tr><td className="p-4 text-white/70" colSpan={3}>No duplicates detected.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </main>
  );
}

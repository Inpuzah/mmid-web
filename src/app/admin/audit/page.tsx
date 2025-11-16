// src/app/admin/audit/page.tsx
import { getServerSession } from "next-auth";
import { authOptions } from "@/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const ACTIONS = [
  "PROPOSAL_CREATED",
  "PROPOSAL_APPROVED",
  "PROPOSAL_REJECTED",
  "ENTRY_CREATED",
  "ENTRY_UPDATED",
  "ENTRY_DELETED",
  "USER_ROLE_CHANGED",
  "AUTH_SIGNIN",
] as const;

function timeAgo(d: Date) {
  const s = Math.floor((Date.now() - d.getTime()) / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const days = Math.floor(h / 24);
  return `${days}d ago`;
}

function firstStr(v: string | string[] | undefined) {
  return Array.isArray(v) ? v[0] : v ?? "";
}

export default async function AuditPage({
  searchParams,
}: {
  // ✅ Next.js 15 RSC: searchParams is a Promise
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await getServerSession(authOptions);
  const role = (session?.user as any)?.role ?? "USER";
  if (role !== "ADMIN") redirect("/"); // strict admin-only

  // Await and read query params
  const sp = await searchParams;
  const action = firstStr(sp.action);
  const q = firstStr(sp.q).trim();
  const take = Math.min(Number(firstStr(sp.take)) || 100, 200);
  const cursor = firstStr(sp.cursor);
  const kind = firstStr(sp.kind).trim(); // "" | "maintainer" | "user"

  const where: any = {};
  if (action) where.action = action;
  if (q) {
    where.OR = [
      { targetId: { contains: q, mode: "insensitive" } },
      // meta searched below (stringified)
    ];
  }
  if (kind === "maintainer") {
    where.actor = { role: { in: ["ADMIN", "MAINTAINER"] } };
  } else if (kind === "user") {
    where.actor = { role: "USER" };
  }

  const logs = await prisma.auditLog.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    include: {
      actor: { select: { id: true, name: true, email: true, image: true, role: true } },
    },
  });

  // Fallback filter on meta (string match)
  const filtered = q
    ? logs.filter((l) => {
        try {
          const s = JSON.stringify(l.meta ?? {});
          return s.toLowerCase().includes(q.toLowerCase());
        } catch {
          return false;
        }
      })
    : logs;

  const nextCursor = filtered.length === take ? filtered[filtered.length - 1].id : undefined;

  return (
    <main className="mx-auto w-full max-w-6xl px-5 py-6">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Audit Log</h1>
      </div>

      <form className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-4">
        <label className="grid gap-1">
          <span className="text-xs text-white/60">Action</span>
          <select
            name="action"
            defaultValue={action}
            className="rounded-md border border-white/10 bg-slate-900 px-3 py-2 text-slate-100"
          >
            <option value="">Any</option>
            {ACTIONS.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </select>
        </label>

        <label className="grid gap-1">
          <span className="text-xs text-white/60">Search (target/meta)</span>
          <input
            name="q"
            defaultValue={q}
            placeholder="proposal id, uuid, email, etc."
            className="rounded-md border border-white/10 bg-slate-900 px-3 py-2 text-slate-100"
          />
        </label>

        <label className="grid gap-1">
          <span className="text-xs text-white/60">Actor type</span>
          <select
            name="kind"
            defaultValue={kind}
            className="rounded-md border border-white/10 bg-slate-900 px-3 py-2 text-slate-100"
          >
            <option value="">Any</option>
            <option value="maintainer">Maintainers (ADMIN / MAINTAINER)</option>
            <option value="user">Users only</option>
          </select>
        </label>

        <div className="flex items-end gap-2">
          <input type="hidden" name="take" value={take} />
          <button className="rounded-md bg-[#ff7a1a] px-4 py-2 font-medium text-black hover:brightness-110">
            Filter
          </button>
          <a
            href="/admin/audit"
            className="rounded-md border border-white/10 bg-white/5 px-4 py-2 text-white/90 hover:bg-white/10"
          >
            Reset
          </a>
        </div>
      </form>

      <div className="overflow-x-auto rounded-xl border border-white/10">
        <table className="min-w-full text-sm">
          <thead className="bg-white/5 text-white/80">
            <tr>
              <th className="px-3 py-2 text-left">Time</th>
              <th className="px-3 py-2 text-left">Action</th>
              <th className="px-3 py-2 text-left">Actor</th>
              <th className="px-3 py-2 text-left">Target</th>
              <th className="px-3 py-2 text-left">Details</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((l) => (
              <tr key={l.id} className="border-t border-white/10 even:bg-white/5">
                <td className="px-3 py-2 whitespace-nowrap">
                  <div className="text-white/90">{timeAgo(l.createdAt)}</div>
                  <div className="text-xs text-white/50">
                    {l.createdAt.toISOString().replace("T", " ").slice(0, 19)}
                  </div>
                </td>
                <td className="px-3 py-2">{l.action}</td>
                <td className="px-3 py-2">
                  {l.actor ? (
                    <>
                      <div className="text-white/90">{l.actor.name ?? l.actor.email ?? l.actor.id}</div>
                      <div className="text-xs text-white/50">{l.actor.role}</div>
                    </>
                  ) : (
                    <span className="text-white/50">system</span>
                  )}
                </td>
                <td className="px-3 py-2">
                  <div className="text-white/90">{l.targetType ?? "—"}</div>
                  <div className="break-all text-xs text-white/50">{l.targetId ?? "—"}</div>
                </td>
                <td className="px-3 py-2">
                  <details className="group">
                    <summary className="cursor-pointer text-white/80 hover:text-white">view</summary>
                    <pre className="mt-1 max-h-60 overflow-auto rounded-md bg-black/40 p-2 text-[11px] leading-relaxed text-white/80">
                      {JSON.stringify(l.meta ?? {}, null, 2)}
                    </pre>
                    {(l.ip || l.userAgent) && (
                      <div className="mt-1 text-[11px] text-white/50">
                        {l.ip ? <span>IP: {l.ip} </span> : null}
                        {l.userAgent ? <span className="block sm:inline">UA: {l.userAgent}</span> : null}
                      </div>
                    )}
                  </details>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={5} className="px-3 py-6 text-center text-white/60">
                  No audit events found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {nextCursor && (
        <div className="mt-4 flex justify-center">
          <a
            className="rounded-md border border-white/10 bg-white/5 px-4 py-2 text-white/90 hover:bg-white/10"
            href={`/admin/audit?${new URLSearchParams({
              action: action || "",
              q: q || "",
              kind: kind || "",
              take: String(take),
              cursor: nextCursor,
            }).toString()}`}
          >
            Load more
          </a>
        </div>
      )}
    </main>
  );
}

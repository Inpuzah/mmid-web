import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/authz";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function AdminHome() {
  await requireAdmin();
  const [pending, entries, users] = await Promise.all([
    prisma.mmidEntryProposal.count({ where: { status: "PENDING" } }),
    prisma.mmidEntry.count(),
    prisma.user.count(),
  ]);

  const Card = ({ title, value, href }: { title: string; value: number | string; href: string }) => (
    <Link
      href={href}
      className="rounded-[4px] border-2 border-black/80 bg-slate-950/85 p-5 shadow-[0_0_0_1px_rgba(0,0,0,0.9),0_8px_0_0_rgba(0,0,0,0.9)] hover:bg-slate-900/85 transition"
    >
      <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-300/90">{title}</div>
      <div className="mt-3 text-2xl font-extrabold text-slate-50">{value}</div>
    </Link>
  );

  return (
    <main className="mx-auto max-w-6xl px-5 py-6">
      <h1 className="text-xl font-extrabold tracking-[0.18em] uppercase text-yellow-200 drop-shadow-[0_0_6px_rgba(0,0,0,0.9)] mb-5">
        Admin
      </h1>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card title="Pending proposals" value={pending} href="/admin/proposals" />
        <Card title="Directory entries" value={entries} href="/directory" />
        <Card title="Users" value={users} href="/admin/users" />
      </div>

      <div className="mt-8 grid gap-3 sm:grid-cols-3">
        <Link
          href="/admin/audit"
          className="rounded-[3px] border-2 border-black/80 bg-slate-950/85 px-4 py-3 text-slate-100 hover:bg-slate-900/85 shadow-[0_0_0_1px_rgba(0,0,0,0.9),0_6px_0_0_rgba(0,0,0,0.9)]"
        >
          View Audit Log
        </Link>
        <Link
          href="/admin/tools/duplicates"
          className="rounded-[3px] border-2 border-black/80 bg-slate-950/85 px-4 py-3 text-slate-100 hover:bg-slate-900/85 shadow-[0_0_0_1px_rgba(0,0,0,0.9),0_6px_0_0_rgba(0,0,0,0.9)]"
        >
          Find Duplicates
        </Link>
        <Link
          href="/admin/tools/stats-sync"
          className="rounded-[3px] border-2 border-black/80 bg-slate-950/85 px-4 py-3 text-slate-100 hover:bg-slate-900/85 shadow-[0_0_0_1px_rgba(0,0,0,0.9),0_6px_0_0_rgba(0,0,0,0.9)]"
        >
          Sync Hypixel stats
        </Link>
        <Link
          href="/admin/tools/minecraft-crawl"
          className="rounded-[3px] border-2 border-black/80 bg-slate-950/85 px-4 py-3 text-slate-100 hover:bg-slate-900/85 shadow-[0_0_0_1px_rgba(0,0,0,0.9),0_6px_0_0_rgba(0,0,0,0.9)]"
        >
          Minecraft crawl debug
        </Link>
        <Link
          href="/admin/tools/hypixel-crawl"
          className="rounded-[3px] border-2 border-black/80 bg-slate-950/85 px-4 py-3 text-slate-100 hover:bg-slate-900/85 shadow-[0_0_0_1px_rgba(0,0,0,0.9),0_6px_0_0_rgba(0,0,0,0.9)]"
        >
          Hypixel stats crawler
        </Link>
      </div>
    </main>
  );
}

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
    <Link href={href} className="rounded-2xl border border-white/10 bg-white/5 p-5 hover:bg-white/10 transition">
      <div className="text-sm text-white/70">{title}</div>
      <div className="mt-2 text-2xl font-semibold text-white/95">{value}</div>
    </Link>
  );

  return (
    <main className="mx-auto max-w-6xl px-5 py-8">
      <h1 className="text-2xl font-semibold mb-6">Admin</h1>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card title="Pending proposals" value={pending} href="/admin/proposals" />
        <Card title="Directory entries" value={entries} href="/directory" />
        <Card title="Users" value={users} href="/admin/users" />
      </div>

      <div className="mt-8 grid gap-3 sm:grid-cols-2">
        <Link href="/admin/audit" className="rounded-xl border border-white/15 bg-white/5 px-4 py-3 text-white/90 hover:bg-white/10">
          View Audit Log
        </Link>
        <Link href="/admin/tools/duplicates" className="rounded-xl border border-white/15 bg-white/5 px-4 py-3 text-white/90 hover:bg-white/10">
          Find Duplicates
        </Link>
      </div>
    </main>
  );
}

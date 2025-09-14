// src/app/admin/sync/page.tsx
import { getServerSession } from "next-auth";
import { authOptions } from "@/auth";
import { redirect } from "next/navigation";
import { syncAction } from "./page.actions";

export const dynamic = "force-dynamic";

export default async function AdminSyncPage() {
  const session = await getServerSession(authOptions);
  const role = (session?.user as any)?.role ?? "USER";
  if (!session || !["ADMIN", "MAINTAINER"].includes(role)) redirect("/");

  return (
    <main className="p-6 space-y-6">
      <h1 className="text-2xl font-semibold">Directory Sync</h1>
      <p className="text-sm text-slate-400">
        Pulls rows from the <code>Directory</code> sheet ({process.env.SHEET_ID}) and upserts by <code>UUID</code>.
      </p>

      <form action={syncAction}>
        <button className="px-4 py-2 rounded-md bg-blue-600 hover:bg-blue-500 text-white">
          Sync Now
        </button>
      </form>

      <p className="text-xs text-slate-500">
        Ensure your sheet headers exactly match: UUID, Username, Guild, Status, Rank, Type of cheating, Reviewed by, Confidence Score, Red Flags, Notes/Evidence, Last Updated, NameMC Link.
      </p>
    </main>
  );
}

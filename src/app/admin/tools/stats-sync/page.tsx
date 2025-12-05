// src/app/admin/tools/stats-sync/page.tsx

import { getServerSession } from "next-auth";
import { authOptions } from "@/auth";
import { redirect } from "next/navigation";
import StatsSyncForm from "./StatsSyncForm";
import { statsSyncAction } from "./page.actions";
import { initialStatsSyncState } from "./state";

export const dynamic = "force-dynamic";

export default async function StatsSyncPage() {
  const session = await getServerSession(authOptions);
  const role = (session?.user as any)?.role ?? "USER";
  if (!session || !["ADMIN", "MAINTAINER"].includes(role)) redirect("/");

  return (
    <main className="mx-auto max-w-6xl px-5 py-6 space-y-4">
      <h1 className="text-xl font-extrabold tracking-[0.18em] uppercase text-yellow-200 drop-shadow-[0_0_6px_rgba(0,0,0,0.9)] mb-3">
        Hypixel Stats Sync
      </h1>
      <p className="text-sm text-slate-300">
        This tool walks the MMID directory and fills in cached Hypixel Murder Mystery stats for any players that do not yet have them.
        It runs at a conservative pace and respects the global Hypixel API rate limiter shared by the rest of the site.
      </p>
      <p className="text-xs text-slate-500">
        Safe to run multiple times: entries that already have cached stats are skipped. Only admin and maintainer accounts can run this.
      </p>

      <StatsSyncForm action={statsSyncAction} initialState={initialStatsSyncState} />
    </main>
  );
}

// src/app/admin/sync/page.tsx
import { getServerSession } from "next-auth";
import { authOptions } from "@/auth";
import { redirect } from "next/navigation";
import SyncForm from "./SyncForm";
import { syncAction, initialSyncState } from "./page.actions";

export const dynamic = "force-dynamic";

export default async function AdminSyncPage() {
  const session = await getServerSession(authOptions);
  const role = (session?.user as any)?.role ?? "USER";
  if (!session || !["ADMIN", "MAINTAINER"].includes(role)) redirect("/");

  return (
    <main className="p-6 space-y-6">
      <h1 className="text-xl font-extrabold tracking-[0.18em] uppercase text-yellow-200 drop-shadow-[0_0_6px_rgba(0,0,0,0.9)]">
        Directory Sync (Destructive)
      </h1>
      <p className="text-sm text-red-400 font-semibold">
        This action will <span className="underline">delete all existing MMID directory entries from the web database</span> and then repopulate them
        by reading the latest data from the configured Google Sheet.
      </p>
      <p className="text-sm text-slate-400">
        In other words, it effectively "copies and pastes" the directory from the Google Sheet into the site.
        The sheet is treated as the source of truth. Environment variables <code>SHEET_ID</code>, <code>SHEET_TAB</code> (optional), and
        <code>GOOGLE_SERVICE_ACCOUNT_JSON</code> must be configured correctly.
      </p>

      <SyncForm action={syncAction} initialState={initialSyncState} />
    </main>
  );
}

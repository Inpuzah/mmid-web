"use client";

// src/app/admin/tools/stats-sync/StatsSyncForm.tsx

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import type { StatsSyncFormState } from "./state";

type Props = {
  action: (state: StatsSyncFormState, formData: FormData) => Promise<StatsSyncFormState>;
  initialState: StatsSyncFormState;
};

function SubmitButton() {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      className="px-4 py-2 rounded-[3px] border-2 border-black/80 bg-emerald-500 hover:brightness-110 disabled:opacity-60 disabled:cursor-not-allowed text-black shadow-[0_0_0_1px_rgba(0,0,0,0.9),0_4px_0_0_rgba(0,0,0,0.9)]"
      disabled={pending}
    >
      {pending ? "Syncing Hypixel stats..." : "Sync all Hypixel stats"}
    </button>
  );
}

export default function StatsSyncForm({ action, initialState }: Props) {
  const [state, formAction] = useActionState(action, initialState);

  return (
    <form action={formAction} className="space-y-3">
      <SubmitButton />

      <p className="text-xs text-slate-500">
        This will iterate over all MMID directory entries and, for any player that does not yet have cached Hypixel stats,
        fetch their /player and /guild data from Hypixel, extract Murder Mystery stats, and store them in the local cache.
        The job runs slowly and respects the shared Hypixel API rate limiter.
      </p>

      {state.status === "success" && state.summary && (
        <div className="mt-2 rounded border border-emerald-500/60 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-200">
          <p className="font-semibold">Stats sync complete.</p>
          <p>
            Directory entries: <span className="font-mono">{state.summary.totalEntries}</span>, processed:
            <span className="font-mono"> {state.summary.processed}</span>, updated:
            <span className="font-mono"> {state.summary.updated}</span>, skipped (already cached):
            <span className="font-mono"> {state.summary.skipped}</span>, errors:
            <span className="font-mono"> {state.summary.errors}</span>.
          </p>
          {state.finishedAt && (
            <p className="mt-1 text-[11px] text-emerald-300/80">
              Last run at: {new Date(state.finishedAt).toLocaleString()}
            </p>
          )}
        </div>
      )}

      {state.status === "error" && state.error && (
        <div className="mt-2 rounded border border-red-500/60 bg-red-500/10 px-3 py-2 text-xs text-red-200">
          <p className="font-semibold">Stats sync failed.</p>
          <p className="break-words">{state.error}</p>
        </div>
      )}
    </form>
  );
}

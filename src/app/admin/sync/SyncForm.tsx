"use client";

// src/app/admin/sync/SyncForm.tsx

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import type { SyncFormState } from "./state";

type Props = {
  action: (state: SyncFormState, formData: FormData) => Promise<SyncFormState>;
  initialState: SyncFormState;
};

function SubmitButton() {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      className="px-4 py-2 rounded-[3px] border-2 border-black/80 bg-emerald-500 hover:brightness-110 disabled:opacity-60 disabled:cursor-not-allowed text-black shadow-[0_0_0_1px_rgba(0,0,0,0.9),0_4px_0_0_rgba(0,0,0,0.9)]"
      disabled={pending}
    >
      {pending ? "Syncing..." : "Run Destructive Sync Now"}
    </button>
  );
}

export default function SyncForm({ action, initialState }: Props) {
  const [state, formAction] = useActionState(action, initialState);

  return (
    <form action={formAction} className="space-y-3">
      <SubmitButton />
      <p className="text-xs text-slate-500">
        Ensure your sheet headers exactly match: UUID, Username, Guild, Status, Rank, Type of cheating, Reviewed by, Confidence Score,
        Red Flags, Notes/Evidence, Last Updated, NameMC Link.
      </p>

      {state.status === "success" && state.summary && (
        <div className="mt-2 rounded border border-emerald-500/60 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-200">
          <p className="font-semibold">Sync complete.</p>
          <p>
            Sheet rows: <span className="font-mono">{state.summary.totalRows}</span>, imported:
            <span className="font-mono"> {state.summary.imported}</span>, upserts:
            <span className="font-mono"> {state.summary.upserts}</span>, deleted:
            <span className="font-mono"> {state.summary.deleted ?? 0}</span>.
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
          <p className="font-semibold">Sync failed.</p>
          <p className="break-words">{state.error}</p>
        </div>
      )}
    </form>
  );
}
"use client";

// src/app/admin/tools/minecraft-crawl/MinecraftCrawlForm.tsx

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import type { MinecraftCrawlFormState } from "./state";

type Props = {
  action: (state: MinecraftCrawlFormState, formData: FormData) => Promise<MinecraftCrawlFormState>;
  initialState: MinecraftCrawlFormState;
};

function SubmitButton() {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      className="px-4 py-2 rounded-[3px] border-2 border-black/80 bg-emerald-500 hover:brightness-110 disabled:opacity-60 disabled:cursor-not-allowed text-black shadow-[0_0_0_1px_rgba(0,0,0,0.9),0_4px_0_0_rgba(0,0,0,0.9)]"
      disabled={pending}
    >
      {pending ? "Running Minecraft crawl..." : "Run crawl batch"}
    </button>
  );
}

function NumberField(props: {
  name: string;
  label: string;
  defaultValue: number;
  hint?: string;
}) {
  return (
    <label className="grid gap-1 text-xs text-slate-200">
      <span className="font-semibold uppercase tracking-[0.18em] text-slate-300/90">{props.label}</span>
      <input
        name={props.name}
        type="number"
        defaultValue={props.defaultValue}
        className="w-full max-w-[220px] rounded-[3px] border border-slate-700 bg-slate-950/60 px-3 py-2 text-slate-100"
      />
      {props.hint && <span className="text-[11px] text-slate-500">{props.hint}</span>}
    </label>
  );
}

export default function MinecraftCrawlForm({ action, initialState }: Props) {
  const [state, formAction] = useActionState(action, initialState);

  return (
    <form action={formAction} className="space-y-4">
      <div className="flex flex-wrap gap-4 items-end">
        <NumberField name="limit" label="Limit" defaultValue={40} hint="Max players processed per batch (1-250)." />
        <NumberField
          name="minAgeMinutes"
          label="Min age (minutes)"
          defaultValue={60 * 24}
          hint="Only recrawl players whose last snapshot is older than this." 
        />
        <NumberField name="sleepMs" label="Sleep (ms)" defaultValue={250} hint="Delay between players." />
      </div>

      <SubmitButton />

      {state.status === "success" && state.summary && (
        <div className="mt-2 rounded border border-emerald-500/60 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-200">
          <p className="font-semibold">Minecraft crawl complete.</p>
          <p>
            Candidates: <span className="font-mono">{state.summary.candidates}</span>, processed:
            <span className="font-mono"> {state.summary.processed}</span>, snapshotted:
            <span className="font-mono"> {state.summary.snapshotted}</span>, username changes:
            <span className="font-mono"> {state.summary.usernameChanged}</span>, errors:
            <span className="font-mono"> {state.summary.errors}</span>.
          </p>
          {state.runId && (
            <p className="mt-1 text-[11px] text-emerald-300/80">
              Run ID: <span className="font-mono">{state.runId}</span>
            </p>
          )}
          {state.finishedAt && (
            <p className="mt-1 text-[11px] text-emerald-300/80">Last run at: {new Date(state.finishedAt).toLocaleString()}</p>
          )}
        </div>
      )}

      {state.status === "error" && state.error && (
        <div className="mt-2 rounded border border-red-500/60 bg-red-500/10 px-3 py-2 text-xs text-red-200">
          <p className="font-semibold">Minecraft crawl failed.</p>
          <p className="break-words">{state.error}</p>
          {state.runId && (
            <p className="mt-1 text-[11px] text-red-200/80">
              Run ID: <span className="font-mono">{state.runId}</span>
            </p>
          )}
        </div>
      )}
    </form>
  );
}

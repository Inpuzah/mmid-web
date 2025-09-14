"use client";

import * as React from "react";
import { useFormState, useFormStatus } from "react-dom";
import type { PrefillState } from "./actions";
import { lookupMinecraft, upsertEntry } from "./actions";

const STATUS_OPTIONS = ["Needs reviewed", "BANNED", "WARNED", "CLEARED"];
const RANK_OPTIONS = ["MVP++", "MVP+", "MVP", "VIP+", "VIP", "YOUTUBER", "ADMIN", "HELPER", "Default"];
const CHEATING_OPTIONS = [
  "Kill Aura", "Reach", "Auto Clicker", "Macro", "Scaffold", "Fly", "Speed",
  "Teaming", "ESP / X-Ray", "General Hack Client", "Other"
];
const REDFLAG_OPTIONS = [
  "Consistent Teaming", "History", "Reports", "Alt Account", "Other"
];

function Submit({ children }: { children: React.ReactNode }) {
  const { pending } = useFormStatus();
  return (
    <button
      disabled={pending}
      className="px-4 py-2 rounded-md bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white"
      type="submit"
    >
      {pending ? "Working…" : children}
    </button>
  );
}

export default function NewEntryForm({
  initialUuid = "",
  initialUsername = "",
}: { initialUuid?: string; initialUsername?: string }) {
  const initialState: PrefillState = { ok: false, error: null, prefill: initialUuid || initialUsername ? {
    uuid: initialUuid, username: initialUsername, guild: null, rank: null,
    skinUrl: initialUsername ? `https://mc-heads.net/body/${encodeURIComponent(initialUsername)}/200` : "",
    headUrl: initialUsername ? `https://mc-heads.net/avatar/${encodeURIComponent(initialUsername)}/80` : "",
  } : null };

  const [state, formActionLookup] = useFormState(lookupMinecraft, initialState);

  // Keys so defaultValue resets when prefill changes
  const k = state.prefill ? `${state.prefill.uuid}:${state.prefill.username}` : "empty";

  return (
    <form className="grid grid-cols-1 gap-4 max-w-3xl">
      {/* Step 1: Lookup */}
      <div className="rounded-xl border border-white/10 p-4 bg-slate-900/40 space-y-3">
        <label className="grid gap-1">
          <span className="text-sm text-slate-300">UUID or Username</span>
          <input
            name="query"
            placeholder="Paste UUID or type username"
            className="px-3 py-2 rounded-md bg-slate-800 text-slate-100 border border-white/10"
            defaultValue={state.prefill?.uuid || state.prefill?.username || ""}
          />
        </label>
        <div className="flex items-center gap-2">
          <button formAction={formActionLookup}
                  className="px-4 py-2 rounded-md bg-indigo-600 hover:bg-indigo-500 text-white"
                  type="submit">
            Lookup
          </button>
          {state.error && <span className="text-sm text-red-400">{state.error}</span>}
          {state.prefill?.headUrl && (
            <img src={state.prefill.headUrl} alt="Head" className="w-8 h-8 rounded-md border border-white/10 ml-auto" />
          )}
        </div>
      </div>

      {/* Step 2: Server-filled fields + preview */}
      <div className="grid grid-cols-1 gap-4 rounded-xl border border-white/10 p-4 bg-slate-900/40">
        <div className="grid sm:grid-cols-[200px,1fr] gap-4">
          <div className="flex items-start justify-center">
            {state.prefill?.skinUrl ? (
              <img key={k} src={state.prefill.skinUrl} alt="Skin preview" className="rounded-lg border border-white/10" />
            ) : (
              <div className="w-[160px] h-[200px] rounded-lg bg-slate-800 border border-white/10" />
            )}
          </div>

          <div className="grid gap-3">
            <label className="grid gap-1">
              <span className="text-sm text-slate-300">UUID *</span>
              <input
                key={`${k}-uuid`}
                name="uuid"
                required
                className="px-3 py-2 rounded-md bg-slate-800 text-slate-100 border border-white/10"
                defaultValue={state.prefill?.uuid ?? ""}
              />
            </label>

            <label className="grid gap-1">
              <span className="text-sm text-slate-300">Username *</span>
              <input
                key={`${k}-username`}
                name="username"
                required
                className="px-3 py-2 rounded-md bg-slate-800 text-slate-100 border border-white/10"
                defaultValue={state.prefill?.username ?? ""}
              />
            </label>

            <div className="grid sm:grid-cols-3 gap-3">
              <label className="grid gap-1">
                <span className="text-sm text-slate-300">Guild</span>
                <input
                  key={`${k}-guild`}
                  name="guild"
                  className="px-3 py-2 rounded-md bg-slate-800 text-slate-100 border border-white/10"
                  defaultValue={state.prefill?.guild ?? ""}
                />
              </label>

              <label className="grid gap-1">
                <span className="text-sm text-slate-300">Status</span>
                <select
                  name="status"
                  defaultValue=""
                  className="px-3 py-2 rounded-md bg-slate-800 text-slate-100 border border-white/10"
                >
                  <option value="">—</option>
                  {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </label>

              <label className="grid gap-1">
                <span className="text-sm text-slate-300">Rank</span>
                <select
                  name="rank"
                  defaultValue={state.prefill?.rank ?? ""}
                  className="px-3 py-2 rounded-md bg-slate-800 text-slate-100 border border-white/10"
                >
                  <option value="">—</option>
                  {RANK_OPTIONS.map(r => <option key={r} value={r}>{r}</option>)}
                </select>
              </label>
            </div>

            <label className="grid gap-1">
              <span className="text-sm text-slate-300">Notes / Evidence</span>
              <textarea name="notesEvidence" rows={5}
                        className="px-3 py-2 rounded-md bg-slate-800 text-slate-100 border border-white/10" />
            </label>
          </div>
        </div>

        <div className="grid sm:grid-cols-2 gap-4">
          <label className="grid gap-1">
            <span className="text-sm text-slate-300">Type of cheating (multi-select)</span>
            <select name="typeOfCheating" multiple
                    className="h-28 px-3 py-2 rounded-md bg-slate-800 text-slate-100 border border-white/10">
              {CHEATING_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
            </select>
            <span className="text-xs text-slate-400">Hold Ctrl/Cmd to choose multiple. Or paste CSV below.</span>
            <input name="typeOfCheatingCSV" placeholder="Or paste CSV: Aimbot, Reach"
                   className="mt-1 px-3 py-2 rounded-md bg-slate-800 text-slate-100 border border-white/10" />
          </label>

          <label className="grid gap-1">
            <span className="text-sm text-slate-300">Red Flags (multi-select)</span>
            <select name="redFlags" multiple
                    className="h-28 px-3 py-2 rounded-md bg-slate-800 text-slate-100 border border-white/10">
              {REDFLAG_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
            </select>
            <span className="text-xs text-slate-400">Hold Ctrl/Cmd to choose multiple. Or paste CSV below.</span>
            <input name="redFlagsCSV" placeholder="Or paste CSV: Consistent Teaming"
                   className="mt-1 px-3 py-2 rounded-md bg-slate-800 text-slate-100 border border-white/10" />
          </label>
        </div>

        <div className="grid sm:grid-cols-3 gap-3">
          <label className="grid gap-1">
            <span className="text-sm text-slate-300">Confidence Score (0–5)</span>
            <input name="confidenceScore" type="number" min={0} max={5}
                   className="px-3 py-2 rounded-md bg-slate-800 text-slate-100 border border-white/10" />
          </label>

          <label className="grid gap-1">
            <span className="text-sm text-slate-300">Reviewed by</span>
            <input name="reviewedBy"
                   className="px-3 py-2 rounded-md bg-slate-800 text-slate-100 border border-white/10" />
          </label>

          <label className="grid gap-1">
            <span className="text-sm text-slate-300">Last Updated (YYYY-MM-DD)</span>
            <input name="lastUpdated" placeholder="2025-09-13"
                   className="px-3 py-2 rounded-md bg-slate-800 text-slate-100 border border-white/10" />
          </label>
        </div>

        <label className="grid gap-1">
          <span className="text-sm text-slate-300">NameMC Link</span>
          <input name="nameMcLink" placeholder="https://namemc.com/profile/..."
                 className="px-3 py-2 rounded-md bg-slate-800 text-slate-100 border border-white/10" />
        </label>

        <div className="flex gap-2">
          <Submit>Save Entry</Submit>
          {/* This prop binds the lookup server action to this button */}
          <button formAction={formActionLookup}
                  className="px-4 py-2 rounded-md bg-slate-700 hover:bg-slate-600 text-white"
                  type="submit">
            Lookup Again
          </button>
          <a href="/directory" className="px-4 py-2 rounded-md bg-slate-700 hover:bg-slate-600 text-white">Cancel</a>
        </div>
      </div>
    </form>
  );
}

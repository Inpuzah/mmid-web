"use client";

import * as React from "react";
import MinecraftSkin from "@/components/MinecraftSkin";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { MoreHorizontal, Pencil, Save, X, Copy } from "lucide-react";

import { upsertEntry } from "@/app/entries/new/actions";
import { checkUsernameChange, checkHypixelData } from "../actions";

import type { MmidRow } from "./MMIDDirectoryMasterDetail";

const STATUS_OPTIONS = [
  "Legit / Cleared",
  "Cheating / Flagged",
  "Needs review",
  "Unverified",
  "BANNED",
  "WARNED",
  "CLEARED",
  "Needs reviewed",
];

const CHEATING_OPTIONS = [
  "Kill Aura",
  "Reach",
  "Auto Clicker",
  "Macro",
  "Scaffold",
  "Fly",
  "Speed",
  "Teaming",
  "ESP / X-Ray",
  "General Hack Client",
  "Other",
];

const REDFLAG_OPTIONS = [
  "Consistent Teaming",
  "History",
  "Reports",
  "Alt Account",
  "Other",
  "Generally nice person",
  "Inconclusive",
  "Harasses Others",
];

function statusTone(s?: string | null) {
  const val = (s ?? "").toLowerCase();
  if (val.includes("confirmed")) return "bg-rose-600/90 text-white";
  if (val.includes("cheat") || val.includes("flagged")) return "bg-rose-600/90 text-white";
  if (val.includes("legit") || val.includes("cleared")) return "bg-emerald-600/90 text-white";
  if (val.includes("needs") || val.includes("review")) return "bg-amber-500/90 text-black";
  if (val.includes("unverified")) return "bg-slate-600/80 text-white";
  return "bg-slate-700/70 text-white";
}

function Stars({ value, onChange, disabled }: { value: number; onChange: (v: number) => void; disabled?: boolean }) {
  const v = Math.max(0, Math.min(5, Number(value ?? 0)));
  return (
    <div className="inline-flex items-center gap-0.5">
      {Array.from({ length: 5 }).map((_, i) => {
        const filled = i < v;
        return (
          <button
            key={i}
            type="button"
            onClick={() => !disabled && onChange(i + 1)}
            className={
              "h-5 w-5 rounded-sm border border-transparent text-yellow-400 transition " +
              (disabled ? "cursor-default opacity-80" : "hover:border-yellow-400/40")
            }
            aria-label={`Set confidence ${i + 1}/5`}
          >
            <svg viewBox="0 0 24 24" className={filled ? "fill-yellow-400" : "fill-transparent"}>
              <path
                stroke="currentColor"
                strokeWidth="2"
                d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"
              />
            </svg>
          </button>
        );
      })}
    </div>
  );
}

function formatLastUpdated(v?: string | null) {
  if (!v) return "";
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return v;
  return d.toLocaleString();
}

function splitNotes(notesEvidence?: string | null) {
  const raw = notesEvidence ?? "";
  const marker = "\n---ATTACHMENTS---\n";
  const idx = raw.indexOf(marker);
  if (idx === -1) return { notes: raw.trim(), attachments: "" };
  return {
    notes: raw.slice(0, idx).trim(),
    attachments: raw.slice(idx + marker.length).trim(),
  };
}

export default function MMIDLegacySpreadsheet({ rows, canEdit }: { rows: MmidRow[]; canEdit: boolean }) {
  const [editing, setEditing] = React.useState<Set<string>>(() => new Set());
  const [expandedNotes, setExpandedNotes] = React.useState<Set<string>>(() => new Set());

  const toggleEdit = (uuid: string, on: boolean) => {
    setEditing((prev) => {
      const next = new Set(prev);
      if (on) next.add(uuid);
      else next.delete(uuid);
      return next;
    });
  };

  const toggleNotes = (uuid: string) => {
    setExpandedNotes((prev) => {
      const next = new Set(prev);
      if (next.has(uuid)) next.delete(uuid);
      else next.add(uuid);
      return next;
    });
  };

  return (
    <div className="rounded-lg border-2 border-border/70 bg-slate-950/70 shadow-lg">
      <div className="overflow-x-auto">
        <table className="min-w-[1400px] w-full text-left text-[12px]">
          <thead className="sticky top-0 z-10 bg-slate-950">
            <tr className="border-b border-white/10 text-[11px] uppercase tracking-wide text-slate-300">
              <th className="px-2 py-2"> </th>
              <th className="px-2 py-2">Username</th>
              <th className="px-2 py-2">Guild</th>
              <th className="px-2 py-2">Status</th>
              <th className="px-2 py-2">UUID</th>
              <th className="px-2 py-2">Rank</th>
              <th className="px-2 py-2">Type of cheating</th>
              <th className="px-2 py-2">Reviewed by</th>
              <th className="px-2 py-2">Confidence</th>
              <th className="px-2 py-2">Red flags</th>
              <th className="px-2 py-2">Notes / Evidence</th>
              <th className="px-2 py-2">Last updated</th>
              <th className="px-2 py-2 text-right"> </th>
            </tr>
          </thead>

          <tbody>
            {rows.map((r) => {
              const isEditing = editing.has(r.uuid);
              const formId = `legacy-edit-${r.uuid}`;
              const notes = splitNotes(r.notesEvidence);
              const showAll = expandedNotes.has(r.uuid);
              const noteText = notes.notes || "";
              const truncated = noteText.length > 140 && !showAll;
              const displayText = truncated ? noteText.slice(0, 140) + "…" : noteText;

              return (
                <tr key={r.uuid} className="border-b border-white/5 align-top">
                  <td className="px-2 py-2">
                    <MinecraftSkin id={r.uuid} name={r.username} size={64} className="h-10 w-10" />
                  </td>

                  <td className="px-2 py-2 min-w-[220px]">
                    {isEditing ? (
                      <div className="space-y-1">
                        <input
                          name="username"
                          form={formId}
                          defaultValue={r.username}
                          className="w-full rounded-md border border-white/10 bg-white/5 px-2 py-1 text-slate-100"
                        />
                        <div className="flex gap-1">
                          <form action={checkUsernameChange}>
                            <input type="hidden" name="entryUuid" value={r.uuid} />
                            <input type="hidden" name="returnTo" value={`/directory?view=legacy&entryUuid=${encodeURIComponent(r.uuid)}`} />
                            <button
                              type="submit"
                              className="rounded-full border border-slate-600 bg-slate-900/70 px-2 py-0.5 text-[10px] text-slate-200 hover:border-amber-400/60"
                            >
                              Check username
                            </button>
                          </form>
                        </div>
                      </div>
                    ) : (
                      <div className="font-semibold text-slate-100">{r.username}</div>
                    )}
                  </td>

                  <td className="px-2 py-2 min-w-[180px]">
                    {isEditing ? (
                      <input
                        name="guild"
                        form={formId}
                        defaultValue={r.guild ?? ""}
                        className="w-full rounded-md border border-white/10 bg-white/5 px-2 py-1 text-slate-100"
                      />
                    ) : (
                      <div className="text-slate-200">{r.guild ?? ""}</div>
                    )}
                  </td>

                  <td className="px-2 py-2 min-w-[170px]">
                    {isEditing ? (
                      <select
                        name="status"
                        form={formId}
                        defaultValue={r.status ?? ""}
                        className="w-full rounded-md border border-white/10 bg-slate-950 px-2 py-1 text-slate-100"
                      >
                        <option value="">—</option>
                        {STATUS_OPTIONS.map((s) => (
                          <option key={s} value={s}>
                            {s}
                          </option>
                        ))}
                      </select>
                    ) : r.status ? (
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ${statusTone(r.status)}`}>
                        {r.status}
                      </span>
                    ) : (
                      <span className="text-slate-500">—</span>
                    )}
                  </td>

                  <td className="px-2 py-2 min-w-[230px]">
                    <div className="flex items-center gap-1">
                      <code className="truncate text-[11px] text-slate-200">{r.uuid}</code>
                      <button
                        type="button"
                        onClick={() => navigator.clipboard.writeText(r.uuid)}
                        className="ml-auto inline-flex items-center gap-1 rounded-full border border-slate-600 bg-slate-900/70 px-2 py-0.5 text-[10px] text-slate-200 hover:border-amber-400/60"
                        aria-label="Copy UUID"
                      >
                        <Copy className="h-3 w-3" />
                        Copy
                      </button>
                    </div>
                  </td>

                  <td className="px-2 py-2 min-w-[140px]">
                    {isEditing ? (
                      <div className="space-y-1">
                        <input
                          name="rank"
                          form={formId}
                          defaultValue={r.rank ?? ""}
                          className="w-full rounded-md border border-white/10 bg-white/5 px-2 py-1 text-slate-100"
                        />
                        <form action={checkHypixelData}>
                          <input type="hidden" name="entryUuid" value={r.uuid} />
                          <input type="hidden" name="returnTo" value={`/directory?view=legacy&entryUuid=${encodeURIComponent(r.uuid)}`} />
                          <button
                            type="submit"
                            className="rounded-full border border-slate-600 bg-slate-900/70 px-2 py-0.5 text-[10px] text-slate-200 hover:border-amber-400/60"
                          >
                            Check rank
                          </button>
                        </form>
                      </div>
                    ) : (
                      <div className="text-slate-200">{r.rank ?? ""}</div>
                    )}
                  </td>

                  <td className="px-2 py-2 min-w-[200px]">
                    {isEditing ? (
                      <select
                        name="typeOfCheating"
                        form={formId}
                        multiple
                        defaultValue={r.typeOfCheating ?? []}
                        className="w-full rounded-md border border-white/10 bg-slate-950 px-2 py-1 text-slate-100"
                      >
                        {CHEATING_OPTIONS.map((o) => (
                          <option key={o} value={o}>
                            {o}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <div className="whitespace-normal text-slate-200">{(r.typeOfCheating ?? []).join(", ")}</div>
                    )}
                  </td>

                  <td className="px-2 py-2 min-w-[130px]">
                    {isEditing ? (
                      <input
                        name="reviewedBy"
                        form={formId}
                        defaultValue={r.reviewedBy ?? ""}
                        className="w-full rounded-md border border-white/10 bg-white/5 px-2 py-1 text-slate-100"
                      />
                    ) : (
                      <div className="text-slate-200">{r.reviewedBy ?? ""}</div>
                    )}
                  </td>

                  <td className="px-2 py-2 min-w-[150px]">
                    {isEditing ? (
                      <LegacyConfidenceEditor formId={formId} initial={r.confidenceScore ?? 0} />
                    ) : (
                      <div className="text-slate-200">{r.confidenceScore ?? 0}/5</div>
                    )}
                  </td>

                  <td className="px-2 py-2 min-w-[200px]">
                    {isEditing ? (
                      <select
                        name="redFlags"
                        form={formId}
                        multiple
                        defaultValue={r.redFlags ?? []}
                        className="w-full rounded-md border border-white/10 bg-slate-950 px-2 py-1 text-slate-100"
                      >
                        {REDFLAG_OPTIONS.map((o) => (
                          <option key={o} value={o}>
                            {o}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <div className="whitespace-normal text-slate-200">{(r.redFlags ?? []).join(", ")}</div>
                    )}
                  </td>

                  <td className="px-2 py-2 min-w-[360px]">
                    {isEditing ? (
                      <textarea
                        name="notesEvidence"
                        form={formId}
                        defaultValue={notes.notes}
                        rows={3}
                        className="w-full resize-y rounded-md border border-white/10 bg-white/5 px-2 py-1 text-slate-100"
                      />
                    ) : (
                      <div className="whitespace-normal text-slate-200">
                        {displayText || <span className="text-slate-500">—</span>}
                        {noteText.length > 140 && (
                          <button
                            type="button"
                            onClick={() => toggleNotes(r.uuid)}
                            className="ml-2 text-[10px] font-semibold text-amber-200 hover:underline"
                          >
                            {showAll ? "Read less" : "Read more"}
                          </button>
                        )}
                      </div>
                    )}
                  </td>

                  <td className="px-2 py-2 min-w-[160px] text-[11px] text-slate-300">
                    {formatLastUpdated(r.lastUpdated) || ""}
                    {isEditing && (
                      <input type="hidden" name="lastUpdated" form={formId} value={r.lastUpdated ?? ""} />
                    )}
                  </td>

                  <td className="px-2 py-2 min-w-[170px] text-right">
                    <div className="flex items-start justify-end gap-2">
                      {canEdit && (
                        <>
                          {isEditing ? (
                            <form
                              id={formId}
                              action={upsertEntry}
                              className="inline-flex items-center gap-1"
                              onSubmit={() => toggleEdit(r.uuid, false)}
                            >
                              <input type="hidden" name="targetUuid" value={r.uuid} />
                              <input type="hidden" name="uuid" value={r.uuid} />
                              <input type="hidden" name="returnTo" value={`/directory?view=legacy&entryUuid=${encodeURIComponent(r.uuid)}`} />

                              <Button type="submit" size="sm" className="h-7 rounded-full bg-emerald-500 px-3 text-[11px] font-semibold text-black hover:bg-emerald-400">
                                <Save className="h-3.5 w-3.5" />
                                Save
                              </Button>

                              <button
                                type="button"
                                onClick={() => toggleEdit(r.uuid, false)}
                                className="inline-flex h-7 items-center gap-1 rounded-full border border-slate-600 bg-slate-950/70 px-3 text-[11px] text-slate-200 hover:border-amber-400/60"
                              >
                                <X className="h-3.5 w-3.5" />
                                Cancel
                              </button>
                            </form>
                          ) : (
                            <button
                              type="button"
                              onClick={() => toggleEdit(r.uuid, true)}
                              className="inline-flex h-7 items-center gap-1 rounded-full border border-slate-600 bg-slate-950/70 px-3 text-[11px] text-slate-200 hover:border-amber-400/60"
                            >
                              <Pencil className="h-3.5 w-3.5" />
                              Edit
                            </button>
                          )}
                        </>
                      )}

                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button
                            type="button"
                            className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-slate-600 bg-slate-950/70 text-slate-200 hover:border-amber-400/60"
                            aria-label="Row actions"
                          >
                            <MoreHorizontal className="h-4 w-4" />
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-52">
                          <DropdownMenuItem asChild>
                            <a href={`/directory?view=cards&entryUuid=${encodeURIComponent(r.uuid)}`}>Open in cards view</a>
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="px-3 py-2 text-[11px] text-slate-400">
        Legacy view: click <span className="font-semibold text-slate-200">Edit</span> on a row to modify fields.
      </div>
    </div>
  );
}

function LegacyConfidenceEditor({ formId, initial }: { formId: string; initial: number }) {
  const [score, setScore] = React.useState<number>(Math.max(0, Math.min(5, Number(initial ?? 0))));
  return (
    <div className="flex items-center gap-2">
      <input type="hidden" name="confidenceScore" form={formId} value={score} />
      <Stars value={score} onChange={setScore} />
      <span className="text-[11px] text-slate-300">{score}/5</span>
    </div>
  );
}

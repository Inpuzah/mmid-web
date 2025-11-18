"use client";

import React, { useMemo, useState, useRef, useCallback } from "react";
import { GroupedVirtuoso, type VirtuosoHandle } from "react-virtuoso";

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { ArrowDown, ArrowUp, Pencil, RefreshCw, ShieldQuestion, Trash2, Star, X } from "lucide-react"; // if you don't use X/Copy elsewhere, drop them
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import * as DialogPrimitive from "@radix-ui/react-dialog";

import { Card, CardContent } from "@/components/ui/card";
import MinecraftSkin from "@/components/MinecraftSkin";
import { voteOnEntry, checkUsernameChange, checkHypixelData, markEntryNeedsReview, deleteEntryPermanently } from "../actions";
import { upsertEntry } from "../../entries/new/actions";

/* ---------------------------------------------
   Config
---------------------------------------------- */

/* ---------------------------------------------
   Types (matches your schema fields)
---------------------------------------------- */
export type MmidRow = {
  uuid: string;
  username: string;
  guild?: string | null;
  guildColor?: string | null;
  rank?: string | null;
  status?: string | null;
  typeOfCheating?: string[];
  redFlags?: string[];
  notesEvidence?: string | null;
  reviewedBy?: string | null;
  confidenceScore?: number | null; // 0..5
  voteScore?: number; // net upvotes - downvotes
  userVote?: number; // 1 = upvoted, -1 = downvoted, 0/undefined = no vote
  lastUpdated?: string | null; // ISO string when last edited by maintainer
};

/* ---------------------------------------------
   A–Z helpers (grouping + jump index)
---------------------------------------------- */
const LETTERS = Array.from({ length: 26 }, (_, i) =>
  String.fromCharCode(65 + i)
);
const GROUPS_ORDER = [...LETTERS, "#"];

function initialOf(nameRaw: string) {
  const ch = (nameRaw ?? "").trim().charAt(0).toUpperCase();
  return ch >= "A" && ch <= "Z" ? ch : "#";
}
function alphaSort(a: MmidRow, b: MmidRow) {
  return a.username.localeCompare(b.username, "en", { sensitivity: "base" });
}
function buildAlphaIndex(data: MmidRow[]) {
  const sorted = [...data].sort(alphaSort);

  const buckets = new Map<string, MmidRow[]>();
  for (const k of GROUPS_ORDER) buckets.set(k, []);
  for (const e of sorted) buckets.get(initialOf(e.username))!.push(e);

  const flat: MmidRow[] = [];
  const groupCounts: number[] = [];
  const groupLabels: string[] = [];
  const letterToIndex = new Map<string, number>();
  const lettersPresent = new Set<string>();

  let cursor = 0;
  for (const letter of GROUPS_ORDER) {
    const arr = buckets.get(letter)!;
    if (arr.length === 0) continue;
    groupLabels.push(letter);
    groupCounts.push(arr.length);
    letterToIndex.set(letter, cursor);
    lettersPresent.add(letter);
    flat.push(...arr);
    cursor += arr.length;
  }
  return { flat, groupCounts, groupLabels, letterToIndex, lettersPresent };
}

/* ---------------------------------------------
   Status filter helpers (for more intuitive UI)
---------------------------------------------- */
export type StatusFilter = "all" | "legit" | "cheating" | "needs-review" | "unverified";

const STATUS_FILTERS: { value: StatusFilter; label: string }[] = [
  { value: "all", "label": "All" },
  { value: "legit", "label": "Legit / Cleared" },
  { value: "cheating", "label": "Cheating / Flagged" },
  { value: "needs-review", "label": "Needs review" },
  { value: "unverified", "label": "Unverified" },
];

function matchesStatusFilter(status: string | null | undefined, filter: StatusFilter): boolean {
  if (filter === "all") return true;
  const val = (status ?? "").toLowerCase();
  if (!val) return false;

  switch (filter) {
    case "legit":
      return val.includes("legit") || val.includes("cleared");
    case "cheating":
      return (
        val.includes("confirmed") ||
        val.includes("cheat") ||
        val.includes("cheater") ||
        val.includes("flagged")
      );
    case "needs-review":
      return val.includes("needs") || val.includes("review");
    case "unverified":
      return val.includes("unverified");
    default:
      return true;
  }
}

function statusFilterLabel(filter: StatusFilter): string {
  const found = STATUS_FILTERS.find((f) => f.value === filter);
  return found?.label ?? "All";
}

/* ---------------------------------------------
   Visual helpers
---------------------------------------------- */
function Stars({ n = 0 }: { n?: number | null }) {
  const v = Math.max(0, Math.min(5, Number(n ?? 0)));
  return (
    <span className="inline-flex items-center gap-0.5" aria-label={`${v}/5`}>
      {Array.from({ length: 5 }).map((_, i) => (
        <Star
          key={i}
          className={`h-4 w-4 ${i < v ? "fill-yellow-400" : "fill-transparent"} stroke-yellow-400`}
        />
      ))}
    </span>
  );
}
function statusTone(s?: string | null) {
  const val = (s ?? "").toLowerCase();
  if (val.includes("confirmed")) return "bg-rose-600/90 text-white";
  if (val.includes("legit") || val.includes("cleared")) return "bg-emerald-600/90 text-white";
  if (val.includes("needs") || val.includes("review")) return "bg-amber-500/90 text-black";
  return "bg-slate-700/70 text-white";
}
function rankClass(rank?: string | null) {
  const r = (rank ?? "").toUpperCase();
  if (r.includes("MVP++")) return "bg-amber-500/95 text-black";
  if (r.includes("MVP+")) return "bg-cyan-500/95 text-black";
  if (r.includes("MVP")) return "bg-sky-500/95 text-black";
  if (r.includes("VIP+")) return "bg-lime-500/95 text-black";
  if (r.includes("VIP")) return "bg-green-500/95 text-black";
  if (!rank) return "bg-slate-700/70 text-white";
  return "bg-slate-600/90 text-white";
}
function stringToHsl(name: string, s = 65, l = 55) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  const h = Math.abs(hash) % 360;
  return `hsl(${h} ${s}% ${l}%)`;
}

/* ---------------------------------------------
   Modal Card (lower body, left-aligned text to render, stronger section headers)
---------------------------------------------- */
export function EntryCard({
  entry,
  open,
  onOpenChange,
}: {
  entry: MmidRow | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  if (!entry) return null;

  const allFlags = (entry.typeOfCheating ?? []).concat(entry.redFlags ?? []);
  const hasStatus = Boolean(entry.status);
  const hasFlags = allFlags.length > 0;
  const hasNotes = Boolean(entry.notesEvidence?.trim().length);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        aria-describedby={undefined}
        className="
          fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2
          z-[100] w-[min(96vw,48rem)] max-h-[85vh]
          p-0 overflow-hidden rounded-2xl
          border-2 border-border bg-card/95 backdrop-blur-xl shadow-2xl
        "
      >
        {/* Accessible title for Radix dialog (visually hidden) */}
        <DialogTitle className="sr-only">MMID entry for {entry.username}</DialogTitle>

        {/* Close (Radix) */}
        <DialogPrimitive.Close asChild>
          <button
            type="button"
            aria-label="Close"
            className="absolute right-3 top-3 z-50 inline-flex h-8 w-8 items-center justify-center rounded-full bg-black/70 text-slate-100 hover:bg-black/80 border border-border/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
          >
            <X className="h-4 w-4" />
          </button>
        </DialogPrimitive.Close>

        {/* BODY */}
        <div className="px-5 pt-4 pb-4 overflow-y-auto max-h-[85vh]">
          <div className="grid grid-cols-[7.5rem,1fr] gap-x-5 gap-y-2 items-start">
            {/* render */}
            <div className="row-start-1 col-start-1 pr-1">
              <div className="rounded-2xl bg-card/80 ring-2 ring-border/40 p-1 w-[8.5rem]">
                <MinecraftSkin
                  id={entry.uuid}
                  name={entry.username}
                  className="block h-44 w-auto mx-auto"
                />
              </div>
            </div>

            {/* NAME + UUID + RANK + GUILD */}
            <div className="row-start-1 col-start-2 min-w-0 -ml-8"> {/* was -ml-6 */}
              <h2 className="text-4xl font-semibold text-slate-100 tracking-tight break-all mt-0">
                {entry.username}
              </h2>

              <div className="mt-1.5 flex items-center gap-2">
                <code className="text-[12px] text-slate-300/90 break-all">
                  {entry.uuid || "—"}
                </code>
                <button
                  type="button"
                  onClick={() => navigator.clipboard.writeText(entry.uuid || "")}
                  className="px-2 py-1 rounded-md text-[12px] bg-white/10 border border-white/15 hover:bg-white/15 text-slate-100"
                >
                  Copy UUID
                </button>
              </div>

              <div className="mt-3 flex items-center gap-2 text-sm">
                <span className="text-slate-400">Server rank:</span>
                {entry.rank ? (
                  <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${rankClass(entry.rank)}`}>
                    {entry.rank}
                  </span>
                ) : (
                  <span className="text-slate-300">—</span>
                )}
              </div>

              <div className="mt-2 flex items-center gap-2 text-sm">
                <span className="text-slate-400">Guild (in-game clan/team):</span>
                {entry.guild ? (
                  <span
                    className="px-2 py-0.5 rounded-full text-xs font-semibold"
                    style={{ background: entry.guildColor || stringToHsl(entry.guild), color: "#111" }}
                  >
                    {entry.guild}
                  </span>
                ) : (
                  <span className="text-slate-300">—</span>
                )}
              </div>
            </div>

            {/* review + voting */}
            <div className="row-start-2 col-start-2 mt-1 space-y-1.5 text-[13px] text-slate-300">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <span className="text-slate-400">Reviewed by</span>
                <span className="text-slate-100 font-medium">{entry.reviewedBy ?? "N/A"}</span>
              </div>
              {entry.lastUpdated && (
                <div className="flex flex-wrap items-center gap-1 text-[12px] text-slate-400">
                  <span>Last updated</span>
                  <span className="text-slate-100">
                    {entry.reviewedBy && <>
                      by <span className="font-medium">{entry.reviewedBy}</span>{" · "}
                    </>}
                    {new Date(entry.lastUpdated).toLocaleString()}
                  </span>
                </div>
              )}
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-slate-400">Confidence</span>
                <span className="inline-flex items-center gap-1 align-middle">
                  <Stars n={entry.confidenceScore ?? 0} />
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-2 text-[12px]">
                <span className="text-slate-400">Votes</span>
                <div className="inline-flex items-center gap-1">
                  <form action={voteOnEntry} className="inline-flex">
                    <input type="hidden" name="entryUuid" value={entry.uuid} />
                    <input type="hidden" name="direction" value="up" />
                    <button
                      type="submit"
                      className={`inline-flex items-center justify-center rounded-full px-2 py-1 border text-[11px] transition ${
                        entry.userVote === 1
                          ? "bg-emerald-500/20 border-emerald-400/60 text-emerald-200"
                          : "bg-slate-900/60 border-white/20 text-slate-200 hover:bg-slate-800/80"
                      }`}
                      aria-label="Upvote entry"
                    >
                      <ArrowUp className="h-3 w-3" />
                    </button>
                  </form>
                  <span className="min-w-[2ch] text-center text-slate-100 font-medium">
                    {entry.voteScore ?? 0}
                  </span>
                  <form action={voteOnEntry} className="inline-flex">
                    <input type="hidden" name="entryUuid" value={entry.uuid} />
                    <input type="hidden" name="direction" value="down" />
                    <button
                      type="submit"
                      className={`inline-flex items-center justify-center rounded-full px-2 py-1 border text-[11px] transition ${
                        entry.userVote === -1
                          ? "bg-rose-500/20 border-rose-400/60 text-rose-200"
                          : "bg-slate-900/60 border-white/20 text-slate-200 hover:bg-slate-800/80"
                      }`}
                      aria-label="Downvote entry"
                    >
                      <ArrowDown className="h-3 w-3" />
                    </button>
                  </form>
                </div>
              </div>
            </div>
          </div>

          {/* SECTIONS */}
          <div className="mt-6 grid gap-5 md:grid-cols-2">
            {hasStatus && (
              <Card className="rounded-2xl">
                <CardContent className="flex !items-start !justify-start px-5 pt-2 pb-4">
                  <div className="w-full">
                    <div className="text-[13px] font-bold uppercase tracking-wide text-slate-200">
                      Status
                    </div>
                    <div className="mt-2">
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ${statusTone(entry.status!)}`}>
                        {entry.status}
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {hasFlags && (
              <Card className="rounded-2xl">
                <CardContent className="flex !items-start !justify-start px-5 pt-2 pb-4">
                  <div className="w-full">
                    <div className="text-[13px] font-bold uppercase tracking-wide text-slate-200">
                      Flags / Cheating
                    </div>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {allFlags.slice(0, 12).map((t, i) => (
                        <span key={i} className="px-2 py-0.5 rounded-full text-[11px] font-medium bg-white/10 border border-white/10 text-slate-100">
                          {t}
                        </span>
                      ))}
                      {allFlags.length > 12 && (
                        <span className="text:[11px] text-slate-300/80">+{allFlags.length - 12} more</span>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {hasNotes && (
            <Card className="rounded-2xl mt-5">
              <CardContent className="flex !items-start !justify-start px-5 pt-2 pb-4">
                <div className="w-full">
                  <div className="text-[13px] font-bold uppercase tracking-wide text-slate-200">
                    Notes / Evidence
                  </div>
                  <div className="mt-2 whitespace-pre-wrap text-[14px] leading-relaxed text-slate-100/90 max-h-[40vh] overflow-auto">
                    {entry.notesEvidence}
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
/* ---------------------------------------------
   Custom scroller for scrollbar styling
---------------------------------------------- */
const Scroller = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  (props, ref) => <div ref={ref} {...props} className={(props.className ?? "") + " mmid-scroll"} />
);
Scroller.displayName = "Scroller";

/* ---------------------------------------------
   Full-width, grouped list with A→Z jump rail
---------------------------------------------- */
export default function MMIDFullWidthCardList({ rows, canEdit = false }: { rows: MmidRow[]; canEdit?: boolean }) {
  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState<MmidRow | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [editingUuid, setEditingUuid] = useState<string | null>(null);
  const virtuosoRef = useRef<VirtuosoHandle>(null);

  const toggleCardEdit = useCallback(
    (uuid: string) => {
      setEditMode(true);
      setEditingUuid((prev) => (prev === uuid ? null : uuid));
    },
    []
  );

  const confirmSubmit = useCallback(
    (message: string) =>
      (event: React.FormEvent<HTMLFormElement>) => {
        if (!window.confirm(message)) {
          event.preventDefault();
          event.stopPropagation();
        }
      },
    []
  );

  // search/filter
  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();

    const textFiltered = rows.filter((r) => {
      if (!s) return true;
      return [
        r.username,
        r.uuid,
        r.guild ?? "",
        r.rank ?? "",
        r.status ?? "",
        ...(r.typeOfCheating ?? []),
        ...(r.redFlags ?? []),
        r.notesEvidence ?? "",
      ]
        .join("|")
        .toLowerCase()
        .includes(s);
    });

    return textFiltered.filter((r) => matchesStatusFilter(r.status ?? null, statusFilter));
  }, [rows, q, statusFilter]);

  const totalCount = rows.length;
  const filteredCount = filtered.length;

  // build grouping + flat list
  const { flat, groupCounts, groupLabels, letterToIndex, lettersPresent } =
    useMemo(() => buildAlphaIndex(filtered), [filtered]);

  const jumpTo = useCallback(
    (letter: string) => {
      const idx = letterToIndex.get(letter);
      if (idx == null) return;
      virtuosoRef.current?.scrollToIndex({ index: idx, align: "start", behavior: "smooth" });
    },
    [letterToIndex]
  );

  return (
    <div className="relative min-h-[100dvh] w-full text-foreground">
      <div className="mx-auto max-w-6xl px-4 py-8">
        <header className="mb-3 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
          <div className="space-y-1">
            <h1 className="text-2xl font-semibold tracking-tight">MMID Directory</h1>
            {canEdit && (
              <div className="text-[11px] uppercase tracking-wide text-amber-400/80 flex items-center gap-2">
                <span className={editMode ? "animate-pulse" : "opacity-70"}>
                  Maintainer tools {editMode ? "active" : "available"}
                </span>
              </div>
            )}
          </div>
          <div className="flex flex-col items-stretch gap-2 sm:flex-row sm:items-center">
            <div className="flex items-center gap-2">
              <Input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search by username, guild, rank, status, notes…"
                className="bg-white/10 border-white/10 text-white placeholder:text-white/60 w-72"
              />
              <Button
                variant="secondary"
                className="bg-white/10 border-white/10 text-white"
                onClick={() => setQ("")}
              >
                Clear
              </Button>
            </div>

            {canEdit && (
              <Button
                type="button"
                variant={editMode ? "destructive" : "outline"}
                size="sm"
                className={editMode ? "bg-amber-600 text-black border-amber-700" : ""}
                onClick={() => {
                  setEditMode((v) => !v);
                  if (editMode) setEditingUuid(null);
                }}
              >
                <Pencil className="h-3 w-3" />
                {editMode ? "Exit edit mode" : "Enter edit mode"}
              </Button>
            )}
          </div>
        </header>

        {/* summary + quick status filters */}
        <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between text-xs text-slate-300">
          <div>
            Showing <span className="font-semibold text-slate-100">{filteredCount}</span> of {" "}
            <span className="font-semibold text-slate-100">{totalCount}</span> entries
            {q.trim() && (
              <>
                {" "}for "
                <span className="font-mono">{q.trim()}</span>"
              </>
            )}
            {statusFilter !== "all" && (
              <>
                {" "}· status filter:{" "}
                <span className="font-semibold text-slate-100">{statusFilterLabel(statusFilter)}</span>
              </>
            )}
            <div className="mt-1 text-[11px] text-slate-400">
              Tip: Use the A–Z rail on the right to jump by username.
            </div>
          </div>

          <div className="flex flex-wrap gap-1.5">
            {STATUS_FILTERS.map((f) => (
              <button
                key={f.value}
                type="button"
                onClick={() => setStatusFilter(f.value)}
                className={
                  "rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide transition " +
                  (statusFilter === f.value
                    ? "bg-white text-slate-900 border-white"
                    : "bg-white/5 border-white/10 text-slate-200 hover:bg-white/10")
                }
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {/* taller list so rail fits more often */}
        <div
          className={
            "h-[86vh] rounded border-2 bg-card/90 backdrop-blur-sm overflow-hidden relative transition shadow-lg " +
            (editMode && canEdit
              ? "border-amber-500/80 shadow-[0_0_0_1px_rgba(251,191,36,0.5),0_0_40px_rgba(251,191,36,0.25)]"
              : "border-border/70")
          }
        >
          <GroupedVirtuoso
            ref={virtuosoRef}
            style={{ height: "100%" }}
            data={flat}
            groupCounts={groupCounts}
            components={{ Scroller }}
            computeItemKey={(index) => flat[index]?.uuid ?? `row-${index}`}
            groupContent={(gi) => (
              <div className="sticky top-0 z-10 backdrop-blur bg-slate-900/60 border-b border-white/10 px-3 py-1">
                <span className="text-xs tracking-wider text-slate-300">{groupLabels[gi]}</span>
              </div>
            )}
            itemContent={(index) => {
              const e = flat[index] as MmidRow | undefined;
              if (!e) return null;

              const isEditingThis = editMode && canEdit && editingUuid === e.uuid;

              return (
                <div className="px-4 pr-24 md:pr-28">
                  <button
                    onClick={() => {
                      setActive(e);
                      setOpen(true);
                    }}
                    className="w-full text-left"
                    aria-label={`Open ${e.username}`}
                  >
                    <div
                      className={
                        "w-full rounded border bg-card/95 hover:bg-card transition shadow-sm relative overflow-hidden " +
                        (isEditingThis
                          ? "border-amber-500/80 ring-2 ring-amber-400/70 scale-[0.995]"
                          : "border-border/70")
                      }
                    >
                      {/* Maintainer pencil / tools trigger */}
                      {canEdit && (
                        <div className="absolute right-3 top-3 z-10 flex items-center gap-1">
                          <Button
                            type="button"
                            size="icon"
                            variant={isEditingThis ? "secondary" : "outline"}
                            className={
                              "h-7 w-7 rounded-full border border-amber-400/70 bg-slate-950/80 text-amber-100 shadow-sm transition-transform " +
                              (isEditingThis ? "scale-95" : "hover:scale-105")
                            }
                            onClick={(ev) => {
                              ev.stopPropagation();
                              toggleCardEdit(e.uuid);
                            }}
                            aria-label={
                              isEditingThis ? "Close maintainer tools for this card" : "Open maintainer tools for this card"
                            }
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      )}

                      {/* TOP: player + verdict + quick flags */}
                      <div className="flex flex-col gap-4 p-4 md:flex-row md:items-center">
                        {/* Player column */}
                        <div className="flex items-center gap-4 min-w-0 flex-1">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <MinecraftSkin
                            id={e.uuid}
                            name={e.username}
                            className="h-20 w-auto rounded-lg ring-2 ring-white/10 shrink-0 object-contain"
                          />
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2 min-w-0">
                              <div className="font-semibold truncate text-lg max-w-[40ch]">{e.username}</div>
                              {e.rank && (
                                <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${rankClass(e.rank)}`}>
                                  {e.rank}
                                </span>
                              )}
                            </div>
                            <div className="mt-1 text-xs text-slate-300">
                              <span className="text-slate-400">Rank:</span> {e.rank ?? "Unranked"}
                              {" · "}
                              <span className="text-slate-400">Guild:</span> {e.guild ?? "No guild (no in-game clan/team)"}
                            </div>
                          </div>
                        </div>

                        {/* Verdict column */}
                        <div className="w-full md:w-64 md:text-right">
                          <div className="text-[11px] uppercase tracking-wide text-slate-400 mb-1">Verdict</div>
                          <div>
                            <span
                              className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${statusTone(
                                e.status
                              )}`}
                            >
                              {e.status ?? "Not set"}
                            </span>
                          </div>
                          <div className="mt-2 flex flex-wrap items-center gap-1 text-xs text-slate-300 md:justify-end">
                            <span className="text-slate-400">Confidence:</span>
                            <Stars n={e.confidenceScore ?? 0} />
                            <span className="text-[11px] text-slate-500">(0–5: how sure this review is)</span>
                          </div>
                        </div>

                        {/* Quick flags (desktop) */}
                        <div className="hidden lg:block w-[30%]">
                          <div className="text-[11px] uppercase tracking-wide text-slate-400 mb-1 text-right">
                            Key flags
                          </div>
                          <div className="flex flex-wrap gap-1.5 justify-end">
                            {(e.typeOfCheating ?? []).slice(0, 2).map((t, i) => (
                              <span
                                key={`tc-top-${i}`}
                                className="px-2 py-0.5 rounded-full text-[11px] bg-slate-700/70 text-white"
                              >
                                {t}
                              </span>
                            ))}
                            {(e.redFlags ?? []).slice(0, 2).map((t, i) => (
                              <span
                                key={`rf-top-${i}`}
                                className="px-2 py-0.5 rounded-full text-[11px] bg-slate-800/80 text-white"
                              >
                                {t}
                              </span>
                            ))}
                          </div>
                        </div>
                      </div>

                      {/* MIDDLE: full flags / cheating summary */}
                      <Separator className="bg-white/10" />
                      <div className="flex flex-col gap-1.5 p-3 text-xs text-white/80">
                        <span className="text-[11px] uppercase tracking-wide text-slate-400">
                          Flags / cheating summary
                        </span>
                        <div className="mt-1 flex flex-wrap gap-1.5">
                          {(e.typeOfCheating ?? []).slice(0, 6).map((t, i) => (
                            <span
                              key={`tc-${i}`}
                              className="px-2 py-0.5 rounded-full text-[11px] bg-slate-700/70 text-white"
                            >
                              {t}
                            </span>
                          ))}
                          {(e.redFlags ?? []).slice(0, 6).map((t, i) => (
                            <span
                              key={`rf-${i}`}
                              className="px-2 py-0.5 rounded-full text-[11px] bg-slate-800/80 text-white"
                            >
                              {t}
                            </span>
                          ))}
                          {!(e.typeOfCheating && e.typeOfCheating.length) &&
                            !(e.redFlags && e.redFlags.length) && (
                              <span className="text-[11px] text-slate-400">No flags recorded.</span>
                            )}
                        </div>
                      </div>

                      {/* FOOTER: reviewer + community vote */}
                      <Separator className="bg-white/10" />
                      <div className="flex flex-col gap-2 p-3 text-xs text-white/70 md:flex-row md:items-center md:justify-between">
                        <div className="flex flex-col">
                          <span className="text-[11px] uppercase tracking-wide text-slate-400">
                            Reviewed by
                          </span>
                          <span>{e.reviewedBy ?? "N/A"}</span>
                          {e.lastUpdated && (
                            <span className="mt-0.5 text-[11px] text-slate-400">
                              Last updated
                              {" "}
                              {e.reviewedBy && (
                                <>
                                  by <span className="text-slate-200">{e.reviewedBy}</span>
                                </>
                              )}
                              {" "}
                              at{" "}
                              <span className="text-slate-200">
                                {new Date(e.lastUpdated).toLocaleString()}
                              </span>
                            </span>
                          )}
                        </div>
                        <div className="flex flex-col items-start gap-1 md:items-end">
                          <span className="text-[11px] uppercase tracking-wide text-slate-400">
                            Community vote
                          </span>
                          <div className="flex items-center gap-1 text-[11px]">
                            <form action={voteOnEntry} className="inline-flex">
                              <input type="hidden" name="entryUuid" value={e.uuid} />
                              <input type="hidden" name="direction" value="up" />
                              <button
                                type="submit"
                                className={`inline-flex items-center gap-1 rounded-full px-2 py-1 border text-[11px] transition ${
                                  e.userVote === 1
                                    ? "bg-emerald-500/20 border-emerald-400/60 text-emerald-200"
                                    : "bg-slate-900/40 border-white/15 text-slate-200 hover:bg-slate-800/60"
                                }`}
                                aria-label="Upvote entry"
                              >
                                <ArrowUp className="h-3 w-3" />
                              </button>
                            </form>
                            <span className="min-w-[2ch] text-center text-slate-200">
                              {e.voteScore ?? 0}
                            </span>
                            <form action={voteOnEntry} className="inline-flex">
                              <input type="hidden" name="entryUuid" value={e.uuid} />
                              <input type="hidden" name="direction" value="down" />
                              <button
                                type="submit"
                                className={`inline-flex items-center gap-1 rounded-full px-2 py-1 border text-[11px] transition ${
                                  e.userVote === -1
                                    ? "bg-rose-500/20 border-rose-400/60 text-rose-200"
                                    : "bg-slate-900/40 border-white/15 text-slate-200 hover:bg-slate-800/60"
                                }`}
                                aria-label="Downvote entry"
                              >
                                <ArrowDown className="h-3 w-3" />
                              </button>
                            </form>
                          </div>
                        </div>
                      </div>

                      {canEdit && isEditingThis && (
                        <div className="border-t border-amber-500/40 bg-amber-950/70 px-3 py-2 text-[11px] text-amber-50 space-y-2">
                          <div className="flex flex-wrap items-center gap-2 justify-between">
                            <span className="flex items-center gap-1 uppercase tracking-wide text-[10px]">
                              Maintainer tools for <span className="font-semibold">{e.username}</span>
                            </span>
                            <div className="flex flex-wrap gap-1.5 justify-end">
                              <form
                              action={checkUsernameChange}
                              onSubmit={confirmSubmit("Check Mojang for any username changes for this UUID?")}
                              onClick={(ev) => ev.stopPropagation()}
                            >
                              <input type="hidden" name="entryUuid" value={e.uuid} />
                              <Button type="submit" size="sm" variant="outline" className="h-7 px-2 text-[11px]">
                                <RefreshCw className="h-3 w-3" /> Username
                              </Button>
                            </form>

                            <form
                              action={checkHypixelData}
                              onSubmit={confirmSubmit("Refresh Hypixel rank and guild for this player?")}
                              onClick={(ev) => ev.stopPropagation()}
                            >
                              <input type="hidden" name="entryUuid" value={e.uuid} />
                              <Button type="submit" size="sm" variant="outline" className="h-7 px-2 text-[11px]">
                                <RefreshCw className="h-3 w-3" /> Hypixel
                              </Button>
                            </form>

                            <form
                              action={markEntryNeedsReview}
                              onSubmit={confirmSubmit("Mark this entry as 'Needs Reviewed'?")}
                              onClick={(ev) => ev.stopPropagation()}
                            >
                              <input type="hidden" name="entryUuid" value={e.uuid} />
                              <Button type="submit" size="sm" variant="secondary" className="h-7 px-2 text-[11px] bg-amber-500/90 text-black border-amber-700">
                                <ShieldQuestion className="h-3 w-3" /> Send to review
                              </Button>
                            </form>

                            <form
                              action={deleteEntryPermanently}
                              onSubmit={confirmSubmit("Permanently delete this entry from the directory? This cannot be undone.")}
                              onClick={(ev) => ev.stopPropagation()}
                            >
                              <input type="hidden" name="entryUuid" value={e.uuid} />
                              <Button type="submit" size="sm" variant="destructive" className="h-7 px-2 text-[11px]">
                                <Trash2 className="h-3 w-3" /> Delete
                              </Button>
                            </form>
                          </div>
                          </div>

                          <form
                            action={upsertEntry}
                            onSubmit={confirmSubmit("Apply inline edits to this entry?")}
                            onClick={(ev) => ev.stopPropagation()}
                            className="grid gap-1 w-full md:grid-cols-[minmax(0,1.4fr)_minmax(0,1.1fr)_minmax(0,1.4fr)_auto]"
                          >
                            <input type="hidden" name="targetUuid" value={e.uuid} />
                            <input type="hidden" name="uuid" value={e.uuid} />
                            <input type="hidden" name="username" value={e.username} />
                            <input type="hidden" name="guild" value={e.guild ?? ""} />
                            <input type="hidden" name="rank" value={e.rank ?? ""} />
                            {(e.typeOfCheating ?? []).map((t, i) => (
                              <input key={`tc-inline-${i}`} type="hidden" name="typeOfCheating" value={t} />
                            ))}
                            {(e.redFlags ?? []).map((t, i) => (
                              <input key={`rf-inline-${i}`} type="hidden" name="redFlags" value={t} />
                            ))}

                            <label className="flex flex-col gap-0.5">
                              <span className="uppercase tracking-wide text-[10px] opacity-80">Status</span>
                              <input
                                name="status"
                                defaultValue={e.status ?? ""}
                                className="px-2 py-1 rounded border border-amber-500/60 bg-amber-950/80 text-amber-50 placeholder:text-amber-200/40"
                                placeholder="Status"
                              />
                            </label>

                            <label className="flex flex-col gap-0.5">
                              <span className="uppercase tracking-wide text-[10px] opacity-80">Confidence</span>
                              <input
                                name="confidenceScore"
                                type="number"
                                min={0}
                                max={5}
                                defaultValue={e.confidenceScore ?? ""}
                                className="px-2 py-1 rounded border border-amber-500/60 bg-amber-950/80 text-amber-50"
                              />
                            </label>

                            <label className="flex flex-col gap-0.5">
                              <span className="uppercase tracking-wide text-[10px] opacity-80">Reviewer</span>
                              <input
                                name="reviewedBy"
                                defaultValue={e.reviewedBy ?? ""}
                                className="px-2 py-1 rounded border border-amber-500/60 bg-amber-950/80 text-amber-50"
                                placeholder="Reviewed by"
                              />
                            </label>

                            <Button
                              type="submit"
                              size="sm"
                              variant="secondary"
                              className="self-end h-7 px-3 text-[11px] bg-emerald-400/90 text-black border-emerald-700"
                            >
                              Save inline
                            </Button>
                          </form>

                          <form
                            action={upsertEntry}
                            onSubmit={confirmSubmit("Update notes / evidence for this entry?")}
                            onClick={(ev) => ev.stopPropagation()}
                            className="w-full"
                          >
                            <input type="hidden" name="targetUuid" value={e.uuid} />
                            <input type="hidden" name="uuid" value={e.uuid} />
                            <input type="hidden" name="username" value={e.username} />
                            <input type="hidden" name="guild" value={e.guild ?? ""} />
                            <input type="hidden" name="rank" value={e.rank ?? ""} />
                            {(e.typeOfCheating ?? []).map((t, i) => (
                              <input key={`tc-notes-${i}`} type="hidden" name="typeOfCheating" value={t} />
                            ))}
                            {(e.redFlags ?? []).map((t, i) => (
                              <input key={`rf-notes-${i}`} type="hidden" name="redFlags" value={t} />
                            ))}
                            <input type="hidden" name="status" value={e.status ?? ""} />
                            <input type="hidden" name="confidenceScore" value={e.confidenceScore ?? ""} />
                            <input type="hidden" name="reviewedBy" value={e.reviewedBy ?? ""} />

                            <label className="flex flex-col gap-0.5">
                              <span className="uppercase tracking-wide text-[10px] opacity-80">Notes / Evidence</span>
                              <textarea
                                name="notesEvidence"
                                defaultValue={e.notesEvidence ?? ""}
                                rows={2}
                                className="mt-0.5 w-full resize-none rounded border border-amber-500/60 bg-amber-950/80 text-amber-50 px-2 py-1"
                              />
                            </label>
                            <div className="mt-1 flex justify-end">
                              <Button
                                type="submit"
                                size="sm"
                                variant="secondary"
                                className="h-7 px-3 text-[11px] bg-emerald-400/90 text-black border-emerald-700"
                              >
                                Save notes
                              </Button>
                            </div>
                          </form>
                        </div>
                      )}
                    </div>
                  </button>
                </div>
              );
            }}
          />

          {/* A→Z jump rail (frosted; scrolls if needed; never blocks list) */}
            <div className="hidden md:block absolute right-3 top-3 bottom-3 z-20 select-none pointer-events-none">
            <div className="h-full flex items-center">
              <div className="pointer-events-auto max-h-full overflow-y-auto no-scrollbar">
                <div className="backdrop-blur-md bg-black/70 border border-border/70 rounded px-2 py-2 shadow-lg">
                  {[...LETTERS, "#"].map((L) => {
                    const present = lettersPresent.has(L);
                    return (
                      <button
                        key={L}
                        onClick={() => present && jumpTo(L)}
                        className={
                          "w-10 h-10 rounded text-sm font-semibold flex items-center justify-center transition " +
                          (present
                            ? "text-slate-100 hover:bg-white/10 active:scale-[0.98]"
                            : "text-slate-500 cursor-default")
                        }
                        aria-disabled={!present}
                        title={present ? `Jump to ${L}` : `${L} (no entries)`}
                      >
                        {L}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <EntryCard entry={active} open={open} onOpenChange={setOpen} />
    </div>
  );
}

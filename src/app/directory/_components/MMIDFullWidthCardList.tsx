"use client";

import React, { useMemo, useState, useRef, useCallback } from "react";
import { GroupedVirtuoso, type VirtuosoHandle } from "react-virtuoso";

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { ArrowDown, ArrowUp, Pencil, RefreshCw, ShieldQuestion, Trash2, Star, X, Copy } from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import * as DialogPrimitive from "@radix-ui/react-dialog";

import { Card, CardContent } from "@/components/ui/card";
import MinecraftSkin from "@/components/MinecraftSkin";
import { voteOnEntry, checkUsernameChange, checkHypixelData, markEntryNeedsReview, deleteEntryPermanently } from "../actions";
import { upsertEntry } from "../../entries/new/actions";

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
  usernameHistory?: { username: string; changedAt: string }[];
};

/* ---------------------------------------------
   A–Z helpers (grouping + jump index)
---------------------------------------------- */
const LETTERS = Array.from({ length: 26 }, (_, i) => String.fromCharCode(65 + i));
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
   Status filter helpers
---------------------------------------------- */
export type StatusFilter = "all" | "legit" | "cheating" | "needs-review" | "unverified";

const STATUS_FILTERS: { value: StatusFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "legit", label: "Legit / Cleared" },
  { value: "cheating", label: "Cheating / Flagged" },
  { value: "needs-review", label: "Needs review" },
  { value: "unverified", label: "Unverified" },
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

// Simple set of Hypixel-like background banners for the modal header
// Use a single local image so all profile banners share the same artwork.
const BANNERS = ["/images/hypixel.png"];

function pickBanner(key: string) {
  // We still keep the hashing logic in case we add more banners later,
  // but currently every profile will resolve to the same local image.
  let h = 0;
  for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) | 0;
  const idx = Math.abs(h) % BANNERS.length;
  return BANNERS[idx];
}

/* ---------------------------------------------
   Utility components / types
---------------------------------------------- */

const Scroller = React.forwardRef<HTMLDivElement, React.ComponentPropsWithoutRef<"div">>(
  function Scroller({ className, ...props }, ref) {
    return (
      <div
        ref={ref}
        className={`scrollbar-thin scrollbar-thumb-slate-700 scrollbar-track-slate-900 ${className ?? ""}`}
        {...props}
      />
    );
  },
);

type PendingAction =
  | { kind: "username"; uuid: string }
  | { kind: "hypixel"; uuid: string }
  | { kind: "needs-review"; uuid: string }
  | { kind: "delete"; uuid: string }
  | { kind: "inline"; uuid: string }
  | null;

type MMIDFullWidthCardListProps = {
  rows: MmidRow[];
  canEdit?: boolean;
  initialFocusUuid?: string | null;
  /** When true, start with maintainer tools enabled for all cards */
  initialEditMode?: boolean;
};

export default function MMIDFullWidthCardList({
  rows,
  canEdit = false,
  initialFocusUuid,
  initialEditMode = false,
}: MMIDFullWidthCardListProps) {
  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [editMode, setEditMode] = useState(initialEditMode);
  const [editingUuid, setEditingUuid] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<PendingAction>(null);
  const [active, setActive] = useState<MmidRow | null>(null);
  const [open, setOpen] = useState(false);

  const virtuosoRef = useRef<VirtuosoHandle | null>(null);
  const hasAutoFocusedRef = useRef(false);

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

  const { flat, groupCounts, groupLabels, letterToIndex, lettersPresent } = useMemo(
    () => buildAlphaIndex(filtered),
    [filtered],
  );

  const jumpTo = useCallback(
    (letter: string) => {
      const idx = letterToIndex.get(letter);
      if (idx == null) return;
      virtuosoRef.current?.scrollToIndex({ index: idx, align: "start", behavior: "smooth" });
    },
    [letterToIndex],
  );

  React.useEffect(() => {
    if (!canEdit || !initialFocusUuid || hasAutoFocusedRef.current) return;
    const idx = flat.findIndex((r) => r.uuid === initialFocusUuid);
    if (idx < 0) return;
    hasAutoFocusedRef.current = true;
    setEditMode(true);
    setEditingUuid(initialFocusUuid);
    virtuosoRef.current?.scrollToIndex({ index: idx, align: "center", behavior: "smooth" });
  }, [canEdit, initialFocusUuid, flat]);

  const toggleCardEdit = (uuid: string) => {
    setEditingUuid((prev) => (prev === uuid ? null : uuid));
    setPendingAction(null);
  };

  const handleOpenChange = (next: boolean) => {
    setOpen(next);
    if (!next) setActive(null);
  };

  return (
    <div className="relative min-h-[100dvh] w-full text-foreground">
      <div className="mx-auto w-full max-w-[1400px] px-4 py-8">
        <header className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div className="space-y-1">
            <h1 className="text-2xl font-semibold tracking-tight">MMID Directory</h1>
            {canEdit && (
              <div className="flex items-center gap-2 text-[11px] uppercase tracking-wide text-amber-400/80">
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
                className="w-72 border-white/10 bg-white/10 text-white placeholder:text-white/60"
              />
              <Button
                variant="secondary"
                className="border-white/10 bg-white/10 text-white"
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
                className={editMode ? "border-amber-700 bg-amber-600 text-black" : ""}
                onClick={() => {
                  setEditMode((v) => !v);
                  setEditingUuid(null);
                  setPendingAction(null);
                }}
              >
                <Pencil className="h-3 w-3" />
                {editMode ? "Exit edit mode" : "Enter edit mode"}
              </Button>
            )}
          </div>
        </header>

        <div className="mb-4 flex flex-col gap-2 text-xs text-slate-300 sm:flex-row sm:items-center sm:justify-between">
          <div>
            Showing <span className="font-semibold text-slate-100">{filteredCount}</span> of{" "}
            <span className="font-semibold text-slate-100">{totalCount}</span> entries
            {q.trim() && (
              <>
                {" "}for "<span className="font-mono">{q.trim()}</span>"
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
                    ? "border-white bg-white text-slate-900"
                    : "border-white/10 bg-white/5 text-slate-200 hover:bg-white/10")
                }
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        <div
          className={
            "relative h-[86vh] overflow-hidden rounded border-2 bg-card/90 shadow-lg backdrop-blur-sm transition " +
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
              <div className="sticky top-0 z-10 border-b border-white/10 bg-slate-900/60 px-3 py-1 backdrop-blur">
                <span className="text-xs tracking-wider text-slate-300">{groupLabels[gi]}</span>
              </div>
            )}
            itemContent={(index) => {
              const e = flat[index] as MmidRow | undefined;
              if (!e) return null;

              const isEditingThis = editMode && canEdit && editingUuid === e.uuid;

              return (
                <div className="px-3 pr-14 md:px-4 md:pr-16">
                  <div
                    role="button"
                    tabIndex={0}
                    onClick={() => {
                      setActive(e);
                      setOpen(true);
                    }}
                    onKeyDown={(ev) => {
                      const target = ev.target as HTMLElement | null;
                      if (
                        target &&
                        (target.tagName === "INPUT" ||
                          target.tagName === "TEXTAREA" ||
                          target.tagName === "BUTTON" ||
                          target.isContentEditable)
                      ) {
                        return;
                      }

                      if (ev.key === "Enter" || ev.key === " ") {
                        ev.preventDefault();
                        setActive(e);
                        setOpen(true);
                      }
                    }}
                    className="w-full text-left"
                    aria-label={`Open ${e.username}`}
                  >
                    <div
                      className={
                        "relative w-full transform overflow-hidden rounded border bg-card/80 shadow-sm transition " +
                        (isEditingThis
                          ? "scale-[0.995] border-amber-500/80 ring-2 ring-amber-400/70"
                          : "border-border/70 hover:-translate-y-0.5 hover:scale-[1.015] hover:border-white/25 hover:bg-card hover:shadow-lg")
                      }
                    >
                      {canEdit && (
                        <div className="absolute left-3 top-3 z-10 flex items-center gap-1">
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

                      <div className="p-3.5 text-xs text-slate-200 md:p-3.5">
                        <div className="grid grid-cols-1 items-start gap-3 md:grid-cols-[minmax(0,2.6fr)_minmax(0,1.4fr)_minmax(0,2.0fr)_minmax(0,2.2fr)_minmax(0,1.4fr)] md:gap-4">
                          <div className="flex min-w-0 items-center gap-4">
                            <MinecraftSkin
                              id={e.uuid}
                              name={e.username}
                              className="h-24 w-auto shrink-0 rounded-lg object-contain ring-2 ring-white/10"
                            />
                            <div className="min-w-0 flex-1">
                              <div className="flex min-w-0 flex-wrap items-center gap-1.5">
                                {e.rank && (
                                  <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${rankClass(e.rank)}`}>
                                    {e.rank}
                                  </span>
                                )}
                                <div className="max-w-[32ch] truncate text-[15px] font-semibold md:text-[16px]">
                                  {e.username}
                                </div>
                              </div>
                              <div className="mt-1 truncate text-[11px] text-slate-300">
                                {e.guild ?? "No guild"}
                              </div>
                              {!!(e.redFlags && e.redFlags.length) && (
                                <div className="mt-1 flex flex-wrap gap-1.5 text-[11px]">
                                  {(e.redFlags ?? []).map((t, i) => (
                                    <span
                                      key={`rf-head-${i}`}
                                      className="rounded-full bg-slate-800/80 px-2 py-0.5 text-[11px] text-white"
                                    >
                                      {t}
                                    </span>
                                  ))}
                                </div>
                              )}
                            </div>
                          </div>

                          <div className="flex flex-col items-start gap-1.5 md:items-start">
                            <div className="text-[11px] uppercase tracking-wide text-slate-400">Verdict</div>
                            <div>
                              <span
                                className={`inline-flex items-center rounded-full px-3 py-1 text-[11px] font-semibold ${statusTone(
                                  e.status,
                                )}`}
                              >
                                {e.status ?? "Not set"}
                              </span>
                            </div>
                            <div className="flex flex-wrap items-center gap-1 text-[11px] text-slate-300">
                              <span className="text-slate-400">Confidence:</span>
                              <Stars n={e.confidenceScore ?? 0} />
                            </div>
                          </div>

                          <div className="min-w-0">
                            <div className="mb-1 text-[11px] uppercase tracking-wide text-slate-400">Cheating & behavior tags</div>
                            <div className="flex flex-wrap gap-1.5">
                              {(e.typeOfCheating ?? []).slice(0, 4).map((t, i) => (
                                <span
                                  key={`tc-${i}`}
                                  className="rounded-full bg-slate-700/70 px-2 py-0.5 text-[11px] text-white"
                                >
                                  {t}
                                </span>
                              ))}
                              {(e.redFlags ?? []).slice(0, 2).map((t, i) => (
                                <span
                                  key={`rf-${i}`}
                                  className="rounded-full bg-slate-800/80 px-2 py-0.5 text-[11px] text-white"
                                >
                                  {t}
                                </span>
                              ))}
                              {!(e.typeOfCheating && e.typeOfCheating.length) &&
                                !(e.redFlags && e.redFlags.length) && (
                                  <span className="text-[11px] text-slate-500">No flags recorded</span>
                                )}
                            </div>
                          </div>

                          <div className="min-w-0">
                            <div className="mb-1 text-[11px] uppercase tracking-wide text-slate-400">Notes / evidence</div>
                            <div className="line-clamp-2 whitespace-pre-line text-[11px] text-slate-300">
                              {e.notesEvidence?.trim() ? (
                                e.notesEvidence
                              ) : (
                                <span className="text-slate-500">No notes yet</span>
                              )}
                            </div>
                          </div>

                          <div className="flex h-full items-center justify-end">
                            <div className="mr-1 flex flex-col items-center gap-1">
                              <div className="flex items-center gap-2">
                                <form action={voteOnEntry} className="inline-flex">
                                  <input type="hidden" name="entryUuid" value={e.uuid} />
                                  <input type="hidden" name="direction" value="up" />
                                  <button
                                    type="submit"
                                    className={`inline-flex items-center justify-center rounded-full border px-2.5 py-1.5 text-[12px] transition ${
                                      e.userVote === 1
                                        ? "border-emerald-400/70 bg-emerald-500/25 text-emerald-100 shadow-sm"
                                        : "border-white/20 bg-slate-950/60 text-slate-100 hover:border-white/40 hover:bg-slate-800/80"
                                    }`}
                                    aria-label="Upvote entry"
                                  >
                                    <ArrowUp className="h-4 w-4" />
                                  </button>
                                </form>
                                <span className="min-w-[3ch] text-center text-3xl font-semibold text-slate-50">
                                  {e.voteScore ?? 0}
                                </span>
                                <form action={voteOnEntry} className="inline-flex">
                                  <input type="hidden" name="entryUuid" value={e.uuid} />
                                  <input type="hidden" name="direction" value="down" />
                                  <button
                                    type="submit"
                                    className={`inline-flex items-center justify-center rounded-full border px-2.5 py-1.5 text-[12px] transition ${
                                      e.userVote === -1
                                        ? "border-rose-400/70 bg-rose-500/25 text-rose-100 shadow-sm"
                                        : "border-white/20 bg-slate-950/60 text-slate-100 hover:border-white/40 hover:bg-slate-800/80"
                                    }`}
                                    aria-label="Downvote entry"
                                  >
                                    <ArrowDown className="h-4 w-4" />
                                  </button>
                                </form>
                              </div>
                              <div className="text-[10px] uppercase tracking-wide text-slate-400">Votes</div>
                            </div>
                          </div>
                        </div>
                      </div>

                      {canEdit && isEditingThis && (
                        <div className="space-y-2 border-t border-amber-500/40 bg-amber-950/70 px-3 py-2 text-[11px] text-amber-50">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <span className="flex items-center gap-1 text-[10px] uppercase tracking-wide">
                              Maintainer tools for <span className="font-semibold">{e.username}</span>
                            </span>
                            <div className="flex flex-wrap justify-end gap-1.5">
                              <form
                                action={checkUsernameChange}
                                onClick={(ev) => ev.stopPropagation()}
                              >
                                <input type="hidden" name="entryUuid" value={e.uuid} />
                                <div className="flex items-center gap-1">
                                  <Button
                                    type="button"
                                    size="sm"
                                    variant="outline"
                                    className="h-7 px-2 text-[11px]"
                                    onClick={() => setPendingAction({ kind: "username", uuid: e.uuid })}
                                  >
                                    <RefreshCw className="h-3 w-3" /> Username
                                  </Button>
                                  {pendingAction && pendingAction.uuid === e.uuid && pendingAction.kind === "username" && (
                                    <>
                                      <Button
                                        type="submit"
                                        size="sm"
                                        variant="secondary"
                                        className="h-7 px-2 text-[11px] border-emerald-700 bg-emerald-400/90 text-black"
                                      >
                                        Confirm
                                      </Button>
                                      <Button
                                        type="button"
                                        size="sm"
                                        variant="ghost"
                                        className="h-7 px-2 text-[11px]"
                                        onClick={() => setPendingAction(null)}
                                      >
                                        Cancel
                                      </Button>
                                    </>
                                  )}
                                </div>
                              </form>

                              <form
                                action={checkHypixelData}
                                onClick={(ev) => ev.stopPropagation()}
                              >
                                <input type="hidden" name="entryUuid" value={e.uuid} />
                                <div className="flex items-center gap-1">
                                  <Button
                                    type="button"
                                    size="sm"
                                    variant="outline"
                                    className="h-7 px-2 text-[11px]"
                                    onClick={() => setPendingAction({ kind: "hypixel", uuid: e.uuid })}
                                  >
                                    <RefreshCw className="h-3 w-3" /> Hypixel
                                  </Button>
                                  {pendingAction && pendingAction.uuid === e.uuid && pendingAction.kind === "hypixel" && (
                                    <>
                                      <Button
                                        type="submit"
                                        size="sm"
                                        variant="secondary"
                                        className="h-7 px-2 text-[11px] border-emerald-700 bg-emerald-400/90 text-black"
                                      >
                                        Confirm
                                      </Button>
                                      <Button
                                        type="button"
                                        size="sm"
                                        variant="ghost"
                                        className="h-7 px-2 text-[11px]"
                                        onClick={() => setPendingAction(null)}
                                      >
                                        Cancel
                                      </Button>
                                    </>
                                  )}
                                </div>
                              </form>

                              <form
                                action={markEntryNeedsReview}
                                onClick={(ev) => ev.stopPropagation()}
                              >
                                <input type="hidden" name="entryUuid" value={e.uuid} />
                                <div className="flex items-center gap-1">
                                  <Button
                                    type="button"
                                    size="sm"
                                    variant="secondary"
                                    className="h-7 px-2 text-[11px] border-amber-700 bg-amber-500/90 text-black"
                                    onClick={() => setPendingAction({ kind: "needs-review", uuid: e.uuid })}
                                  >
                                    <ShieldQuestion className="h-3 w-3" /> Send to review
                                  </Button>
                                  {pendingAction && pendingAction.uuid === e.uuid && pendingAction.kind === "needs-review" && (
                                    <>
                                      <Button
                                        type="submit"
                                        size="sm"
                                        variant="secondary"
                                        className="h-7 px-2 text-[11px] border-emerald-700 bg-emerald-400/90 text-black"
                                      >
                                        Confirm
                                      </Button>
                                      <Button
                                        type="button"
                                        size="sm"
                                        variant="ghost"
                                        className="h-7 px-2 text-[11px]"
                                        onClick={() => setPendingAction(null)}
                                      >
                                        Cancel
                                      </Button>
                                    </>
                                  )}
                                </div>
                              </form>

                              <form
                                action={deleteEntryPermanently}
                                onClick={(ev) => ev.stopPropagation()}
                              >
                                <input type="hidden" name="entryUuid" value={e.uuid} />
                                <div className="flex items-center gap-1">
                                  <Button
                                    type="button"
                                    size="sm"
                                    variant="destructive"
                                    className="h-7 px-2 text-[11px]"
                                    onClick={() => setPendingAction({ kind: "delete", uuid: e.uuid })}
                                  >
                                    <Trash2 className="h-3 w-3" /> Delete
                                  </Button>
                                  {pendingAction && pendingAction.uuid === e.uuid && pendingAction.kind === "delete" && (
                                    <>
                                      <Button
                                        type="submit"
                                        size="sm"
                                        variant="destructive"
                                        className="h-7 px-2 text-[11px]"
                                      >
                                        Confirm
                                      </Button>
                                      <Button
                                        type="button"
                                        size="sm"
                                        variant="ghost"
                                        className="h-7 px-2 text-[11px]"
                                        onClick={() => setPendingAction(null)}
                                      >
                                        Cancel
                                      </Button>
                                    </>
                                  )}
                                </div>
                              </form>
                            </div>
                          </div>

                          <form
                            action={upsertEntry}
                            onClick={(ev) => ev.stopPropagation()}
                            className="grid w-full gap-1 md:grid-cols-[minmax(0,1.4fr)_minmax(0,1.1fr)_minmax(0,1.4fr)_auto]"
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
                              <span className="text-[10px] uppercase tracking-wide opacity-80">Status</span>
                              <input
                                name="status"
                                defaultValue={e.status ?? ""}
                                className="rounded border border-amber-500/60 bg-amber-950/80 px-2 py-1 text-amber-50 placeholder:text-amber-200/40"
                                placeholder="Status"
                              />
                            </label>

                            <label className="flex flex-col gap-0.5">
                              <span className="text-[10px] uppercase tracking-wide opacity-80">Confidence</span>
                              <input
                                name="confidenceScore"
                                type="number"
                                min={0}
                                max={5}
                                defaultValue={e.confidenceScore ?? ""}
                                className="rounded border border-amber-500/60 bg-amber-950/80 px-2 py-1 text-amber-50"
                              />
                            </label>

                            <label className="flex flex-col gap-0.5">
                              <span className="text-[10px] uppercase tracking-wide opacity-80">Reviewer</span>
                              <input
                                name="reviewedBy"
                                defaultValue={e.reviewedBy ?? ""}
                                className="rounded border border-amber-500/60 bg-amber-950/80 px-2 py-1 text-amber-50"
                                placeholder="Reviewed by"
                              />
                            </label>

                            <div className="flex items-center justify-end gap-1">
                              {pendingAction && pendingAction.uuid === e.uuid && pendingAction.kind === "inline" && (
                                <>
                                  <Button
                                    type="submit"
                                    size="sm"
                                    variant="secondary"
                                    className="h-7 px-3 text-[11px] border-emerald-700 bg-emerald-400/90 text-black"
                                  >
                                    Confirm
                                  </Button>
                                  <Button
                                    type="button"
                                    size="sm"
                                    variant="ghost"
                                    className="h-7 px-2 text-[11px]"
                                    onClick={() => setPendingAction(null)}
                                  >
                                    Cancel
                                  </Button>
                                </>
                              )}
                              <Button
                                type="button"
                                size="sm"
                                variant="secondary"
                                className="h-7 px-3 text-[11px] border-emerald-700 bg-emerald-400/90 text-black"
                                onClick={() => setPendingAction({ kind: "inline", uuid: e.uuid })}
                              >
                                Save inline
                              </Button>
                            </div>
                          </form>

                          <form
                            action={upsertEntry}
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
                              <span className="text-[10px] uppercase tracking-wide opacity-80">Notes / Evidence</span>
                              <textarea
                                name="notesEvidence"
                                defaultValue={e.notesEvidence ?? ""}
                                rows={2}
                                className="mt-0.5 w-full resize-none rounded border border-amber-500/60 bg-amber-950/80 px-2 py-1 text-amber-50"
                              />
                            </label>
                            <div className="mt-1 flex justify-end gap-1">
                              <Button
                                type="submit"
                                size="sm"
                                variant="secondary"
                                className="h-7 px-3 text-[11px] border-emerald-700 bg-emerald-400/90 text-black"
                              >
                                Save notes
                              </Button>
                            </div>
                          </form>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            }}
          />

          <div className="pointer-events-none absolute right-3 top-3 bottom-3 z-20 hidden select-none md:block">
            <div className="flex h-full items-center">
              <div className="pointer-events-auto max-h-full overflow-y-auto no-scrollbar">
                <div className="rounded border border-border/70 bg-black/70 px-2 py-2 shadow-lg backdrop-blur-md">
                  {[...LETTERS, "#"].map((L) => {
                    const present = lettersPresent.has(L);
                    return (
                      <button
                        key={L}
                        onClick={() => present && jumpTo(L)}
                        className={
                          "flex h-10 w-10 items-center justify-center rounded text-sm font-semibold transition " +
                          (present
                            ? "text-slate-100 hover:bg-white/10 active:scale-[0.98]"
                            : "cursor-default text-slate-500")
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

      <EntryCard entry={active} open={open} onOpenChange={handleOpenChange} canEdit={canEdit} />
    </div>
  );
}

/* ---------------------------------------------
   Modal with full-body render + username history
---------------------------------------------- */

type EntryCardProps = {
  entry: MmidRow | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  canEdit?: boolean;
};

export function EntryCard({ entry, open, onOpenChange, canEdit = false }: EntryCardProps) {
  const [showHistory, setShowHistory] = useState(false);
  const [imgError, setImgError] = useState(false);
  const [copied, setCopied] = useState(false);

  React.useEffect(() => {
    setImgError(false);
    setShowHistory(false);
  }, [entry?.uuid]);

  if (!entry) return null;

  const fullBodyPrimary = `https://visage.surgeplay.com/full/256/${entry.uuid}.png`;
  const fullBodyFallback = `https://mc-heads.net/body/${entry.uuid}/256`;
  const imgSrc = imgError ? fullBodyFallback : fullBodyPrimary;

  const bannerUrl = pickBanner(entry.uuid || entry.username);
  const guildColor = entry.guild ? stringToHsl(entry.guild) : "hsl(220 15% 30%)";

  const close = () => {
    setShowHistory(false);
    onOpenChange(false);
  };

  const handleCopyUuid = async () => {
    try {
      await navigator.clipboard.writeText(entry.uuid);
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } catch {
      // ignore
    }
  };

  const hasHistory = Array.isArray(entry.usernameHistory) && entry.usernameHistory.length > 0;

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) close();
        else onOpenChange(true);
      }}
    >
      <DialogContent className="w-full max-w-[760px] overflow-hidden border border-white/10 bg-slate-950/95 p-0 text-slate-50">
        <DialogTitle className="sr-only">{entry.username}</DialogTitle>

        {/* Compact, clean banner header */}
        <div className="relative h-36 w-full overflow-hidden border-b border-white/10 bg-slate-950/95">
          {/* Subtle blurred background using the banner image */}
          <div
            className="absolute inset-0 bg-cover bg-center blur-[3px] opacity-40"
            style={{ backgroundImage: `url(${bannerUrl})` }}
          />
          {/* Dark gradient overlay for readability */}
          <div className="absolute inset-0 bg-gradient-to-r from-black/90 via-slate-950/90 to-slate-900/80" />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(255,255,255,0.16),_transparent_55%)] mix-blend-soft-light" />

          <div className="relative flex h-full items-center justify-between px-6">
            <div className="space-y-1">
              <p className="text-[11px] uppercase tracking-[0.22em] text-amber-300/80">
                MMID · Profile Overview
              </p>
              <h2 className="text-3xl font-semibold tracking-tight text-slate-50 drop-shadow-[0_0_10px_rgba(0,0,0,0.9)]">
                {entry.username}
              </h2>
            </div>
          </div>
        </div>

        {/* Body: left main page + optional username history page */}
        <div className="px-6 pb-6 pt-10">
          <div className="flex flex-col gap-4">
            {/* Main section: render + hypixel/meta grid */}
            <div className="flex-1 space-y-4">
              <div className="flex flex-col gap-4 md:grid md:grid-cols-[minmax(0,1fr)_minmax(0,2fr)] md:items-stretch">
                <Card className="flex-shrink-0 bg-black/80 border border-white/15 shadow-sm">
                  <CardContent className="flex flex-col items-center px-4 pb-3 pt-4">
                    <div className="rounded-lg border border-white/10 bg-slate-900/90 p-2">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={imgSrc}
                        alt={`${entry.username} full skin`}
                        className="h-56 w-auto object-contain"
                        onError={() => setImgError(true)}
                      />
                    </div>
                    <div className="mt-2 text-[11px] text-slate-400">
                      Last updated:{" "}
                      <span className="font-medium text-slate-200">
                        {entry.lastUpdated ? new Date(entry.lastUpdated).toLocaleString() : "Unknown"}
                      </span>
                    </div>
                  </CardContent>
                </Card>

                <div className="flex min-w-0 flex-1 flex-col gap-3">
                  {/* Rank / guild + votes row */}
                  <div className="grid gap-3 md:grid-cols-[minmax(0,2fr)_minmax(0,1.2fr)]">
                    <div className="rounded-lg border border-white/15 bg-slate-950/90 p-3 text-xs shadow-sm">
                      <div className="mb-2 flex flex-wrap items-center gap-2">
                        <span className="text-[11px] uppercase tracking-wide text-slate-400">Hypixel Rank:</span>
                        <span
                          className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${rankClass(entry.rank)}`}
                        >
                          {entry.rank || "Unknown"}
                        </span>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-[11px] uppercase tracking-wide text-slate-400">Hypixel Guild:</span>
                        <span
                          className="rounded-full px-2.5 py-0.5 text-[11px] font-semibold"
                          style={{ backgroundColor: guildColor }}
                        >
                          {entry.guild || "No guild"}
                        </span>
                      </div>
                    </div>

                    <div className="rounded-lg border border-white/15 bg-black/90 p-3 text-xs shadow-sm flex flex-col justify-between">
                      <div className="mb-1 text-[11px] uppercase tracking-wide text-slate-300">Votes</div>
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex flex-col">
                          <span className="text-2xl font-semibold text-slate-50 leading-none">{entry.voteScore ?? 0}</span>
                          <span className="mt-1 text-[10px] uppercase tracking-wide text-slate-400">Total votes</span>
                        </div>
                        <div className="flex gap-1.5">
                          <form action={voteOnEntry} className="inline-flex">
                            <input type="hidden" name="entryUuid" value={entry.uuid} />
                            <input type="hidden" name="direction" value="up" />
                            <button
                              type="submit"
                              className={`inline-flex h-8 w-8 items-center justify-center rounded-full border text-xs font-semibold transition ${
                                entry.userVote === 1
                                  ? "border-emerald-400/70 bg-emerald-500/25 text-emerald-100 shadow-sm"
                                  : "border-white/20 bg-slate-950/60 text-slate-100 hover:border-white/40 hover:bg-slate-800/80"
                              }`}
                              aria-label="Upvote entry"
                            >
                              <ArrowUp className="h-3.5 w-3.5" />
                            </button>
                          </form>
                          <form action={voteOnEntry} className="inline-flex">
                            <input type="hidden" name="entryUuid" value={entry.uuid} />
                            <input type="hidden" name="direction" value="down" />
                            <button
                              type="submit"
                              className={`inline-flex h-8 w-8 items-center justify-center rounded-full border text-xs font-semibold transition ${
                                entry.userVote === -1
                                  ? "border-rose-400/70 bg-rose-500/25 text-rose-100 shadow-sm"
                                  : "border-white/20 bg-slate-950/60 text-slate-100 hover:border-white/40 hover:bg-slate-800/80"
                              }`}
                              aria-label="Downvote entry"
                            >
                              <ArrowDown className="h-3.5 w-3.5" />
                            </button>
                          </form>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Status + flags row */}
                  <div className="grid gap-3 md:grid-cols-2">
                    <div className="rounded-lg border border-white/15 bg-slate-950/90 p-3 text-xs shadow-sm">
                      <div className="mb-1 text-[11px] uppercase tracking-wide text-slate-300">Status</div>
                      <div className="flex flex-wrap gap-1.5">
                        <span
                          className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${statusTone(
                            entry.status,
                          )}`}
                        >
                          {entry.status || "Not set"}
                        </span>
                      </div>
                    </div>

                    <div className="rounded-lg border border-white/15 bg-slate-950/90 p-3 text-xs shadow-sm">
                      <div className="mb-1 text-[11px] uppercase tracking-wide text-slate-300">Cheating & behavior tags</div>
                      <div className="flex flex-wrap gap-1.5">
                        {(entry.typeOfCheating ?? []).map((t, i) => (
                          <span
                            key={`tc-modal-${i}`}
                            className="rounded-full bg-slate-700/80 px-2 py-0.5 text-[11px] text-white"
                          >
                            {t}
                          </span>
                        ))}
                        {(entry.redFlags ?? []).map((t, i) => (
                          <span
                            key={`rf-modal-${i}`}
                            className="rounded-full bg-rose-800/80 px-2 py-0.5 text-[11px] text-rose-50"
                          >
                            {t}
                          </span>
                        ))}
                        {!((entry.typeOfCheating && entry.typeOfCheating.length) || (entry.redFlags && entry.redFlags.length)) && (
                          <span className="text-[11px] text-slate-500">No flags recorded</span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="rounded-lg border border-white/15 bg-slate-950/90 p-3 text-xs shadow-sm">
                    <div className="mb-1 text-[11px] uppercase tracking-wide text-slate-300">Notes / Evidence</div>
                    <div className="max-h-40 whitespace-pre-line text-[12px] text-slate-200 md:max-h-48 md:overflow-y-auto">
                      {entry.notesEvidence?.trim() ? (
                        entry.notesEvidence
                      ) : (
                        <span className="text-slate-500">No notes yet</span>
                      )}
                    </div>
                  </div>

                  <div className="mt-1 flex flex-col gap-2 text-[11px] text-slate-300">
                    <div>
                      UUID:{" "}
                      <code className="rounded bg-slate-900/90 px-1.5 py-0.5 text-[11px] text-slate-200">
                        {entry.uuid}
                      </code>
                    </div>
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          onClick={handleCopyUuid}
                          className="inline-flex items-center gap-1 rounded-full border border-amber-400/80 bg-[#ff7a1a] px-3 py-1 text-[11px] font-semibold text-black shadow-sm hover:bg-[#ff9a3a] hover:border-amber-300"
                        >
                          <Copy className="h-3.5 w-3.5" />
                          <span>{copied ? "Copied" : "Copy UUID"}</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setShowHistory((v) => !v)}
                          className="inline-flex items-center gap-1 rounded-full border border-pink-500/80 bg-[#b0144f] px-3 py-1 text-[11px] font-semibold text-white shadow-sm hover:bg-[#d51a63] hover:border-pink-300"
                        >
                          Username history
                        </button>
                        <a
                          href={`https://namemc.com/profile/${encodeURIComponent(entry.uuid)}`}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 rounded-full border border-sky-400/80 bg-sky-600 px-3 py-1 text-[11px] font-semibold text-white shadow-sm hover:bg-sky-500 hover:border-sky-300"
                        >
                          <span>NameMC</span>
                        </a>
                      </div>
                    </div>
                  </div>

                  {canEdit && (
                    <form
                      action={upsertEntry}
                      className="mt-3 rounded-lg border border-emerald-500/40 bg-emerald-950/60 p-4 text-xs space-y-3"
                    >
                      <input type="hidden" name="targetUuid" value={entry.uuid} />
                      <input type="hidden" name="uuid" value={entry.uuid} />
                      <input type="hidden" name="username" value={entry.username} />
                      <input type="hidden" name="guild" value={entry.guild ?? ""} />
                      <input type="hidden" name="rank" value={entry.rank ?? ""} />
                      {(entry.typeOfCheating ?? []).map((t, i) => (
                        <input key={`tc-modal-edit-${i}`} type="hidden" name="typeOfCheating" value={t} />
                      ))}
                      {(entry.redFlags ?? []).map((t, i) => (
                        <input key={`rf-modal-edit-${i}`} type="hidden" name="redFlags" value={t} />
                      ))}

                      <div className="grid gap-3 md:grid-cols-3">
                        <label className="flex flex-col gap-1">
                          <span className="text-[10px] uppercase tracking-wide text-emerald-200/80">Status</span>
                          <input
                            name="status"
                            defaultValue={entry.status ?? ""}
                            className="rounded border border-emerald-500/60 bg-emerald-950/80 px-2 py-1 text-emerald-50 placeholder:text-emerald-100/40"
                            placeholder="Status"
                          />
                        </label>

                        <label className="flex flex-col gap-1">
                          <span className="text-[10px] uppercase tracking-wide text-emerald-200/80">Confidence (0–5)</span>
                          <input
                            name="confidenceScore"
                            type="number"
                            min={0}
                            max={5}
                            defaultValue={entry.confidenceScore ?? ""}
                            className="rounded border border-emerald-500/60 bg-emerald-950/80 px-2 py-1 text-emerald-50"
                          />
                        </label>

                        <label className="flex flex-col gap-1">
                          <span className="text-[10px] uppercase tracking-wide text-emerald-200/80">Reviewer</span>
                          <input
                            name="reviewedBy"
                            defaultValue={entry.reviewedBy ?? ""}
                            className="rounded border border-emerald-500/60 bg-emerald-950/80 px-2 py-1 text-emerald-50"
                            placeholder="Reviewed by"
                          />
                        </label>
                      </div>

                      <label className="flex flex-col gap-1">
                        <span className="text-[10px] uppercase tracking-wide text-emerald-200/80">Notes / Evidence</span>
                        <textarea
                          name="notesEvidence"
                          defaultValue={entry.notesEvidence ?? ""}
                          rows={3}
                          className="w-full resize-none rounded border border-emerald-500/60 bg-emerald-950/80 px-2 py-1 text-emerald-50"
                        />
                      </label>

                      <div className="flex justify-end gap-2">
                        <button
                          type="submit"
                          className="inline-flex items-center gap-1 rounded-full border border-emerald-400/80 bg-emerald-400 px-3 py-1 text-[11px] font-semibold text-black shadow-sm hover:bg-emerald-300 hover:border-emerald-200"
                        >
                          Save changes
                        </button>
                      </div>
                    </form>
                  )}

                  <div className="mt-3 rounded-lg border border-dashed border-white/20 bg-slate-950/95 p-4 text-xs">
                    <div className="mb-2 flex items-center justify-between gap-2">
                      <h3 className="text-sm font-semibold">Username history</h3>
            {showHistory && (
              <div className="mt-3 rounded-lg border border-dashed border-white/20 bg-slate-950/95 p-4 text-xs">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <h3 className="text-sm font-semibold">Username history</h3>
                  <button
                    type="button"
                    onClick={() => setShowHistory(false)}
                    className="text-[11px] text-slate-400 hover:text-slate-200"
                  >
                    Close panel
                  </button>
                </div>
                <Separator className="mb-3 bg-white/10" />

                {hasHistory ? (
                  <div className="space-y-2">
                    <div className="rounded border border-emerald-500/40 bg-emerald-950/60 px-2.5 py-1.5 text-[11px] text-emerald-50">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-semibold">Current</span>
                        <span className="text-[10px] uppercase tracking-wide text-emerald-200/80">Active</span>
                      </div>
                      <div className="mt-0.5 font-mono text-[12px]">{entry.username}</div>
                    </div>

                    {entry.usernameHistory!.map((h, i) => (
                      <div
                        key={`${h.username}-${i}`}
                        className="rounded border border-white/10 bg-slate-950/80 px-2.5 py-1.5 text-[11px]"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-semibold">Previous</span>
                          <span className="text-[10px] uppercase tracking-wide text-slate-400">
                            {new Date(h.changedAt).toLocaleString()}
                          </span>
                        </div>
                        <div className="mt-0.5 font-mono text-[12px]">{h.username}</div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="rounded border border-dashed border-white/20 bg-slate-950/80 px-3 py-4 text-[12px] text-slate-300">
                    <p className="mb-1 font-medium">No username changes recently.</p>
                    <p className="text-[11px] text-slate-400">
                      We haven't recorded any previous usernames for this player yet.
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* Footer meta */}
            <div className="mt-4 flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-300">
              <div>
                Reviewed by{" "}
                <span className="font-medium text-slate-100">{entry.reviewedBy || "Unassigned"}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-slate-400">Confidence</span>
                <Stars n={entry.confidenceScore ?? 0} />
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

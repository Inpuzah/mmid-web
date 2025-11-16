"use client";

import React, { useMemo, useState, useRef, useCallback } from "react";
import { GroupedVirtuoso, type VirtuosoHandle } from "react-virtuoso";

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { ArrowDown, ArrowUp, Star } from "lucide-react"; // if you don't use X/Copy elsewhere, drop them
import { Dialog, DialogContent } from "@/components/ui/dialog";
import * as DialogPrimitive from "@radix-ui/react-dialog";

import { Card, CardContent } from "@/components/ui/card";
import { voteOnEntry } from "../actions";

/* ---------------------------------------------
   Config
---------------------------------------------- */
// Replace this with your asset path (public/… or a CDN URL)
const BG_IMAGE = "https://external-content.duckduckgo.com/iu/?u=https%3A%2F%2Fi.pinimg.com%2Foriginals%2Fea%2F00%2F0c%2Fea000cc6fb9375b14a7b21d55dcf9745.jpg&f=1&nofb=1&ipt=28986ad446f22f0ccb779adbd6fb94d95c92f99344e60ec7bfc44a9cd08336c0";

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
function EntryCard({
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
        className="
          fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2
          z-[100] w-[min(96vw,48rem)] max-h-[85vh]
          p-0 overflow-hidden rounded-2xl
          border border-white/10 bg-slate-900/85 backdrop-blur-xl shadow-2xl
        "
      >
        {/* Close (Radix) */}
        <DialogPrimitive.Close asChild>
          <button
            aria-label="Close"
            className="
              absolute right-3 top-3 z-50
              h-9 w-9 rounded-lg grid place-items-center
              bg-white/10 hover:bg-white/15 border border-white/15
              text-white/90 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/60
            "
          >
            <span className="text-xl leading-none">×</span>
          </button>
        </DialogPrimitive.Close>

        {/* BODY ONLY — no header bar */}
        <div className="px-6 pt-6 pb-6 overflow-y-auto max-h-[85vh]">
          <div className="grid grid-cols-[8.5rem,1fr]">
            {/* render */}
            <div className="row-start-1 col-start-1 pr-1">
              <div className="rounded-2xl bg-slate-800/40 ring-2 ring-white/10 p-1 w-[8.5rem]">
                <img
                  src={`https://crafatar.com/renders/body/${entry.uuid}?overlay&scale=10&default=MHF_Steve`}
                  alt={entry.username}
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
                <span className="text-slate-400">Rank:</span>
                {entry.rank ? (
                  <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${rankClass(entry.rank)}`}>
                    {entry.rank}
                  </span>
                ) : (
                  <span className="text-slate-300">—</span>
                )}
              </div>

              <div className="mt-2 flex items-center gap-2 text-sm">
                <span className="text-slate-400">Guild:</span>
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

            {/* meta BELOW render */}
            <div className="row-start-2 col-start-1 mt-4 space-y-1.5 text-[13px] text-slate-300">
              <div>
                <span className="text-slate-400">Reviewed by:</span>{" "}
                <span className="text-slate-100">{entry.reviewedBy ?? "N/A"}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-slate-400">Confidence score:</span>
                <span className="inline-flex items-center gap-1">
                  <Stars n={entry.confidenceScore ?? 0} />
                </span>
              </div>
            </div>
          </div>

          {/* SECTIONS */}
          <div className="mt-6 grid gap-5 md:grid-cols-2">
            {hasStatus && (
              <Card className="bg-white/[0.05] border-white/10 rounded-2xl">
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
              <Card className="bg-white/[0.05] border-white/10 rounded-2xl">
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
            <Card className="bg-white/[0.05] border-white/10 rounded-2xl mt-5">
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
export default function MMIDFullWidthCardList({ rows }: { rows: MmidRow[] }) {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState<MmidRow | null>(null);
  const virtuosoRef = useRef<VirtuosoHandle>(null);

  // search/filter
  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return rows;
    return rows.filter((r) =>
      [
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
        .includes(s)
    );
  }, [rows, q]);

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
    <div className="relative min-h-[100dvh] w-full text-white">
      {/* Background image under everything */}
      <div className="fixed inset-0 -z-20">
        {/* base color (safety) */}
        <div className="absolute inset-0 bg-slate-900" />
        {/* image */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={BG_IMAGE}
          alt=""
          className="absolute inset-0 h-full w-full object-cover opacity-40"
        />
      </div>
      {/* soft overlays for readability */}
      <div className="fixed inset-0 -z-10 bg-gradient-to-b from-slate-950/60 via-slate-950/50 to-slate-950/60" />
      <div className="fixed inset-0 -z-10 bg-[radial-gradient(ellipse_at_top,_rgba(255,255,255,0.08),_transparent_60%)]" />

      <div className="mx-auto max-w-6xl px-4 py-8">
        <header className="mb-4 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
          <h1 className="text-2xl font-semibold tracking-tight">MMID Directory</h1>
          <div className="flex items-center gap-2">
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search username, guild, rank, status…"
              className="bg-white/10 border-white/10 text-white placeholder:text-white/60 w-72"
            />
            <Button
              variant="secondary"
              className="bg-white/10 border-white/10 text-white"
              onClick={() => setQ("")}
            >
              Reset
            </Button>
          </div>
        </header>

        {/* taller list so rail fits more often */}
        <div className="h-[86vh] rounded-2xl ring-1 ring-white/10 bg-white/5 backdrop-blur overflow-hidden relative">
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

              return (
                <div className="px-4 pr-24 md:pr-28">
                  <button
                    onClick={() => { setActive(e); setOpen(true); }}
                    className="w-full text-left"
                    aria-label={`Open ${e.username}`}
                  >
                    <div className="w-full rounded-2xl border border-white/10 bg-white/[0.04] hover:bg-white/[0.06] transition shadow-sm">
                      <div className="flex items-center gap-4 p-4">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={`https://crafatar.com/renders/body/${e.uuid}?overlay&scale=6&default=MHF_Steve`}
                          alt={e.username}
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
                            {e.guild && (
                              <span
                                className="px-2 py-0.5 rounded-full text-xs font-semibold"
                                style={{ background: e.guildColor || stringToHsl(e.guild), color: "#111" }}
                              >
                                {e.guild}
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="hidden md:block">
                          <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${statusTone(e.status)}`}>
                            {e.status ?? "—"}
                          </span>
                        </div>
                        <div className="w-[36%] hidden lg:block">
                          <div className="flex flex-wrap gap-1.5 justify-end">
                            {(e.typeOfCheating ?? []).slice(0, 3).map((t, i) => (
                              <span key={`tc-${i}`} className="px-2 py-0.5 rounded-full text-[11px] bg-slate-700/70 text-white">
                                {t}
                              </span>
                            ))}
                            {(e.redFlags ?? []).slice(0, 3).map((t, i) => (
                              <span key={`rf-${i}`} className="px-2 py-0.5 rounded-full text-[11px] bg-slate-700/70 text-white">
                                {t}
                              </span>
                            ))}
                          </div>
                        </div>
                      </div>

                      <Separator className="bg-white/10" />
                      <div className="flex items-center justify-between p-3 text-xs text-white/70">
                        <span>Reviewed by {e.reviewedBy ?? "N/A"}</span>
                        <div className="flex items-center gap-3">
                          <Stars n={e.confidenceScore ?? 0} />
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
                <div className="backdrop-blur-md bg-slate-900/60 border border-white/10 rounded-2xl px-2 py-2 shadow-lg">
                  {[...LETTERS, "#"].map((L) => {
                    const present = lettersPresent.has(L);
                    return (
                      <button
                        key={L}
                        onClick={() => present && jumpTo(L)}
                        className={
                          "w-10 h-10 rounded-lg text-sm font-semibold flex items-center justify-center transition " +
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

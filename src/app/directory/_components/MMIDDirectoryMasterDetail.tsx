"use client";

import React, { useMemo, useState, useRef, useEffect, useCallback } from "react";
import { GroupedVirtuoso, type VirtuosoHandle } from "react-virtuoso";

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Card, CardContent } from "@/components/ui/card";
import MinecraftSkin from "@/components/MinecraftSkin";
import {
  ArrowDown,
  ArrowUp,
  Copy,
  Filter,
  ShieldQuestion,
  Star,
  Pencil,
  RefreshCw,
  FileText,
  ExternalLink,
  Check,
  ChevronLeft,
  ChevronRight,
  ArrowRight,
} from "lucide-react";

import { voteOnEntry, markEntryNeedsReview, checkHypixelData } from "../actions";
import { upsertEntry } from "../../entries/new/actions";
import type { DirectoryMmStats } from "@/lib/hypixel-player-stats";
import type { MmidRow as BaseMmidRow } from "./MMIDFullWidthCardList";

// Re-export the row type locally so this component can be used from the page.
export type MmidRow = BaseMmidRow;

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
   Status / visual helpers
---------------------------------------------- */

export type StatusFilter = "all" | "legit" | "cheating" | "needs-review" | "unverified";

type SearchMode = "smart" | "player" | "uuid" | "guild" | "tags";

const STATUS_FILTERS: { value: StatusFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "legit", label: "Legit / Cleared" },
  { value: "cheating", label: "Cheating / Flagged" },
  { value: "needs-review", label: "Needs review" },
  { value: "unverified", label: "Unverified" },
];

// Option sets used when editing a single entry in the detail panel.
// Align these with the main directory statuses so terminology matches.
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

function behaviorTagTone(label?: string | null) {
  const v = (label ?? "").toLowerCase();
  if (!v) return "bg-slate-700/80 text-slate-50";

  if (v.includes("generally nice") || v.includes("nice person") || v.includes("whitelisted")) {
    return "bg-emerald-600/90 text-white";
  }
  if (v.includes("inconclusive") || v.includes("unverified") || v.includes("other (please describe)")) {
    return "bg-amber-500/90 text-black";
  }
  if (v.includes("previously banned") || v.includes("ban history") || v.includes("alt account")) {
    return "bg-orange-500/90 text-black";
  }
  if (
    v.includes("harasses") ||
    v.includes("dox") ||
    v.includes("doxx") ||
    v.includes("catfish") ||
    v.includes("beamer") ||
    v.includes("beam")
  ) {
    return "bg-rose-600/90 text-white";
  }
  if (v.includes("pedo") || v.includes("pedophile") || v.includes("groom")) {
    return "bg-rose-900 text-rose-50 border border-rose-500/80";
  }
  return "bg-slate-700/80 text-slate-50";
}

function stringToHsl(name: string, s = 65, l = 55) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  const h = Math.abs(hash) % 360;
  return `hsl(${h} ${s}% ${l}%)`;
}

function hypixelColorToCss(color?: string | null) {
  const v = (color ?? "").toUpperCase();
  switch (v) {
    case "DARK_GREEN":
      return "#008A00";
    case "GREEN":
      return "#55FF55";
    case "DARK_RED":
      return "#AA0000";
    case "RED":
      return "#FF5555";
    case "GOLD":
      return "#FFAA00";
    case "YELLOW":
      return "#FFFF55";
    case "DARK_AQUA":
      return "#00AAAA";
    case "AQUA":
      return "#55FFFF";
    case "DARK_BLUE":
      return "#0000AA";
    case "BLUE":
      return "#5555FF";
    case "LIGHT_PURPLE":
      return "#FF55FF";
    case "DARK_PURPLE":
      return "#AA00AA";
    case "WHITE":
      return "#FFFFFF";
    case "GRAY":
    case "DARK_GRAY":
      return "#AAAAAA";
    default:
      return null;
  }
}

function rankTextClass(rank?: string | null) {
  const r = (rank ?? "").toUpperCase();
  if (r.includes("MVP++")) return "text-amber-300";
  if (r.includes("MVP+")) return "text-cyan-300";
  if (r.includes("MVP")) return "text-sky-300";
  if (r.includes("VIP+")) return "text-lime-300";
  if (r.includes("VIP")) return "text-green-300";
  return "text-slate-50";
}

function plusColorToClass(c?: string | null) {
  const v = (c ?? "").toUpperCase();
  switch (v) {
    case "RED":
      return "text-red-400";
    case "GOLD":
      return "text-amber-300";
    case "GREEN":
      return "text-green-400";
    case "YELLOW":
      return "text-yellow-300";
    case "LIGHT_PURPLE":
      return "text-fuchsia-300";
    case "WHITE":
      return "text-slate-50";
    case "BLUE":
      return "text-blue-400";
    case "DARK_GREEN":
      return "text-emerald-400";
    case "DARK_RED":
      return "text-red-600";
    case "DARK_AQUA":
      return "text-cyan-400";
    case "DARK_BLUE":
      return "text-blue-400";
    case "DARK_GRAY":
      return "text-slate-500";
    case "BLACK":
      return "text-black";
    default:
      return "text-cyan-300";
  }
}

function prettyKnifeName(id?: string | null) {
  if (!id) return "Unknown";
  // Hypixel uses ids like "knife_skin_shears" – trim prefix and prettify.
  const raw = id.replace(/^knife_skin_/, "");
  return raw
    .split(/[_-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function Stars({
  n = 0,
  editable = false,
  onChange,
}: {
  n?: number | null;
  editable?: boolean;
  onChange?: (value: number) => void;
}) {
  const v = Math.max(0, Math.min(5, Number(n ?? 0)));

  const handleClick = (value: number) => {
    if (!editable || !onChange) return;
    onChange(value);
  };

  return (
    <span className="inline-flex items-center gap-0.5" aria-label={`${v}/5`}>
      {Array.from({ length: 5 }).map((_, i) => {
        const filled = i < v;
        if (!editable) {
          return (
            <Star
              key={i}
              className={`h-4 w-4 ${filled ? "fill-yellow-400" : "fill-transparent"} stroke-yellow-400`}
            />
          );
        }
        return (
          <button
            key={i}
            type="button"
            onClick={() => handleClick(i + 1)}
            className="m-0 cursor-pointer border-0 bg-transparent p-0"
          >
            <Star
              className={`h-4 w-4 ${filled ? "fill-yellow-400" : "fill-transparent"} stroke-yellow-400`}
            />
          </button>
        );
      })}
    </span>
  );
}

// Custom scroller for the right-hand directory list. Hides the native
// scrollbar while keeping wheel/trackpad scrolling, and styles the thumb
// to better match the UI.
const DirectoryScroller = React.forwardRef<HTMLDivElement, React.ComponentPropsWithoutRef<"div">>(
  function DirectoryScroller({ className, ...props }, ref) {
    return (
      <div
        ref={ref}
        className={`no-scrollbar scrollbar-thin scrollbar-thumb-slate-700/80 scrollbar-track-slate-950/80 ${
          className ?? ""
        }`}
        {...props}
      />
    );
  },
);

/* ---------------------------------------------
   Entry detail panel (left side)
---------------------------------------------- */

type EntryDetailPanelProps = {
  entry: MmidRow | null;
  canEdit: boolean;
  currentUserName?: string | null;
};

function EntryDetailPanel({ entry, canEdit, currentUserName }: EntryDetailPanelProps) {
  const cardRef = useRef<HTMLDivElement | null>(null);
  const [imgError, setImgError] = useState(false);
  const [copied, setCopied] = useState(false);
  const [copyFormat, setCopyFormat] = useState<"dashed" | "plain">("dashed");
  const [editMode, setEditMode] = useState(false);
  const [editConfidence, setEditConfidence] = useState<number>(entry?.confidenceScore ?? 0);
  const [showAttachments, setShowAttachments] = useState(false);
  const [statsTab, setStatsTab] = useState<"overall" | "classic" | "double" | "assassins" | "infection">(
    "overall",
  );
  const [showAllSkins, setShowAllSkins] = useState(false);
  const [showAllCapes, setShowAllCapes] = useState(false);

  useEffect(() => {
    setImgError(false);
    setCopied(false);
    setCopyFormat("dashed");
    setEditMode(false);
    setEditConfidence(entry?.confidenceScore ?? 0);
    setShowAttachments(false);
    setStatsTab("overall");
    setShowAllSkins(false);
    setShowAllCapes(false);
  }, [entry?.uuid, entry?.confidenceScore]);

  if (!entry) {
    return (
      <div className="flex h-full items-center justify-center rounded-lg border border-dashed border-white/10 bg-slate-950/70 p-6 text-sm text-slate-300">
        Select a player from the MMID Directory on the right.
      </div>
    );
  }

  const uuidPlain = entry.uuid.replace(/-/g, "");
  const uuidDashed =
    uuidPlain.length === 32
      ? `${uuidPlain.slice(0, 8)}-${uuidPlain.slice(8, 12)}-${uuidPlain.slice(12, 16)}-${uuidPlain.slice(16, 20)}-${uuidPlain.slice(20)}`
      : entry.uuid;

  const copyValue = copyFormat === "plain" ? uuidPlain : uuidDashed;

  const fullBodyPrimary = `https://visage.surgeplay.com/full/256/${uuidPlain}.png`;
  const fullBodyFallback = `https://mc-heads.net/body/${uuidPlain}/256`;
  const imgSrc = imgError ? fullBodyFallback : fullBodyPrimary;

  const stats: DirectoryMmStats | null = entry.hypixelStats?.mmStats ?? null;

  const guildColor =
    entry.guild && stats?.guildColor
      ? hypixelColorToCss(stats.guildColor) ?? stringToHsl(entry.guild)
      : stringToHsl(entry.guild ?? "Guild");

  const skinHistory = entry.skinHistory ?? [];
  const mojangCapeHistory = entry.mojangCapeHistory ?? [];
  const optifineCapeHistory = entry.optifineCapeHistory ?? [];

  const formatNum = (v: number | null | undefined) => (v == null ? "-" : v.toLocaleString("en-US"));
  const formatKdr = (v: number | null | undefined) => (v == null ? "-" : v.toFixed(2));
  const formatDate = (ms: number | null | undefined) =>
    ms == null ? "-" : new Date(ms).toLocaleString();

  const formatLastSeen = (ms: number | null | undefined) => {
    if (ms == null) return "-";
    const now = Date.now();
    const diff = now - ms;
    if (diff <= 0) return "just now";
    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    if (days > 0) return `${days} day${days === 1 ? "" : "s"} ago`;
    if (hours > 0) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
    if (minutes > 0) return `${minutes} minute${minutes === 1 ? "" : "s"} ago`;
    return `${seconds} second${seconds === 1 ? "" : "s"} ago`;
  };

  const handleCopyValue = async () => {
    try {
      await navigator.clipboard.writeText(copyValue);
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } catch {
      // ignore
    }
  };

  const handleCopyCardImage = async () => {
    if (!cardRef.current) return;
    try {
      const htmlToImage = await import("html-to-image");
      const blob = await htmlToImage.toBlob(cardRef.current, { pixelRatio: 2 });
      if (!blob) return;

      if (navigator.clipboard && (navigator.clipboard as any).write) {
        await (navigator.clipboard as any).write([
          new ClipboardItem({ "image/png": blob }),
        ]);
      } else {
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `${entry.username}-mmid-card.png`;
        a.click();
        URL.revokeObjectURL(url);
      }
    } catch (err) {
      console.error("Failed to copy card image", err);
    }
  };

  const handleDownloadCardImage = async () => {
    if (!cardRef.current) return;
    try {
      const htmlToImage = await import("html-to-image");
      const blob = await htmlToImage.toBlob(cardRef.current, { pixelRatio: 2 });
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${entry.username}-mmid-card.png`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Failed to download card image", err);
    }
  };

  const hasHistory = Array.isArray(entry.usernameHistory) && entry.usernameHistory.length > 0;

  // Notes + attachment parsing (stored in a single notesEvidence field).
  const rawNotes = entry.notesEvidence ?? "";
  const attachmentMarker = "\n---ATTACHMENTS---\n";
  let notesSection = rawNotes;
  let attachmentsSection = "";
  const markerIndex = rawNotes.indexOf(attachmentMarker);
  if (markerIndex !== -1) {
    notesSection = rawNotes.slice(0, markerIndex);
    attachmentsSection = rawNotes.slice(markerIndex + attachmentMarker.length);
  }
  const attachmentLines = attachmentsSection
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  // Build option sets that always include any existing values, so we don't
  // accidentally drop tags that aren't in the default option lists.
  const cheatingOptions = Array.from(
    new Set([...(entry.typeOfCheating ?? []), ...CHEATING_OPTIONS]),
  );
  const behaviorOptions = Array.from(new Set([...(entry.redFlags ?? []), ...REDFLAG_OPTIONS]));

  return (
    <div ref={cardRef} className="flex h-full flex-col gap-4">
      {/* Header: player name, rank, guild, votes */}
      <div className="flex flex-col gap-1">
        <div className="flex flex-wrap items-center justify-between gap-2 text-xl font-semibold">
          <div className="flex flex-wrap items-center gap-2">
          {/* Rank prefix with coloured + if available */}
          {entry.rank && (
            <span className={`font-mono text-[15px] ${rankTextClass(entry.rank)}`}>
              [
              {entry.rank.startsWith("MVP") ? "MVP" : entry.rank.startsWith("VIP") ? "VIP" : entry.rank}
              {entry.rank.includes("+") && (
                <>
                  <span className={plusColorToClass(stats?.rankPlusColor)}>+</span>
                  {entry.rank.includes("++") && (
                    <span className={plusColorToClass(stats?.rankPlusColor)}>+</span>
                  )}
                </>
              )}
              ]
            </span>
          )}
          <span className={`text-2xl md:text-3xl ${rankTextClass(entry.rank)}`}>{entry.username}</span>
          {stats?.guildTag && (
            <span className="font-mono text-xs rounded-full border border-emerald-500/70 bg-emerald-500/20 px-2 py-0.5 text-emerald-200">
              [{stats.guildTag}]
            </span>
          )}
          </div>
          <div className="flex items-center gap-1 text-xs text-slate-400">
            <span>Votes:</span>
            <span className="text-lg font-semibold text-slate-50">{entry.voteScore ?? 0}</span>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3 text-sm text-slate-300">
          <span>
            Guild: {" "}
            <span
              className="rounded-full px-2 py-0.5 text-xs font-semibold"
              style={{ backgroundColor: guildColor }}
            >
              {entry.guild || "No guild"}
            </span>
          </span>
        </div>

        {stats && (
          <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-slate-300">
            <span>
              Network level:{" "}
              <span className="font-semibold text-emerald-200">
                {stats.networkLevel != null ? stats.networkLevel.toFixed(2) : "-"}
              </span>
            </span>
            <span>
              Achievement points:{" "}
              <span className="font-semibold text-sky-200">
                {formatNum(stats.achievementPoints)}
              </span>
            </span>
            <span>
              Karma:{" "}
              <span className="font-semibold text-violet-200">
                {formatNum(stats.karma)}
              </span>
            </span>
          </div>
        )}
      </div>

      {canEdit && (
        <div className="flex items-center justify-between rounded-md border border-amber-500/40 bg-amber-950/60 px-3 py-1.5 text-[11px] text-amber-50">
          <div className="flex items-center gap-1">
            <Pencil className="h-3.5 w-3.5" />
            <span className="uppercase tracking-wide">Maintainer edit tools</span>
          </div>
          <button
            type="button"
            onClick={() => setEditMode((v) => !v)}
            className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide transition ${
              editMode
                ? "border-amber-200 bg-amber-300 text-slate-950 shadow-sm"
                : "border-amber-500/70 bg-transparent text-amber-100 hover:bg-amber-500/10"
            }`}
          >
            {editMode ? "Editing" : "View only"}
          </button>
        </div>
      )}

      {/* Middle row: skin render + MM stats */}
      <div className="grid gap-4 md:grid-cols-[minmax(0,1.1fr)_minmax(0,1.9fr)] md:items-stretch">
        <Card className="flex-shrink-0 border-0 bg-transparent shadow-none">
          <CardContent className="flex h-full flex-col items-center px-0 pb-0 pt-0">
            <div className="flex w-full flex-col items-center rounded-2xl bg-slate-950/80 pb-3 pt-4 shadow-[0_0_40px_rgba(0,0,0,0.85)]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={imgSrc}
                alt={`${entry.username} full skin`}
                className="h-72 w-auto object-contain"
                onError={() => setImgError(true)}
              />
              {stats && (
                <div className="mt-3 text-center text-[11px] text-slate-400 space-y-0.5">
                  <div>
                    First login:{" "}
                    <span className="font-medium text-slate-200">
                      {formatDate(stats.firstLogin)}
                    </span>
                  </div>
                  <div>
                    Last seen:{" "}
                    <span className="font-medium text-slate-200">
                      {formatLastSeen(stats.lastLogin)}
                    </span>
                  </div>
                </div>
              )}

              {skinHistory.length > 0 || mojangCapeHistory.length > 0 || optifineCapeHistory.length > 0 ? (
                <div className="mt-4 w-full space-y-3 px-4 pb-1">
                  {skinHistory.length > 0 && (
                    <div>
                      <div className="mb-1 flex items-center justify-between gap-2">
                        <span className="text-[11px] uppercase tracking-wide text-slate-300">
                          Skin history (cached)
                        </span>
                        {skinHistory.length > 12 && (
                          <button
                            type="button"
                            onClick={() => setShowAllSkins((v) => !v)}
                            className="inline-flex items-center gap-1 rounded-full border border-slate-600 bg-slate-900/80 px-2 py-0.5 text-[10px] text-slate-200 hover:border-amber-400/70 hover:text-amber-100"
                          >
                            <span>{showAllSkins ? "Show less" : "See more"}</span>
                            <ArrowRight
                              className={`h-3 w-3 transition-transform ${showAllSkins ? "rotate-90" : ""}`}
                            />
                          </button>
                        )}
                      </div>
                      <div className="grid grid-cols-6 gap-1.5">
                        {skinHistory
                          .slice(0, showAllSkins ? skinHistory.length : 11)
                          .map((item, idx) => (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              key={`${item.url}-${idx}`}
                              src={item.url}
                              alt={`Skin snapshot ${idx + 1}`}
                              className="h-11 w-11 rounded-md border border-slate-800 bg-slate-900 object-cover"
                              loading="lazy"
                              decoding="async"
                            />
                          ))}
                        {skinHistory.length > (showAllSkins ? skinHistory.length : 11) && (
                          <button
                            type="button"
                            onClick={() => setShowAllSkins(true)}
                            className="flex h-11 w-11 items-center justify-center rounded-md border border-dashed border-slate-700 bg-slate-900/80 text-[11px] text-slate-300 hover:border-amber-400/70 hover:text-amber-100"
                            aria-label="Show more skin history"
                          >
                            <ArrowRight className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  )}

                  {(optifineCapeHistory.length > 0 || mojangCapeHistory.length > 0) && (
                    <div>
                      <div className="mb-1 flex items-center justify-between gap-2">
                        <span className="text-[11px] uppercase tracking-wide text-slate-300">
                          Cape history (OptiFine + Minecraft)
                        </span>
                        {(mojangCapeHistory.length > 4 || optifineCapeHistory.length > 1) && (
                          <button
                            type="button"
                            onClick={() => setShowAllCapes((v) => !v)}
                            className="inline-flex items-center gap-1 rounded-full border border-slate-600 bg-slate-900/80 px-2 py-0.5 text-[10px] text-slate-200 hover:border-amber-400/70 hover:text-amber-100"
                          >
                            <span>{showAllCapes ? "Show less" : "See more"}</span>
                            <ArrowRight
                              className={`h-3 w-3 transition-transform ${showAllCapes ? "rotate-90" : ""}`}
                            />
                          </button>
                        )}
                      </div>

                      <div className="grid grid-cols-[minmax(0,1.1fr)_minmax(0,1.9fr)] items-stretch gap-2">
                        <div className="flex flex-col items-center justify-center rounded-lg border border-slate-800 bg-slate-950/90 px-2 py-2 text-center">
                          <div className="mb-1 text-[10px] uppercase tracking-wide text-slate-400">
                            OptiFine cape
                          </div>
                          {optifineCapeHistory.length > 0 ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={optifineCapeHistory[0].url}
                              alt="OptiFine cape"
                              className="h-16 w-auto rounded-md border border-slate-700 bg-slate-900 object-contain"
                              loading="lazy"
                              decoding="async"
                            />
                          ) : (
                            <span className="text-[11px] text-slate-500">No OptiFine cape detected</span>
                          )}
                        </div>

                        <div className="flex flex-col gap-1.5 rounded-lg border border-slate-800 bg-slate-950/90 px-2 py-2">
                          <div className="flex items-center justify-between gap-2 text-[10px]">
                            <span className="uppercase tracking-wide text-slate-400">Minecraft capes</span>
                          </div>
                          <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
                            {mojangCapeHistory
                              .slice(0, showAllCapes ? mojangCapeHistory.length : 4)
                              .map((item, idx) => (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img
                                  key={`${item.url}-${idx}`}
                                  src={item.url}
                                  alt={`Minecraft cape ${idx + 1}`}
                                  className="h-10 w-10 flex-shrink-0 rounded-md border border-slate-700 bg-slate-900 object-contain"
                                  loading="lazy"
                                  decoding="async"
                                />
                              ))}
                            {mojangCapeHistory.length > (showAllCapes ? mojangCapeHistory.length : 4) && (
                              <button
                                type="button"
                                onClick={() => setShowAllCapes(true)}
                                className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-md border border-dashed border-slate-700 bg-slate-900/80 text-[11px] text-slate-300 hover:border-amber-400/70 hover:text-amber-100"
                                aria-label="Show more cape history"
                              >
                                <ArrowRight className="h-3.5 w-3.5" />
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="mt-4 w-full px-4 pb-1">
                  <div className="rounded-lg border border-dashed border-slate-800 bg-slate-950/90 px-3 py-3 text-center text-[11px] text-slate-300">
                    No cached skin or cape history yet. Maintainers can refresh this player to capture
                    their current look over time.
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <div className="rounded-xl border border-emerald-400/40 bg-gradient-to-br from-[#02100f] via-[#020c1b] to-[#000814] p-4 text-xs text-slate-100 shadow-[0_0_40px_rgba(0,0,0,0.9)]">
          <div className="mb-2 flex items-start justify-between gap-3">
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-emerald-300/80">
                MM Stats
              </div>
              <div className="mt-1 text-[12px] text-emerald-100">
                Classic · Double Up · Infection · Assassins
              </div>
            </div>
            {entry.hypixelStats?.fetchedAt && (
              <div className="text-right text-[10px] text-emerald-200/80">
                Cached from Hypixel
                <br />
                {new Date(entry.hypixelStats.fetchedAt).toLocaleString()}
              </div>
            )}
          </div>

          {!stats ? (
            <div className="mt-3 rounded-lg border border-dashed border-emerald-400/40 bg-black/40 px-3 py-4 text-[12px] text-emerald-100">
              No cached Hypixel stats yet for this player.
            </div>
          ) : (
            <>
              {/* Top summary strip: Hypixel stats + general stats */}
              <div className="mt-3 grid gap-3 md:grid-cols-[minmax(0,1.5fr)_minmax(0,1.5fr)] items-stretch text-[12px]">
                {/* Hypixel Stats */}
                <div className="rounded-lg bg-black/35 px-3 py-2">
                  <div className="text-[10px] uppercase tracking-wide text-emerald-200/80">Hypixel Stats</div>
                  <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1">
                    <div className="text-slate-300">Quests completed</div>
                    <div className="text-right font-semibold text-emerald-200">
                      {formatNum(stats.questsCompleted)}
                    </div>
                    <div className="text-slate-300">Challenges completed</div>
                    <div className="text-right font-semibold text-emerald-200">
                      {formatNum(stats.challengesCompleted)}
                    </div>
                    <div className="text-slate-300">Reward streak</div>
                    <div className="text-right font-semibold text-amber-200">
                      {formatNum(stats.rewardStreak)}
                    </div>
                    <div className="text-slate-300">Gifts sent</div>
                    <div className="text-right font-semibold text-pink-200">
                      {formatNum(stats.giftsSent)}
                    </div>
                    <div className="text-slate-300">Ranks gifted</div>
                    <div className="text-right font-semibold text-pink-200">
                      {formatNum(stats.ranksGifted)}
                    </div>
                  </div>
                </div>

                {/* General stats */}
                <div className="rounded-lg bg-black/35 px-3 py-2">
                  <div className="text-[10px] uppercase tracking-wide text-emerald-200/80">General</div>
                  <div className="mt-2 grid grid-cols-1 gap-1.5 text-[12px]">
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="text-slate-200">Tokens collected</span>
                      <span className="font-semibold text-emerald-200">{formatNum(stats.tokens)}</span>
                    </div>
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="text-slate-200">Gold picked up</span>
                      <span className="font-semibold text-yellow-200">{formatNum(stats.goldPickedUp)}</span>
                    </div>
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="text-slate-200">Total games played</span>
                      <span className="font-semibold text-sky-200">{formatNum(stats.gamesPlayed)}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Tab strip */}
              <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-emerald-500/30 pt-2 text-[11px]">
                <div className="flex flex-wrap gap-1.5">
                  {[
                    { id: "overall", label: "Overall" },
                    { id: "classic", label: "Classic" },
                    { id: "double", label: "Double Up" },
                    { id: "assassins", label: "Assassins" },
                    { id: "infection", label: "Infection" },
                  ].map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => setStatsTab(t.id as typeof statsTab)}
                      className={`rounded-full px-3 py-0.5 text-[11px] font-semibold tracking-wide transition ${
                        statsTab === t.id
                          ? "bg-emerald-400 text-slate-950 shadow-sm"
                          : "bg-black/40 text-emerald-100 hover:bg-emerald-500/20"
                      }`}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
                {statsTab !== "overall" && (
                  <div className="text-[10px] text-emerald-200/80">
                    Mode-specific breakdown will use the same layout once we extend the Hypixel snapshot.
                  </div>
                )}
              </div>

              {/* Tab content – for now, show overall totals in a rich grid while we wire per-mode fields */}
              <div className="mt-3 grid gap-3 text-[13px] sm:grid-cols-2 lg:grid-cols-3">
                {/* Overall core */}
                <div className="rounded-lg bg-black/40 px-3 py-2">
                  <div className="text-[10px] uppercase tracking-wide text-emerald-300/80">Overall</div>
                  <div className="mt-1 grid grid-cols-2 gap-x-3 gap-y-1">
                    <div className="text-slate-300">Wins</div>
                    <div className="text-right font-semibold text-emerald-200">{formatNum(stats.wins)}</div>
                    <div className="text-slate-300">Kills</div>
                    <div className="text-right font-semibold text-emerald-200">{formatNum(stats.kills)}</div>
                    <div className="text-slate-300">Deaths</div>
                    <div className="text-right font-semibold text-rose-200">{formatNum(stats.deaths)}</div>
                    <div className="text-slate-300">KDR</div>
                    <div className="text-right font-semibold text-orange-200">{formatKdr(stats.kdr)}</div>
                    <div className="text-slate-300">Games played</div>
                    <div className="text-right font-semibold text-sky-200">{formatNum(stats.gamesPlayed)}</div>
                  </div>
                </div>

                {/* Role wins / heroics */}
                <div className="rounded-lg bg-black/40 px-3 py-2">
                  <div className="text-[10px] uppercase tracking-wide text-emerald-300/80">Role wins</div>
                  <div className="mt-1 grid grid-cols-2 gap-x-3 gap-y-1">
                    <div className="text-slate-300">Murderer wins</div>
                    <div className="text-right font-semibold text-rose-200">{formatNum(stats.murdererWins)}</div>
                    <div className="text-slate-300">Detective wins</div>
                    <div className="text-right font-semibold text-cyan-200">{formatNum(stats.detectiveWins)}</div>
                    <div className="text-slate-300">Hero wins</div>
                    <div className="text-right font-semibold text-yellow-200">{formatNum(stats.heroWins)}</div>
                    <div className="text-slate-300">Suicides</div>
                    <div className="text-right font-semibold text-rose-200">{formatNum(stats.suicides)}</div>
                  </div>
                </div>

                {/* Kill breakdown */}
                <div className="rounded-lg bg-black/40 px-3 py-2">
                  <div className="text-[10px] uppercase tracking-wide text-emerald-300/80">Kill breakdown</div>
                  <div className="mt-1 grid grid-cols-2 gap-x-3 gap-y-1">
                    <div className="text-slate-300">Kills as murderer</div>
                    <div className="text-right font-semibold text-rose-200">{formatNum(stats.killsAsMurderer)}</div>
                    <div className="text-slate-300">Thrown knife kills</div>
                    <div className="text-right font-semibold text-rose-200">{formatNum(stats.thrownKnifeKills)}</div>
                    <div className="text-slate-300">Trap kills</div>
                    <div className="text-right font-semibold text-amber-200">{formatNum(stats.trapKills)}</div>
                    <div className="text-slate-300">Hero kills</div>
                    <div className="text-right font-semibold text-sky-200">{formatNum(stats.heroKills)}</div>
                    <div className="text-slate-300">Bow kills</div>
                    <div className="text-right font-semibold text-emerald-200">{formatNum(stats.bowKillsTotal ?? stats.bowKills)}</div>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Entry options row between top and bottom sections */}
      <div className="grid gap-4">
        <div className="rounded-lg border border-white/15 bg-slate-950/95 p-3 text-xs shadow-sm">
          <h3 className="mb-2 text-sm font-semibold text-slate-100">Entry options</h3>

          <div className="mb-3 space-y-1.5">
            <div className="flex items-center gap-2">
              <div className="flex flex-1 items-stretch overflow-hidden rounded-md border border-slate-700 bg-slate-900/90 text-[11px] text-slate-100 shadow-sm">
                <select
                  value={copyFormat}
                  onChange={(e) => setCopyFormat(e.target.value as "dashed" | "plain")}
                  className="h-8 border-r border-slate-700 bg-slate-950 px-2 text-[11px] text-slate-100 outline-none"
                >
                  <option value="dashed">With dashes</option>
                  <option value="plain">Without dashes</option>
                </select>
                <Input
                  readOnly
                  value={copyValue}
                  className="h-8 flex-1 border-0 bg-transparent px-2 text-[11px] text-slate-100 focus-visible:ring-0 focus-visible:ring-offset-0"
                />
              </div>
              <Button
                type="button"
                onClick={handleCopyValue}
                className="inline-flex items-center gap-1 rounded-full border border-amber-400/80 bg-[#ff7a1a] px-3 py-1 text-[11px] font-semibold text-black shadow-sm hover:bg-[#ff9a3a] hover:border-amber-300"
              >
                <Copy className="h-3.5 w-3.5" />
                <span>{copied ? "Copied" : "Copy"}</span>
              </Button>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <a
              href={`https://namemc.com/profile/${encodeURIComponent(entry.uuid)}`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 rounded-full border border-sky-400/80 bg-sky-600 px-3 py-1 text-[11px] font-semibold text-white shadow-sm hover:bg-sky-500 hover:border-sky-300"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              <span>NameMC</span>
            </a>
            <a
              href={`/mmid/${encodeURIComponent(entry.uuid)}`}
              className="inline-flex items-center gap-1 rounded-full border border-amber-400/80 bg-amber-500 px-3 py-1 text-[11px] font-semibold text-black shadow-sm hover:bg-amber-400 hover:border-amber-300"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              <span>Open MMID profile page</span>
            </a>
            <Button
              type="button"
              disabled
              className="inline-flex items-center gap-1 rounded-full border border-slate-600 bg-slate-900 px-3 py-1 text-[11px] font-semibold text-slate-400 opacity-70"
            >
              Pin profile (coming soon)
            </Button>
            {canEdit && (
              <form action={markEntryNeedsReview} className="inline-flex">
                <input type="hidden" name="entryUuid" value={entry.uuid} />
                <Button
                  type="submit"
                  className="inline-flex items-center gap-1 rounded-full border border-amber-500/80 bg-amber-500 px-3 py-1 text-[11px] font-semibold text-black shadow-sm hover:bg-amber-400 hover:border-amber-300"
                >
                  <ShieldQuestion className="h-3.5 w-3.5" /> Send to reviews
                </Button>
              </form>
            )}
          </div>
        </div>
      </div>

      {/* MMID Info – now full-width */}
      <div className="mt-4 grid gap-4 items-start md:grid-cols-1">
        {/* MMID Info */}
        <div
          className={
            "rounded-lg border p-4 text-sm shadow-sm " +
            (canEdit && editMode
              ? "border-amber-400/80 bg-amber-950/90 shadow-[0_0_0_1px_rgba(251,191,36,0.35)]"
              : "border-white/15 bg-slate-950/95")
          }
        >
          <h3 className="mb-3 text-base font-semibold uppercase tracking-wide text-slate-100">
            MMID Info
          </h3>

          {!canEdit || !editMode ? (
            <>
              <div className="mb-3 flex flex-wrap items-center gap-3">
                <span className="text-[11px] uppercase tracking-wide text-slate-300">Status</span>
                <span
                  className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${statusTone(
                    entry.status,
                  )}`}
                >
                  {entry.status || "Not set"}
                </span>
              </div>
              <div className="mb-3 flex flex-wrap items-center gap-6">
                <div>
                  <div className="text-[10px] uppercase tracking-wide text-slate-400">Reviewed by</div>
                  <div className="text-[12px] font-medium text-slate-100">
                    {entry.reviewedBy || "Unassigned"}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] uppercase tracking-wide text-slate-400">Confidence</span>
                  <Stars n={entry.confidenceScore ?? 0} />
                </div>
              </div>
              <div className="mb-2">
                <div className="mb-1 text-[11px] uppercase tracking-wide text-slate-300">Cheating tags</div>
                <div className="flex flex-wrap gap-1.5">
                  {(entry.typeOfCheating ?? []).map((t, i) => (
                    <span
                      key={`tc-info-${i}`}
                      className="rounded-full bg-slate-700/80 px-2 py-0.5 text-[11px] text-white"
                    >
                      {t}
                    </span>
                  ))}
                  {!(entry.typeOfCheating && entry.typeOfCheating.length) && (
                    <span className="text-[11px] text-slate-500">No cheating tags recorded</span>
                  )}
                </div>
              </div>
              <div className="mb-2">
                <div className="mb-1 text-[11px] uppercase tracking-wide text-slate-300">Behavior tags</div>
                <div className="flex flex-wrap gap-1.5">
                  {(entry.redFlags ?? []).map((t, i) => (
                    <span
                      key={`rf-info-${i}`}
                      className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${behaviorTagTone(t)}`}
                    >
                      {t}
                    </span>
                  ))}
                  {!(entry.redFlags && entry.redFlags.length) && (
                    <span className="text-[11px] text-slate-500">No behavior tags recorded</span>
                  )}
                </div>
              </div>
              <div>
                <div className="mb-1 text-[11px] uppercase tracking-wide text-slate-300">Notes / evidence</div>
                <div className="max-h-36 overflow-y-auto whitespace-pre-line text-[12px] text-slate-200">
                  {notesSection.trim() ? (
                    notesSection
                  ) : (
                    <span className="text-slate-500">No notes yet</span>
                  )}
                </div>
                {attachmentLines.length > 0 && (
                  <div className="mt-2 text-[11px] text-slate-300">
                    <button
                      type="button"
                      onClick={() => setShowAttachments((v) => !v)}
                      className="rounded-full border border-slate-600 bg-slate-900/80 px-2 py-0.5 text-[11px] text-slate-100 hover:border-amber-400/70 hover:text-amber-100"
                    >
                      {showAttachments
                        ? `Hide attachments (${attachmentLines.length})`
                        : `Show attachments (${attachmentLines.length})`}
                    </button>
                    {showAttachments && (
                      <ul className="mt-1 space-y-1">
                        {attachmentLines.map((link, i) => (
                          <li key={`att-${i}`} className="truncate">
                            <a
                              href={link}
                              target="_blank"
                              rel="noreferrer"
                              className="text-[11px] text-sky-300 hover:underline"
                            >
                              {link}
                            </a>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}
              </div>
            </>
          ) : (
            <form action={upsertEntry} className="space-y-3">
              <div className="flex justify-end">
                <form action={checkHypixelData} className="inline-flex">
                  <input type="hidden" name="entryUuid" value={entry.uuid} />
                  <Button
                    type="submit"
                    size="sm"
                    className="inline-flex items-center gap-1 rounded-full border border-emerald-500/70 bg-emerald-600 px-3 py-1 text-[11px] font-semibold text-black shadow-sm hover:bg-emerald-500 hover:border-emerald-300"
                  >
                    <RefreshCw className="h-3.5 w-3.5" />
                    <span>Refresh Hypixel stats</span>
                  </Button>
                </form>
              </div>

              <input type="hidden" name="targetUuid" value={entry.uuid} />
              <input type="hidden" name="uuid" value={entry.uuid} />
              <input type="hidden" name="username" value={entry.username} />
              <input type="hidden" name="guild" value={entry.guild ?? ""} />
              <input type="hidden" name="rank" value={entry.rank ?? ""} />

              <div className="grid gap-3 md:grid-cols-[minmax(0,1.2fr)_minmax(0,1.4fr)]">
                <label className="flex flex-col gap-1">
                  <span className="text-[10px] uppercase tracking-wide text-slate-300">Status</span>
                  <select
                    name="status"
                    defaultValue={entry.status ?? ""}
                    className="h-8 rounded border border-amber-500/60 bg-amber-950/80 px-2 text-[12px] text-amber-50"
                  >
                    <option value="">—</option>
                    {STATUS_OPTIONS.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </label>

                <div className="grid gap-2">
                  <label className="flex flex-col gap-1">
                    <span className="text-[10px] uppercase tracking-wide text-slate-300">Reviewed by</span>
                    <input
                      name="reviewedBy"
                      defaultValue={entry.reviewedBy ?? currentUserName ?? ""}
                      className="h-8 rounded border border-amber-500/60 bg-amber-950/80 px-2 text-[12px] text-amber-50 placeholder:text-amber-200/50"
                      placeholder="Leave blank to use your account name"
                    />
                  </label>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[10px] uppercase tracking-wide text-slate-300">Confidence</span>
                    <input type="hidden" name="confidenceScore" value={editConfidence} />
                    <Stars n={editConfidence} editable onChange={(v) => setEditConfidence(v)} />
                    <span className="text-[11px] text-amber-200/80">{editConfidence}/5</span>
                  </div>
                </div>
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                <div>
                  <div className="mb-1 text-[11px] uppercase tracking-wide text-slate-300">Cheating tags</div>
                  <div className="flex flex-wrap gap-1.5">
                    {cheatingOptions.map((opt) => {
                      const checked = (entry.typeOfCheating ?? []).includes(opt);
                      return (
                        <label
                          key={opt}
                          className={`inline-flex cursor-pointer items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] ${
                            checked
                              ? "border-emerald-400/80 bg-emerald-500/20 text-emerald-50"
                              : "border-amber-500/30 bg-amber-950/60 text-amber-100 hover:border-amber-400/60"
                          }`}
                        >
                          <input
                            type="checkbox"
                            name="typeOfCheating"
                            value={opt}
                            defaultChecked={checked}
                            className="h-3 w-3 rounded border-amber-500/70 bg-transparent text-amber-400 focus:ring-0"
                          />
                          <span>{opt}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>

                <div>
                  <div className="mb-1 text-[11px] uppercase tracking-wide text-slate-300">Behavior tags</div>
                  <div className="flex flex-wrap gap-1.5">
                    {behaviorOptions.map((opt) => {
                      const checked = (entry.redFlags ?? []).includes(opt);
                      return (
                        <label
                          key={opt}
                          className={`inline-flex cursor-pointer items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold ${
                            checked
                              ? behaviorTagTone(opt)
                              : "border-slate-500/50 bg-slate-900/70 text-slate-100 hover:border-amber-400/60"
                          }`}
                        >
                          <input
                            type="checkbox"
                            name="redFlags"
                            value={opt}
                            defaultChecked={checked}
                            className="h-3 w-3 rounded border-slate-400 bg-transparent text-amber-400 focus:ring-0"
                          />
                          <span>{opt}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <label className="flex flex-col gap-1">
                  <span className="text-[11px] uppercase tracking-wide text-slate-300">Notes / evidence</span>
                  <textarea
                    name="notesEvidence"
                    defaultValue={notesSection}
                    rows={4}
                    className="mt-0.5 w-full resize-y rounded border border-amber-500/60 bg-amber-950/80 px-2 py-1.5 text-[12px] text-amber-50"
                  />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-[11px] uppercase tracking-wide text-slate-300">
                    Attachments / evidence links (one per line)
                  </span>
                  <textarea
                    name="notesAttachments"
                    defaultValue={attachmentsSection}
                    rows={3}
                    className="mt-0.5 w-full resize-y rounded border border-slate-600 bg-slate-950/80 px-2 py-1.5 text-[12px] text-slate-100"
                    placeholder="https://example.com/clip
https://example.com/screenshot"
                  />
                </label>
              </div>

              <div className="flex justify-end gap-2 text-[11px]">
                <button
                  type="button"
                  onClick={() => setEditMode(false)}
                  className="inline-flex items-center gap-1 rounded-full border border-slate-500/60 bg-slate-950/80 px-3 py-1 text-slate-200 hover:bg-slate-900/80"
                >
                  <ArrowDown className="h-3.5 w-3.5 rotate-90" />
                  <span>Cancel</span>
                </button>
                <Button
                  type="submit"
                  className="inline-flex items-center gap-1 rounded-full border border-emerald-500/80 bg-emerald-500 px-4 py-1 font-semibold text-black shadow-sm hover:bg-emerald-400 hover:border-emerald-300"
                >
                  <Check className="h-3.5 w-3.5" />
                  <span>Save MMID info</span>
                </Button>
              </div>
            </form>
          )}
        </div>
      </div>

      {/* Bottom row: Username history + Alt Accounts side by side */}
      {(!canEdit || !editMode) && (
      <div className="mt-4 grid gap-4 md:grid-cols-2 items-start">
        <div className="rounded-lg border border-white/15 bg-slate-950/95 p-4 text-sm shadow-sm">
          <h3 className="mb-3 text-base font-semibold uppercase tracking-wide text-slate-100">
            Username history
          </h3>
          {hasHistory ? (
            <div className="space-y-2">
              <div className="rounded border border-emerald-500/40 bg-emerald-950/60 px-2.5 py-1.5 text-[11px] text-emerald-50">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-semibold">Current</span>
                  <span className="text-[10px] uppercase tracking-wide text-emerald-200/80">
                    Active
                  </span>
                </div>
                <div className="mt-0.5 font-mono text-[12px]">{entry.username}</div>
              </div>

              {(entry.usernameHistory ?? []).map((h, i) => (
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

        <div className="rounded-lg border border-white/15 bg-slate-950/95 p-4 text-sm shadow-sm">
          <h3 className="mb-3 text-base font-semibold uppercase tracking-wide text-slate-100">
            Alt Accounts (coming soon)
          </h3>
          <p className="text-[12px] text-slate-300">
            This section will show related UUIDs and linked alt accounts once this feature is implemented.
          </p>
        </div>
      </div>
      )}

      {/* Bottom utility row: copy/save card as image */}
      <div className="mt-4 flex flex-wrap justify-end gap-2 text-[11px]">
        <Button
          type="button"
          onClick={handleCopyCardImage}
          className="inline-flex items-center gap-1 rounded-full border border-slate-600 bg-slate-900 px-3 py-1 text-slate-100 shadow-sm hover:border-amber-400/70 hover:text-amber-100"
        >
          <Copy className="h-3.5 w-3.5" />
          <span>Copy card as image</span>
        </Button>
        <Button
          type="button"
          onClick={handleDownloadCardImage}
          className="inline-flex items-center gap-1 rounded-full border border-slate-600 bg-slate-900 px-3 py-1 text-slate-100 shadow-sm hover:border-amber-400/70 hover:text-amber-100"
        >
          <FileText className="h-3.5 w-3.5" />
          <span>Save card image</span>
        </Button>
      </div>
    </div>
  );
}

/* ---------------------------------------------
   Master/detail layout with right-hand directory
---------------------------------------------- */

type MMIDDirectoryMasterDetailProps = {
  rows: MmidRow[];
  canEdit?: boolean;
  currentUserName?: string | null;
};

export default function MMIDDirectoryMasterDetail({
  rows,
  canEdit = false,
  currentUserName,
}: MMIDDirectoryMasterDetailProps) {
  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [searchMode, setSearchMode] = useState<SearchMode>("smart");
  const [activeUuid, setActiveUuid] = useState<string | null>(() => {
    const preferred = rows.find((r) => r.username.toLowerCase() === "inpuzah");
    return preferred?.uuid ?? rows[0]?.uuid ?? null;
  });

  const virtuosoRef = useRef<VirtuosoHandle | null>(null);

  const filtered = useMemo(() => {
    const raw = q.trim();
    const s = raw.toLowerCase();
    const uuidish = raw ? raw.replace(/-/g, "").toLowerCase() : "";
    const isUuidLike = uuidish.length >= 16 && /^[0-9a-f]+$/i.test(uuidish);

    const textFiltered = rows.filter((r) => {
      if (!s) return true;

      const username = r.username.toLowerCase();
      const guild = (r.guild ?? "").toLowerCase();
      const rank = (r.rank ?? "").toLowerCase();
      const status = (r.status ?? "").toLowerCase();
      const uuidPlain = r.uuid.replace(/-/g, "").toLowerCase();
      const tagsJoined = [...(r.typeOfCheating ?? []), ...(r.redFlags ?? [])]
        .join("|")
        .toLowerCase();
      const notes = (r.notesEvidence ?? "").toLowerCase();

      switch (searchMode) {
        case "player": {
          return (
            username.includes(s) ||
            guild.includes(s) ||
            rank.includes(s)
          );
        }
        case "uuid": {
          return uuidPlain.includes(uuidish);
        }
        case "guild": {
          return guild.includes(s);
        }
        case "tags": {
          return tagsJoined.includes(s) || notes.includes(s);
        }
        case "smart":
        default: {
          // If the query looks like a UUID, prioritize UUID matches but still
          // fall back to the general text search.
          if (isUuidLike && uuidPlain.includes(uuidish)) return true;

          return [
            username,
            r.uuid.toLowerCase(),
            guild,
            rank,
            status,
            tagsJoined,
            notes,
          ]
            .join("|")
            .includes(s);
        }
      }
    });

    return textFiltered.filter((r) => matchesStatusFilter(r.status ?? null, statusFilter));
  }, [rows, q, statusFilter, searchMode]);

  const { flat, groupCounts, groupLabels, letterToIndex, lettersPresent } = useMemo(
    () => buildAlphaIndex(filtered),
    [filtered],
  );

  useEffect(() => {
    // Reset active selection if the current active uuid is no longer present
    if (!activeUuid && flat.length > 0) {
      setActiveUuid(flat[0].uuid);
      return;
    }
    if (activeUuid && !flat.some((r) => r.uuid === activeUuid)) {
      setActiveUuid(flat[0]?.uuid ?? null);
    }
  }, [flat, activeUuid]);

  const activeEntry = useMemo(
    () => flat.find((r) => r.uuid === activeUuid) ?? flat[0] ?? null,
    [flat, activeUuid],
  );

  const jumpTo = useCallback(
    (letter: string) => {
      const idx = letterToIndex.get(letter);
      if (idx == null) return;
      virtuosoRef.current?.scrollToIndex({ index: idx, align: "start", behavior: "smooth" });
    },
    [letterToIndex],
  );

  const cycleStatus = useCallback(
    (delta: number) => {
      const currentIndex = STATUS_FILTERS.findIndex((f) => f.value === statusFilter);
      const safeIndex = currentIndex === -1 ? 0 : currentIndex;
      const nextIndex = (safeIndex + delta + STATUS_FILTERS.length) % STATUS_FILTERS.length;
      setStatusFilter(STATUS_FILTERS[nextIndex].value);
    },
    [statusFilter],
  );

  return (
    <div className="relative min-h-[100dvh] w-full text-foreground">
      <div className="w-full px-0 py-4">
        {/* Header */}
        <header className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between rounded-xl border border-amber-500/40 bg-gradient-to-r from-slate-950 via-slate-900 to-slate-950 px-4 py-3 shadow-[0_0_40px_rgba(15,23,42,0.75)]">
          <div className="space-y-1">
            <h1 className="text-2xl font-semibold tracking-tight">MMID Directory</h1>
            {canEdit && (
              <div className="flex items-center gap-2 text-[11px] uppercase tracking-wide text-amber-400/80">
                <span className="opacity-70">Maintainer tools available in the MMID Info panel.</span>
              </div>
            )}
          </div>
        </header>

        {/* Search + filters row */}
        <div className="mb-3 flex flex-col gap-2 lg:flex-row lg:items-end lg:justify-between">
          {/* Search */}
          <div className="flex flex-1 flex-col gap-1">
            <label className="text-[11px] uppercase tracking-wide text-slate-300">
              Directory search
            </label>
            <div className="flex items-center gap-2">
              <Input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search by username, guild, rank, status, notes…"
                className="flex-1 border-white/10 bg-white/5 text-white placeholder:text-white/50"
              />
              <Button
                variant="secondary"
                className="border-amber-500/60 bg-amber-500/20 text-amber-50 hover:bg-amber-500/30 hover:border-amber-300"
                onClick={() => setQ("")}
              >
                Clear
              </Button>
            </div>
            <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-slate-300">
              <span className="uppercase tracking-wide text-slate-400">Mode:</span>
              {(
                [
                  { value: "smart", label: "Smart" },
                  { value: "player", label: "Player" },
                  { value: "uuid", label: "UUID" },
                  { value: "guild", label: "Guild" },
                  { value: "tags", label: "Tags / notes" },
                ] as { value: SearchMode; label: string }[]
              ).map((m) => (
                <button
                  key={m.value}
                  type="button"
                  onClick={() => setSearchMode(m.value)}
                  className={
                    "rounded-full border px-2 py-0.5 text-[10px] font-medium tracking-wide transition " +
                    (searchMode === m.value
                      ? "border-amber-400 bg-amber-500/90 text-slate-950 shadow-sm"
                      : "border-slate-600 bg-slate-900/80 text-slate-200 hover:border-amber-400/70")
                  }
                >
                  {m.label}
                </button>
              ))}
            </div>
          </div>

          {/* Status flip-through */}
          <div className="mt-2 flex flex-col items-start gap-1 lg:mt-0 lg:items-end">
            <span className="text-[11px] uppercase tracking-wide text-slate-300">Status filter</span>
            <div className="inline-flex items-center gap-1">
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="h-7 w-7 rounded-full border-amber-500/70 bg-slate-950/80 text-amber-100 hover:bg-amber-500/20"
                onClick={() => cycleStatus(-1)}
              >
                <ChevronLeft className="h-3.5 w-3.5" />
              </Button>
              <div className="min-w-[9rem] rounded-full border border-amber-500/70 bg-slate-950/80 px-3 py-1 text-center text-[11px] font-semibold text-amber-100">
                {STATUS_FILTERS.find((f) => f.value === statusFilter)?.label ?? "All"}
              </div>
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="h-7 w-7 rounded-full border-amber-500/70 bg-slate-950/80 text-amber-100 hover:bg-amber-500/20"
                onClick={() => cycleStatus(1)}
              >
                <ChevronRight className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        </div>

        {/* Status summary */}
        <div className="mb-2 flex flex-col gap-2 text-xs text-slate-300 sm:flex-row sm:items-center sm:justify-between">
          <div>
            Showing <span className="font-semibold text-slate-100">{filtered.length}</span> of{" "}
            <span className="font-semibold text-slate-100">{rows.length}</span> entries
            {q.trim() && (
              <>
                {" "}for "<span className="font-mono">{q.trim()}</span>"
              </>
            )}
            {statusFilter !== "all" && (
              <>
                {" "}· status filter:{" "}
                <span className="font-semibold text-slate-100">
                  {STATUS_FILTERS.find((f) => f.value === statusFilter)?.label ?? "All"}
                </span>
              </>
            )}
            <div className="mt-1 flex items-center gap-1 text-[11px] text-slate-400">
              <Filter className="h-3 w-3" />
              <span>Use the jump bar on the left to jump by username.</span>
            </div>
          </div>
        </div>

        {/* Master/detail grid */}
        <div className="grid gap-1 lg:grid-cols-[minmax(0,7fr)_minmax(0,9fr)] items-start">
          {/* Left: MMID directory list with A–Z controls */}
          <div className="relative min-h-0 h-full overflow-hidden rounded-lg border-2 border-border/70 bg-card/90 shadow-lg backdrop-blur-sm flex flex-col">
            {/* Horizontal A–Z jump bar */}
            <div className="flex items-center justify-between border-b border-white/10 bg-slate-950/90 px-3 py-1.5 text-[12px] text-slate-200">
              <span className="uppercase tracking-wide text-slate-300">Jump to letter</span>
              <div className="flex max-w-full flex-wrap gap-1 overflow-x-auto pb-0.5 text-[11px]">
                {[...LETTERS, "#"].map((L) => {
                  const present = lettersPresent.has(L);
                  return (
                    <button
                      key={L}
                      type="button"
                      onClick={() => present && jumpTo(L)}
                      className={`h-6 min-w-[1.6rem] rounded-full px-1.5 text-center font-semibold transition ${
                        present
                          ? "bg-slate-800 text-slate-50 hover:bg-amber-500/70 hover:text-slate-900"
                          : "bg-slate-900 text-slate-500 cursor-default"
                      }`}
                      aria-disabled={!present}
                      title={present ? `Jump to ${L}` : `${L} (no entries)`}
                    >
                      {L}
                    </button>
                  );
                })}
              </div>
            </div>

            <GroupedVirtuoso
              ref={virtuosoRef}
              style={{ height: "100%" }}
              components={{ Scroller: DirectoryScroller }}
              data={flat}
              groupCounts={groupCounts}
              computeItemKey={(index) => flat[index]?.uuid ?? `row-${index}`}
              groupContent={(gi) => (
                <div className="sticky top-0 z-10 border-b border-white/10 bg-slate-900/60 px-3 py-1 backdrop-blur">
                  <span className="text-xs tracking-wider text-slate-300">{groupLabels[gi]}</span>
                </div>
              )}
              itemContent={(index) => {
                const e = flat[index] as MmidRow | undefined;
                if (!e) return null;

                const isActive = activeEntry && activeEntry.uuid === e.uuid;

                return (
                  <button
                    key={e.uuid}
                    type="button"
                    onClick={() => setActiveUuid(e.uuid)}
                    className={`flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-xs rounded-md border border-transparent transition-all duration-150 ease-out hover:-translate-y-0.5 hover:scale-[1.02] hover:border-amber-400/60 hover:bg-amber-500/10 ${
                      isActive ? "bg-amber-500/20 border-amber-400/80" : "bg-transparent"
                    }`}
                    aria-label={`View ${e.username}`}
                  >
                    <div className="flex min-w-0 flex-1 items-center gap-2">
                      <MinecraftSkin
                        id={e.uuid}
                        name={e.username}
                        className="h-9 w-auto shrink-0 rounded-md object-contain ring-1 ring-white/10"
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1">
                          <span className="truncate text-sm font-semibold text-slate-50">
                            {e.username}
                          </span>
                          {e.rank && (
                            <span
                              className={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${rankClass(
                                e.rank,
                              )}`}
                            >
                              {e.rank}
                            </span>
                          )}
                        </div>
                        <div className="mt-0.5 flex flex-wrap items-center gap-1 text-[10px]">
                          {e.status && (
                            <span
                              className={`rounded-full px-1.5 py-0.5 font-semibold ${statusTone(e.status)}`}
                            >
                              {e.status}
                            </span>
                          )}
                          {(e.redFlags ?? []).slice(0, 1).map((t, i) => (
                            <span
                              key={`rf-dir-${i}`}
                              className={`rounded-full px-1.5 py-0.5 font-semibold ${behaviorTagTone(t)}`}
                            >
                              {t}
                            </span>
                          ))}
                        </div>
                        <div className="mt-0.5 truncate text-[11px] text-slate-300">
                          {e.guild ?? "No guild"}
                        </div>
                      </div>
                    </div>
                    <div className="ml-2 flex flex-col items-end justify-center text-right">
                      <span className="text-lg font-semibold text-slate-50">
                        {e.voteScore ?? 0}
                      </span>
                      <span className="text-[9px] uppercase tracking-wide text-slate-400">Votes</span>
                    </div>
                  </button>
                );
              }}
            />
          </div>

          {/* Right: Entry detail */}
          <div className="min-h-0 rounded-lg border-2 border-border/70 bg-slate-950/90 p-4 shadow-lg backdrop-blur-sm">
            <EntryDetailPanel entry={activeEntry} canEdit={canEdit} currentUserName={currentUserName} />
          </div>
        </div>
      </div>
    </div>
  );
}

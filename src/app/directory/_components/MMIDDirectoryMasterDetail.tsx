"use client";

import React, { useMemo, useState, useRef, useEffect, useCallback } from "react";
import { GroupedVirtuoso, Virtuoso, type VirtuosoHandle } from "react-virtuoso";

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import MinecraftSkin from "@/components/MinecraftSkin";
import MinecraftSkinViewer3D from "@/components/MinecraftSkinViewer3D";
import {
  ArrowDown,
  Copy,
  Eye,
  Filter,
  ShieldQuestion,
  Star,
  Pencil,
  RefreshCw,
  FileText,
  ExternalLink,
  Check,
  ArrowRight,
  MoreVertical,
  Box,
} from "lucide-react";

import { markEntryNeedsReview, checkHypixelData, refreshMinecraftProfile } from "../actions";
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

type SearchScope = "player" | "uuid" | "guild" | "tags";

type SearchScopeState = Record<SearchScope, boolean>;

const DEFAULT_SEARCH_SCOPES: SearchScopeState = {
  player: true,
  uuid: true,
  guild: true,
  tags: true,
};

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
  if (val.includes("confirmed")) return "border border-rose-400/45 bg-rose-500/12 text-rose-100";
  if (val.includes("legit") || val.includes("cleared")) return "border border-emerald-400/45 bg-emerald-500/12 text-emerald-100";
  if (val.includes("needs") || val.includes("review")) return "border border-amber-400/50 bg-amber-500/12 text-amber-100";
  return "border border-slate-500/55 bg-slate-700/25 text-slate-100";
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
  if (!v) return "border border-slate-500/55 bg-slate-700/25 text-slate-100";

  if (v.includes("generally nice") || v.includes("nice person") || v.includes("whitelisted")) {
    return "border border-emerald-400/45 bg-emerald-500/12 text-emerald-100";
  }
  if (v.includes("inconclusive") || v.includes("unverified") || v.includes("other (please describe)")) {
    return "border border-amber-400/50 bg-amber-500/12 text-amber-100";
  }
  if (v.includes("previously banned") || v.includes("ban history") || v.includes("alt account")) {
    return "border border-orange-400/50 bg-orange-500/12 text-orange-100";
  }
  if (
    v.includes("harasses") ||
    v.includes("dox") ||
    v.includes("doxx") ||
    v.includes("catfish") ||
    v.includes("beamer") ||
    v.includes("beam")
  ) {
    return "border border-rose-400/50 bg-rose-500/12 text-rose-100";
  }
  if (v.includes("pedo") || v.includes("pedophile") || v.includes("groom")) {
    return "border border-rose-500/70 bg-rose-900/45 text-rose-50";
  }
  return "border border-slate-500/55 bg-slate-700/25 text-slate-100";
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
    case "BLACK":
      return "#000000";
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

function baseRankCssColor(rank?: string | null) {
  const r = (rank ?? "").toUpperCase();

  // Staff / special ranks (Hypixel-style approximations).
  if (r === "ADMIN") return "#FF5555";
  if (r === "YOUTUBER" || r === "YOUTUBE") return "#FF5555";
  if (r === "MODERATOR" || r === "MOD") return "#00AAAA";
  if (r === "HELPER") return "#5555FF";
  if (r === "GAME_MASTER" || r === "GM") return "#00AA00";

  // Donor ranks.
  if (r.includes("MVP++")) return "#FFAA00";
  if (r.includes("MVP")) return "#55FFFF";
  if (r.includes("VIP")) return "#55FF55";

  return null;
}

function normalizeRankDisplay(rankRaw: string) {
  const r = rankRaw.toUpperCase();
  const compact = r.replace(/[\s-]+/g, "_");

  // Normalize Hypixel/API variants: MVP_PLUS_PLUS, MVP PLUS PLUS, MVP+ +, etc.
  if (compact === "MVP_PLUS_PLUS" || compact === "MVP++") return "MVP++";
  if (compact === "MVP_PLUS" || compact === "MVP+") return "MVP+";
  if (compact === "VIP_PLUS" || compact === "VIP+") return "VIP+";
  if (r === "GAME_MASTER") return "GM";
  if (r === "YOUTUBER") return "YOUTUBE";
  return r;
}

function renderHypixelRankTag(rank: string, plusColor?: string | null, size: "compact" | "header" = "compact") {
  const r = rank.toUpperCase();

  // Normalize some known API values.
  const display = normalizeRankDisplay(r);
  if (display === "DEFAULT" || display === "NONE") return null;

  const baseClass =
    size === "header"
      ? "inline-flex items-baseline font-minecraft mmid-player-name font-bold tracking-[0.02em]"
      : "inline-flex items-center font-minecraft text-[12px] leading-none tracking-wide";

  const rankColor = baseRankCssColor(display) ?? "#FFFFFF";

  if (!display.includes("+") || !display.includes("MVP") && !display.includes("VIP")) {
    // Simple ranks: [ADMIN], [YOUTUBE], [MVP], [VIP], etc.
    return (
      <span className={baseClass}>
        <span style={{ color: rankColor }}>[</span>
        <span style={{ color: rankColor }}>{display}</span>
        <span style={{ color: rankColor }}>]</span>
      </span>
    );
  }

  // VIP+ / MVP+ / MVP++ need colored plus signs.
  const baseColor = rankColor;
  const plusCss = hypixelColorToCss(plusColor) ?? null;

  const baseText = display.replace(/\++/g, "");
  const plusCount = (display.match(/\+/g) ?? []).length;

  return (
    <span className={baseClass}>
      <span style={{ color: baseColor }}>[</span>
      <span style={{ color: baseColor }}>{baseText}</span>
      {Array.from({ length: plusCount }).map((_, i) => (
        <span key={i} style={plusCss ? { color: plusCss } : undefined}>
          +
        </span>
      ))}
      <span style={{ color: baseColor }}>]</span>
    </span>
  );
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

function IconBtn({
  title,
  onClick,
  children,
}: {
  title: string;
  onClick?: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      title={title}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onClick?.();
      }}
      className="grid h-6 w-6 place-items-center rounded border border-white/15 bg-black/55 text-white/80 hover:border-white/25 hover:bg-black/70 hover:text-white"
    >
      {children}
    </button>
  );
}

function SkinHeadThumbnail({
  skinUrl,
  alt,
}: {
  skinUrl: string;
  alt: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    let disposed = false;
    const img = new Image();
    img.decoding = "async";
    img.crossOrigin = "anonymous";

    img.onload = () => {
      if (disposed) return;
      const canvas = canvasRef.current;
      if (!canvas) return;

      canvas.width = 8;
      canvas.height = 8;

      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      ctx.clearRect(0, 0, 8, 8);
      ctx.imageSmoothingEnabled = false;

      // Base head front (8x8 at 8,8) + hat/overlay layer (8x8 at 40,8)
      // for classic 64x64 skins.
      ctx.drawImage(img, 8, 8, 8, 8, 0, 0, 8, 8);
      if (img.width >= 48 && img.height >= 16) {
        ctx.drawImage(img, 40, 8, 8, 8, 0, 0, 8, 8);
      }
    };

    img.src = skinUrl;

    return () => {
      disposed = true;
    };
  }, [skinUrl]);

  return (
    <div role="img" aria-label={alt} className="h-full w-full">
      <canvas ref={canvasRef} className="h-full w-full pixelated" />
    </div>
  );
}

function CapeFrontThumbnail({
  capeUrl,
  alt,
}: {
  capeUrl: string;
  alt: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    let disposed = false;
    const img = new Image();
    img.decoding = "async";
    img.crossOrigin = "anonymous";

    img.onload = () => {
      if (disposed) return;
      const canvas = canvasRef.current;
      if (!canvas) return;

      // Cape front face is 10x16 pixels in the canonical 64x32 layout.
      canvas.width = 10;
      canvas.height = 16;

      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      ctx.clearRect(0, 0, 10, 16);
      ctx.imageSmoothingEnabled = false;

      const scale = Math.max(1, Math.floor(img.width / 64));
      const sx = 1 * scale;
      const sy = 1 * scale;
      const sw = 10 * scale;
      const sh = 16 * scale;

      if (img.width >= sx + sw && img.height >= sy + sh) {
        ctx.drawImage(img, sx, sy, sw, sh, 0, 0, 10, 16);
      } else {
        // Fallback for non-canonical cape sheets.
        const fallbackW = Math.max(1, Math.floor(img.width * 0.45));
        const fallbackH = Math.max(1, Math.floor((fallbackW * 16) / 10));
        const fsx = Math.max(0, Math.floor((img.width - fallbackW) / 2));
        const fsy = Math.max(0, Math.floor((img.height - fallbackH) / 2));
        ctx.drawImage(img, fsx, fsy, Math.min(fallbackW, img.width - fsx), Math.min(fallbackH, img.height - fsy), 0, 0, 10, 16);
      }
    };

    img.src = capeUrl;

    return () => {
      disposed = true;
    };
  }, [capeUrl]);

  return (
    <div role="img" aria-label={alt} className="h-full w-full">
      <canvas ref={canvasRef} className="h-full w-full pixelated" />
    </div>
  );
}

function CosmeticPreviewTile({
  label,
  imgSrc,
  alt,
  textureType = "cape",
  size = 80,
  isActive,
  onHover,
  onView,
  onCopyUrl,
  onOpen,
  footer,
}: {
  label?: string;
  imgSrc: string;
  alt: string;
  textureType?: "skin" | "cape";
  size?: number;
  isActive?: boolean;
  onHover?: () => void;
  onView?: () => void;
  onCopyUrl?: () => void;
  onOpen?: () => void;
  footer?: string;
}) {
  return (
    <div
      role="button"
      tabIndex={0}
      onMouseEnter={onHover}
      onFocus={onHover}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onHover?.();
        }
      }}
      className={[
        "group relative shrink-0 overflow-hidden rounded-md border bg-slate-950/30",
        "shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_8px_16px_rgba(0,0,0,0.3)]",
        isActive ? "border-amber-400/70 ring-2 ring-amber-400/30" : "border-white/10 hover:border-white/20",
      ].join(" ")}
      style={{ width: size, height: size }}
    >
      <div className="bg-[linear-gradient(45deg,rgba(255,255,255,.06)_25%,transparent_25%),linear-gradient(-45deg,rgba(255,255,255,.06)_25%,transparent_25%),linear-gradient(45deg,transparent_75%,rgba(255,255,255,.06)_75%),linear-gradient(-45deg,transparent_75%,rgba(255,255,255,.06)_75%)] bg-[length:16px_16px] bg-[position:0_0,0_8px,8px_-8px,-8px_0px]">
        {textureType === "skin" ? (
          <SkinHeadThumbnail skinUrl={imgSrc} alt={alt} />
        ) : (
          <div className="flex h-full w-full items-center justify-center p-1">
            <div className="h-full w-[62%]">
              <CapeFrontThumbnail capeUrl={imgSrc} alt={alt} />
            </div>
          </div>
        )}
      </div>

      {label && (
        <div className="pointer-events-none absolute left-1 top-1 rounded bg-black/55 px-1.5 py-0.5 text-[10px] font-medium text-white/90">
          {label}
        </div>
      )}

      <div className="pointer-events-none absolute inset-0 bg-black/35 opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100" />

      <div className="absolute right-1 top-1 flex gap-1 opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
        <IconBtn title="View" onClick={onView}>
          <Eye className="h-3.5 w-3.5" />
        </IconBtn>
        <IconBtn title="Copy URL" onClick={onCopyUrl}>
          <Copy className="h-3.5 w-3.5" />
        </IconBtn>
        <IconBtn title="Open" onClick={onOpen}>
          <ExternalLink className="h-3.5 w-3.5" />
        </IconBtn>
      </div>

      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-6 bg-gradient-to-t from-black/55 to-transparent opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100" />

      {footer && (
        <div className="pointer-events-none absolute inset-x-0 bottom-0 px-1 pb-0.5 text-[9px] text-slate-200">
          {footer}
        </div>
      )}
    </div>
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
  const [skinLoaded, setSkinLoaded] = useState(false);
  const [copied, setCopied] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [editConfidence, setEditConfidence] = useState<number>(entry?.confidenceScore ?? 0);
  const [showAttachments, setShowAttachments] = useState(false);
  const [statsTab, setStatsTab] = useState<"overall" | "classic" | "double" | "assassins" | "infection">(
    "overall",
  );
  const [showAllSkins, setShowAllSkins] = useState(false);
  const [showAllCapes, setShowAllCapes] = useState(false);
  const [detailTab, setDetailTab] = useState<"overview" | "mmid" | "stats" | "cosmetics" | "usernames">("overview");
  const [cosmeticsSource, setCosmeticsSource] = useState<"all" | "mojang" | "optifine" | "lunar" | "badlion">("all");
  const [cosmeticsPreview, setCosmeticsPreview] = useState<{
    skinUrl: string;
    capeUrl: string | null;
    sourceLabel: string;
  } | null>(null);

  // Default to 3D; users can switch back to 2D and we persist it in localStorage.
  const [use3dRender, setUse3dRender] = useState(true);

  useEffect(() => {
    try {
      const v = localStorage.getItem("mmid.renderMode");
      if (v == null) {
        // First visit: default to 3D.
        localStorage.setItem("mmid.renderMode", "3d");
        setUse3dRender(true);
        return;
      }
      setUse3dRender(v === "3d");
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem("mmid.renderMode", use3dRender ? "3d" : "2d");
    } catch {
      // ignore
    }
  }, [use3dRender]);

  useEffect(() => {
    setImgError(false);
    setSkinLoaded(false);
    setCopied(false);
    setEditMode(false);
    setEditConfidence(entry?.confidenceScore ?? 0);
    setShowAttachments(false);
    setStatsTab("overall");
    setShowAllSkins(false);
    setShowAllCapes(false);
    setDetailTab("overview");
    setCosmeticsSource("all");
    setCosmeticsPreview(null);
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
  const uuidShort = `${uuidDashed.slice(0, 4)}...${uuidDashed.slice(-4)}`;

  const fullBodyPrimary = `https://visage.surgeplay.com/full/256/${uuidPlain}.png`;
  const fullBodyFallback = `https://mc-heads.net/body/${uuidPlain}/256`;
  const imgSrc = imgError ? fullBodyFallback : fullBodyPrimary;

  const stats: DirectoryMmStats | null = entry.hypixelStats?.mmStats ?? null;

  const skinHistory = entry.skinHistory ?? [];
  const mojangCapeHistory = entry.mojangCapeHistory ?? [];
  const optifineCapeHistory = entry.optifineCapeHistory ?? [];
  const hasCosmetics = skinHistory.length > 0 || mojangCapeHistory.length > 0 || optifineCapeHistory.length > 0;

  // Prefer cached skin/cape textures when available for 3D viewing.
  // Avoid third-party skin providers as they can intermittently error (e.g. Cloudflare 521).
  // Fall back to same-origin API routes backed by Mojang sessionserver + textures.minecraft.net.
  const skinTextureUrl = skinHistory[0]?.url ?? `/api/minecraft/skin?uuid=${encodeURIComponent(uuidPlain)}`;
  const capeTextureUrl =
    mojangCapeHistory[0]?.url ??
    optifineCapeHistory[0]?.url ??
    `/api/minecraft/cape?uuid=${encodeURIComponent(uuidPlain)}`;
  const previewSkinUrl = cosmeticsPreview?.skinUrl ?? skinTextureUrl;
  const previewCapeUrl = cosmeticsPreview?.capeUrl ?? capeTextureUrl;
  const previewSourceLabel = cosmeticsPreview?.sourceLabel ?? "Current loadout";

  const formatNum = (v: number | null | undefined) => (v == null ? "-" : v.toLocaleString("en-US"));
  const formatKdr = (v: number | null | undefined) => (v == null ? "-" : v.toFixed(2));
  const formatRatio = (v: number | null | undefined) => (v == null ? "-" : v.toFixed(2));
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

  const copyToClipboard = async (value: string) => {
    try {
      await navigator.clipboard.writeText(value);
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
  const cheatingTags = entry.typeOfCheating ?? [];
  const behaviorTags = entry.redFlags ?? [];
  const confidenceValue = Math.max(0, Math.min(5, Number(entry.confidenceScore ?? 0)));

  return (
    <div
      ref={cardRef}
      className={
        "flex h-full flex-col gap-4 rounded-xl p-3 shadow-sm " +
        (canEdit && editMode
          ? "border-amber-400/80 bg-amber-950/25 shadow-[0_0_0_1px_rgba(251,191,36,0.25),0_0_50px_rgba(251,191,36,0.12)]"
          : "bg-transparent")
      }
    >
      <div className="sticky top-0 z-20 space-y-3 rounded-xl border border-slate-800/70 px-4 py-3 backdrop-blur mmid-surface-1">
      <div className="grid gap-3 md:grid-cols-[minmax(0,1.5fr)_minmax(0,1.5fr)] md:items-center">
        <div className="min-w-0">
          <div className="mt-0.5 mmid-label uppercase tracking-[0.2em] text-slate-500">Selected player</div>
          <div className="mt-0.5 flex min-w-0 flex-wrap items-baseline gap-x-3 gap-y-1">
            {entry.rank && renderHypixelRankTag(entry.rank, stats?.rankPlusColor, "header")}
            <div className="truncate font-minecraft text-slate-50 mmid-player-name">{entry.username}</div>
          </div>
          {entry.guild && (
            <div className="mt-1.5">
              <span
                className="inline-flex h-7 max-w-[24ch] items-center rounded-full border border-white/15 bg-white/5 px-2.5 text-[13px] font-semibold text-slate-200"
                title={entry.guild}
              >
                <span className="truncate">{entry.guild}</span>
              </span>
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-center justify-end gap-2">
          {canEdit && (
            <button
              type="button"
              onClick={() => setEditMode((v) => !v)}
              className={
                "inline-flex h-9 items-center gap-1.5 rounded-md px-3 py-1 text-[12px] font-semibold transition " +
                (editMode ? "mmid-chip-active" : "mmid-chip-soft")
              }
              title={editMode ? "Maintainer tools enabled" : "Enable maintainer tools"}
            >
              <Pencil className="h-4 w-4" />
              <span className="hidden sm:inline">Maintainer tools</span>
            </button>
          )}

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-9 rounded-full px-3 text-[12px] mmid-chip"
              >
                <MoreVertical className="h-4 w-4" />
                <span className="hidden sm:inline">Advanced Options</span>
                {copied && <Check className="h-3.5 w-3.5 text-emerald-300" />}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-60">
              <DropdownMenuLabel>Advanced Options</DropdownMenuLabel>
              <DropdownMenuSeparator />

              <DropdownMenuCheckboxItem
                checked={use3dRender}
                onCheckedChange={(v) => setUse3dRender(!!v)}
              >
                <Box className="h-4 w-4" /> 3D skin viewer
              </DropdownMenuCheckboxItem>

              <DropdownMenuSeparator />

              <DropdownMenuItem onSelect={() => void copyToClipboard(entry.username)}>
                <Copy className="h-4 w-4" /> Copy IGN
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => void copyToClipboard(uuidDashed)}>
                <Copy className="h-4 w-4" /> Copy UUID (dashed)
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => void copyToClipboard(uuidPlain)}>
                <Copy className="h-4 w-4" /> Copy UUID (plain)
              </DropdownMenuItem>

              <DropdownMenuSeparator />

              <DropdownMenuItem onSelect={() => void handleCopyCardImage()}>
                <Copy className="h-4 w-4" /> Copy card as image
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => void handleDownloadCardImage()}>
                <FileText className="h-4 w-4" /> Save card image
              </DropdownMenuItem>

              <DropdownMenuSeparator />

              <DropdownMenuItem asChild>
                <a href={`/mmid/${encodeURIComponent(entry.uuid)}`} className="flex w-full items-center gap-2">
                  <ExternalLink className="h-4 w-4" /> Open MMID profile page
                </a>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <a
                  href={`https://namemc.com/profile/${encodeURIComponent(entry.uuid)}`}
                  target="_blank"
                  rel="noreferrer"
                  className="flex w-full items-center gap-2"
                >
                  <ExternalLink className="h-4 w-4" /> NameMC
                </a>
              </DropdownMenuItem>
              <DropdownMenuItem disabled>Pin profile (coming soon)</DropdownMenuItem>

              {canEdit && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuLabel>Maintainer</DropdownMenuLabel>
                  <DropdownMenuItem asChild>
                    <form action={markEntryNeedsReview} className="w-full">
                      <input type="hidden" name="entryUuid" value={entry.uuid} />
                      <button type="submit" className="flex w-full items-center gap-2">
                        <ShieldQuestion className="h-4 w-4" /> Send to reviews
                      </button>
                    </form>
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>

          <button
            type="button"
            onClick={() => void copyToClipboard(uuidDashed)}
            className="inline-flex h-9 w-9 items-center justify-center rounded-full mmid-chip"
            title={`Copy UUID (${uuidShort})`}
          >
            <Copy className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-5 border-b border-slate-800/70 px-1 pb-2.5 pt-1.5">
        {[
          { id: "overview", label: "Overview" },
          { id: "mmid", label: "MMID Review" },
          { id: "stats", label: "Stats" },
          { id: "usernames", label: "Usernames" },
          { id: "cosmetics", label: "Cosmetics" },
        ].map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setDetailTab(t.id as typeof detailTab)}
            className={`relative pb-2 font-semibold tracking-wide transition mmid-tab-text ${
              detailTab === t.id
                ? "text-amber-100 after:absolute after:bottom-0 after:left-0 after:right-0 after:h-0.5 after:bg-amber-400"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>
      </div>

      {/* Top row: identity / stats+review */}
      {(detailTab === "overview" || detailTab === "mmid") && (
      <div
        className={`grid gap-5 md:items-stretch ${
          detailTab === "overview" ? "md:grid-cols-[340px_minmax(0,1fr)]" : "md:grid-cols-12"
        }`}
      >
        {detailTab !== "mmid" && (
        <div
          className="space-y-2"
        >
          <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Identity</div>
          <Card className="flex-shrink-0 border-0 bg-transparent shadow-none">
          <CardContent className="flex h-full flex-col items-center px-0 pb-0 pt-0">
            <div className="flex w-full flex-col items-center rounded-2xl bg-slate-950/80 pb-3 pt-2 shadow-[0_0_40px_rgba(0,0,0,0.85)]">
              {use3dRender ? (
                <MinecraftSkinViewer3D
                  skinUrl={skinTextureUrl}
                  capeUrl={capeTextureUrl}
                  className="h-[26rem] w-full max-w-[22rem]"
                />
              ) : (
                <div className="relative">
                  <div
                    className={
                      "pointer-events-none absolute inset-0 rounded-lg border border-white/10 bg-slate-900/40 " +
                      (!skinLoaded ? "animate-pulse" : "")
                    }
                    aria-hidden="true"
                  />

                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={imgSrc}
                    alt={`${entry.username} full skin`}
                    className="h-80 w-auto -mt-2 object-contain"
                    style={skinLoaded ? undefined : { opacity: 0 }}
                    onLoad={() => setSkinLoaded(true)}
                    onError={() => {
                      setSkinLoaded(false);
                      setImgError(true);
                    }}
                  />

                  {!skinLoaded && (
                    <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-2 text-[11px] text-slate-200">
                      <div className="h-6 w-6 animate-spin rounded-full border-2 border-slate-200/60 border-t-transparent" />
                      <div className="text-slate-300">Loading render…</div>
                    </div>
                  )}
                </div>
              )}
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

              {hasCosmetics && detailTab === "overview" && (
                <div className="mt-3 w-full px-4">
                  <button
                    type="button"
                    onClick={() => setDetailTab("cosmetics")}
                    className="w-full rounded-lg border border-slate-700/80 bg-slate-900/80 px-3 py-1.5 text-[11px] uppercase tracking-[0.18em] text-slate-200 hover:border-amber-400/70 hover:text-amber-100"
                  >
                    Open cosmetics tab
                  </button>
                </div>
              )}

              {!hasCosmetics && (
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
        </div>
        )}

        <div className={`${detailTab === "mmid" ? "md:col-span-12" : detailTab === "overview" ? "" : "md:col-span-9"} flex flex-col gap-5`}>
          <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
            {detailTab === "mmid" ? "MMID Review" : "Overview"}
          </div>
          {detailTab !== "mmid" && (
          <div className="rounded-lg border p-6 text-sm shadow-sm mmid-surface-1">
            <h3 className="mb-4 text-lg font-semibold uppercase tracking-wide text-slate-100">Hypixel snapshot</h3>
            {stats ? (
              <div className="grid grid-cols-[8.5rem_minmax(0,1fr)] gap-x-4 gap-y-2.5 text-[13px]">
                <div className="text-[12px] text-slate-500">Network level</div>
                <div className="font-semibold text-emerald-200">
                  {stats.networkLevel != null ? stats.networkLevel.toFixed(2) : "-"}
                </div>
                <div className="text-[12px] text-slate-500">Achievement points</div>
                <div className="font-semibold text-sky-200">{formatNum(stats.achievementPoints)}</div>
                <div className="text-[12px] text-slate-500">Karma</div>
                <div className="font-semibold text-violet-200">{formatNum(stats.karma)}</div>
              </div>
            ) : (
              <div className="text-[12px] text-slate-400">No Hypixel summary stats cached yet.</div>
            )}
            <div className="mt-5 border-t border-slate-800/80 pt-3.5">
              <button
                type="button"
                onClick={() => setDetailTab("stats")}
                className="rounded-full px-3 py-1 text-[11px] font-semibold mmid-chip-soft"
              >
                View full stats →
              </button>
            </div>
          </div>
          )}

          {detailTab === "overview" && (
            <div className="rounded-lg border p-6 text-sm shadow-sm mmid-surface-1">
              <h3 className="mb-3 text-base font-semibold uppercase tracking-wide text-slate-100">Verdict</h3>
              <div className="mb-3 flex flex-wrap items-center gap-3">
                <span className="text-[11px] uppercase tracking-wide text-slate-400">Status</span>
                <span className={`inline-flex h-7 items-center rounded-full px-3 text-[12px] font-semibold ${statusTone(entry.status)}`}>
                  {entry.status || "Not set"}
                </span>
              </div>
              <div className="mb-3 flex items-center gap-2">
                <span className="text-[10px] uppercase tracking-wide text-slate-500">Confidence</span>
                <Stars n={entry.confidenceScore ?? 0} />
              </div>
              <div className="mb-3 flex flex-wrap gap-2">
                {[...(entry.typeOfCheating ?? []), ...(entry.redFlags ?? [])].slice(0, 2).map((t, i) => (
                  <span key={`overview-tag-${i}`} className={`inline-flex h-6 items-center rounded-full px-2 text-[11px] font-semibold ${behaviorTagTone(t)}`}>
                    {t}
                  </span>
                ))}
                {[...(entry.typeOfCheating ?? []), ...(entry.redFlags ?? [])].length > 2 && (
                  <span className="inline-flex h-6 items-center rounded-full border border-slate-500/55 bg-slate-700/25 px-2 text-[11px] font-semibold text-slate-100">
                    +{[...(entry.typeOfCheating ?? []), ...(entry.redFlags ?? [])].length - 2} more
                  </span>
                )}
                {(!entry.typeOfCheating?.length && !entry.redFlags?.length) && (
                  <span className="text-[11px] text-slate-500">No tags recorded</span>
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setDetailTab("mmid")}
                  className="rounded-full px-3 py-1 text-[11px] font-semibold mmid-chip-soft"
                >
                  Open MMID Review →
                </button>
                <button
                  type="button"
                  onClick={() => setDetailTab("usernames")}
                  className="rounded-full px-3 py-1 text-[11px] font-semibold mmid-chip"
                >
                  Open Usernames
                </button>
              </div>
            </div>
          )}

          {/* MMID Info (right of render) */}
          {detailTab === "mmid" && (
          <div
            className={
              "rounded-lg border p-4 text-sm shadow-sm " +
              (canEdit && editMode
                ? "border-amber-400/70 bg-[rgba(251,191,36,0.08)] shadow-[0_0_0_1px_rgba(251,191,36,0.28)]"
                : "mmid-surface-1")
            }
          >
            <h3 className="mb-3 text-base font-semibold uppercase tracking-wide text-slate-100">MMID Info</h3>

          {!canEdit || !editMode ? (
            <div className="grid grid-cols-12 gap-5">
              <div className="col-span-12 space-y-4 lg:col-span-4">
                <div className="rounded-lg border border-slate-700/70 bg-slate-950/65 p-5">
                  <div className="text-[11px] uppercase tracking-[0.16em] text-slate-400">Review summary</div>

                  <div className="mt-3 flex flex-wrap items-center gap-3">
                    <span
                      className={`inline-flex h-8 items-center rounded-full px-3 text-[12px] font-semibold ${statusTone(
                        entry.status,
                      )}`}
                    >
                      {entry.status || "Unverified"}
                    </span>

                    <div className="inline-flex items-center gap-2 rounded-full border border-slate-700 bg-slate-900/80 px-3 py-1">
                      <Stars n={confidenceValue} />
                      <span className="text-[11px] font-semibold text-slate-200">{confidenceValue.toFixed(1)}/5</span>
                    </div>
                  </div>

                  <div className="my-4 border-t border-slate-800/80" />

                  <div className="space-y-1.5 text-[12px] text-slate-300">
                    <div>
                      <span className="text-[11px] uppercase tracking-[0.14em] text-slate-500">Reviewed by</span>
                    </div>
                    <div className="font-medium text-slate-100">{entry.reviewedBy || "Unassigned"}</div>
                    <div className="text-[11px] text-slate-500">MMID review metadata</div>
                  </div>
                </div>
              </div>

              <div className="col-span-12 space-y-4 lg:col-span-8">
                <div className="rounded-lg border border-slate-700/70 bg-slate-950/65 p-5">
                  <div className="text-[11px] uppercase tracking-[0.16em] text-slate-400">Cheating tags</div>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {cheatingTags.slice(0, 8).map((t, i) => (
                      <span
                        key={`tc-info-${i}`}
                        className="rounded-full border border-rose-400/35 bg-rose-900/25 px-2 py-0.5 text-[11px] font-semibold text-rose-100"
                      >
                        {t}
                      </span>
                    ))}
                    {cheatingTags.length > 8 && (
                      <span className="rounded-full border border-slate-600 bg-slate-800/50 px-2 py-0.5 text-[11px] text-slate-200">
                        +{cheatingTags.length - 8} more
                      </span>
                    )}
                    {cheatingTags.length === 0 && <span className="text-[11px] text-slate-500">None</span>}
                  </div>

                  <div className="my-4 border-t border-slate-800/80" />

                  <div className="text-[11px] uppercase tracking-[0.16em] text-slate-400">Behavior tags</div>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {behaviorTags.slice(0, 8).map((t, i) => (
                      <span
                        key={`rf-info-${i}`}
                        className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${behaviorTagTone(t)}`}
                      >
                        {t}
                      </span>
                    ))}
                    {behaviorTags.length > 8 && (
                      <span className="rounded-full border border-slate-600 bg-slate-800/50 px-2 py-0.5 text-[11px] text-slate-200">
                        +{behaviorTags.length - 8} more
                      </span>
                    )}
                    {behaviorTags.length === 0 && <span className="text-[11px] text-slate-500">None</span>}
                  </div>
                </div>

                <div className="rounded-lg border border-slate-700/70 bg-slate-950/65 p-5">
                  <div className="text-[11px] uppercase tracking-[0.16em] text-slate-400">Notes & evidence</div>
                  <div className="mt-2 max-h-44 overflow-y-auto whitespace-pre-line text-[12px] leading-relaxed text-slate-200">
                    {notesSection.trim() ? notesSection : <span className="text-slate-500">No notes yet.</span>}
                  </div>

                  {attachmentLines.length > 0 && (
                    <div className="mt-3 border-t border-slate-800/80 pt-3 text-[11px] text-slate-300">
                      <button
                        type="button"
                        onClick={() => setShowAttachments((v) => !v)}
                        className="rounded-full px-2 py-0.5 text-[11px] mmid-chip"
                      >
                        {showAttachments
                          ? `Hide evidence links (${attachmentLines.length})`
                          : `Show evidence links (${attachmentLines.length})`}
                      </button>
                      {showAttachments && (
                        <ul className="mt-2 space-y-1">
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
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex flex-wrap justify-end gap-2">
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

                <form action={refreshMinecraftProfile} className="inline-flex">
                  <input type="hidden" name="entryUuid" value={entry.uuid} />
                  <Button
                    type="submit"
                    size="sm"
                    className="inline-flex items-center gap-1 rounded-full border border-sky-400/70 bg-sky-600 px-3 py-1 text-[11px] font-semibold text-white shadow-sm hover:bg-sky-500 hover:border-sky-300"
                  >
                    <RefreshCw className="h-3.5 w-3.5" />
                    <span>Refresh skin/cape</span>
                  </Button>
                </form>
              </div>

              <form action={upsertEntry} className="space-y-3">
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
                    className="h-8 rounded border border-slate-600/80 bg-slate-900/70 px-2 text-[12px] text-slate-100"
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
                      className="h-8 rounded border border-slate-600/80 bg-slate-900/70 px-2 text-[12px] text-slate-100 placeholder:text-slate-400"
                      placeholder="Leave blank to use your account name"
                    />
                  </label>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[10px] uppercase tracking-wide text-slate-300">Confidence</span>
                    <input type="hidden" name="confidenceScore" value={editConfidence} />
                    <Stars n={editConfidence} editable onChange={(v) => setEditConfidence(v)} />
                    <span className="text-[11px] text-slate-300">{editConfidence}/5</span>
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
                              : "border-slate-500/50 bg-slate-900/70 text-slate-100 hover:border-amber-400/60"
                          }`}
                        >
                          <input
                            type="checkbox"
                            name="typeOfCheating"
                            value={opt}
                            defaultChecked={checked}
                            className="h-3 w-3 rounded border-slate-500 bg-transparent text-amber-400 focus:ring-0"
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
                    className="mt-0.5 w-full resize-y rounded border border-slate-600/80 bg-slate-900/70 px-2 py-1.5 text-[12px] text-slate-100"
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
            </div>
          )}
        </div>
        )}
        </div>
      </div>
      )}

      {detailTab === "cosmetics" && (
      <div className="rounded-xl border border-slate-800/80 p-4 text-xs text-slate-100 shadow-[0_0_40px_rgba(0,0,0,0.75)] mmid-surface-1">
        <div className="mb-2 flex items-start justify-between gap-3">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-300/90">Cosmetics</div>
            <div className="mt-1 text-[12px] text-slate-400">Current loadout and cached skin/cape history</div>
          </div>
        </div>

        <div className="mt-3 grid gap-4 lg:grid-cols-[340px_minmax(0,1fr)] lg:items-start">
          <div className="lg:sticky lg:top-4 rounded-lg border border-white/10 bg-black/35 p-3">
            <div className="mb-2 flex items-center justify-between gap-2">
              <div className="text-[10px] uppercase tracking-wide text-slate-300">Live model preview</div>
              <span className="rounded-full border border-slate-700 bg-slate-900/80 px-2 py-0.5 text-[10px] text-slate-200">
                {previewSourceLabel}
              </span>
            </div>
            <MinecraftSkinViewer3D
              skinUrl={previewSkinUrl}
              capeUrl={previewCapeUrl}
              className="h-[20rem] w-full"
            />
            <div className="mt-2 text-[10px] text-slate-400">
              Hover any skin/cape tile to update this model. The last hovered cosmetic stays active.
            </div>

            {/* Current cosmetics (stacked under model) */}
            <div className="mt-3 space-y-3 border-t border-slate-800/70 pt-3">
              <div className="rounded-lg border border-white/10 bg-black/30 p-3">
                <div className="mb-2 flex items-center justify-between">
                  <div className="text-[10px] uppercase tracking-wide text-slate-300">Current skin</div>
                  <span className="rounded-full border border-slate-600 bg-slate-900/80 px-2 py-0.5 text-[10px] text-slate-200">Cached</span>
                </div>
                <div className="flex items-center gap-3">
                  <CosmeticPreviewTile
                    label="Cached"
                    imgSrc={skinHistory[0]?.url ?? skinTextureUrl}
                    alt="Current skin"
                    textureType="skin"
                    isActive={previewSkinUrl === (skinHistory[0]?.url ?? skinTextureUrl)}
                    onHover={() =>
                      setCosmeticsPreview({
                        skinUrl: skinHistory[0]?.url ?? skinTextureUrl,
                        capeUrl: mojangCapeHistory[0]?.url ?? optifineCapeHistory[0]?.url ?? capeTextureUrl,
                        sourceLabel: "Current skin",
                      })
                    }
                    onView={() => setUse3dRender(true)}
                    onCopyUrl={() => void copyToClipboard(skinHistory[0]?.url ?? skinTextureUrl)}
                    onOpen={() => window.open(skinHistory[0]?.url ?? skinTextureUrl, "_blank", "noopener,noreferrer")}
                  />
                  <div className="space-y-1">
                    <button
                      type="button"
                      onClick={() => setUse3dRender(true)}
                      className="rounded-full px-2.5 py-1 text-[10px] font-semibold mmid-chip-soft"
                    >
                      View in 3D
                    </button>
                    {skinHistory[0]?.url && (
                      <button
                        type="button"
                        onClick={() => void copyToClipboard(skinHistory[0]!.url)}
                        className="rounded-full px-2.5 py-1 text-[10px] font-semibold mmid-chip"
                      >
                        Copy URL
                      </button>
                    )}
                  </div>
                </div>
                <div className="mt-2 text-[10px] text-slate-400">
                  Last changed: {skinHistory[0]?.fetchedAt ? new Date(skinHistory[0].fetchedAt).toLocaleString() : "Unknown"}
                </div>
              </div>

              <div className="rounded-lg border border-white/10 bg-black/30 p-3">
                <div className="mb-2 flex items-center justify-between">
                  <div className="text-[10px] uppercase tracking-wide text-slate-300">Current cape</div>
                  <span className="rounded-full border border-cyan-500/40 bg-cyan-950/30 px-2 py-0.5 text-[10px] text-cyan-200">Mojang</span>
                </div>
                {mojangCapeHistory[0]?.url ? (
                  <>
                    <CosmeticPreviewTile
                      label="Mojang"
                      imgSrc={mojangCapeHistory[0].url}
                      alt="Current Mojang cape"
                      isActive={previewCapeUrl === mojangCapeHistory[0].url}
                      onHover={() =>
                        setCosmeticsPreview({
                          skinUrl: skinTextureUrl,
                          capeUrl: mojangCapeHistory[0]?.url ?? null,
                          sourceLabel: "Current Mojang cape",
                        })
                      }
                      onView={() => setUse3dRender(true)}
                      onCopyUrl={() => void copyToClipboard(mojangCapeHistory[0]!.url)}
                      onOpen={() => window.open(mojangCapeHistory[0]!.url, "_blank", "noopener,noreferrer")}
                    />
                    <div className="mt-2 flex gap-1.5">
                      <a href={mojangCapeHistory[0].url} target="_blank" rel="noreferrer" className="rounded-full px-2.5 py-1 text-[10px] font-semibold mmid-chip-soft">View</a>
                      <button type="button" onClick={() => void copyToClipboard(mojangCapeHistory[0]!.url)} className="rounded-full px-2.5 py-1 text-[10px] font-semibold mmid-chip">Copy URL</button>
                    </div>
                    <div className="mt-2 text-[10px] text-slate-400">Last changed: {new Date(mojangCapeHistory[0].fetchedAt).toLocaleString()}</div>
                  </>
                ) : (
                  <div className="rounded border border-dashed border-slate-700 bg-slate-950/70 px-2.5 py-3 text-[11px] text-slate-400">No Mojang cape found.</div>
                )}
              </div>

              <div className="rounded-lg border border-white/10 bg-black/30 p-3">
                <div className="mb-2 flex items-center justify-between">
                  <div className="text-[10px] uppercase tracking-wide text-slate-300">Current OF cape</div>
                  <span className="rounded-full border border-fuchsia-500/40 bg-fuchsia-950/30 px-2 py-0.5 text-[10px] text-fuchsia-200">OptiFine</span>
                </div>
                {optifineCapeHistory[0]?.url ? (
                  <>
                    <CosmeticPreviewTile
                      label="OptiFine"
                      imgSrc={optifineCapeHistory[0].url}
                      alt="Current OptiFine cape"
                      isActive={previewCapeUrl === optifineCapeHistory[0].url}
                      onHover={() =>
                        setCosmeticsPreview({
                          skinUrl: skinTextureUrl,
                          capeUrl: optifineCapeHistory[0]?.url ?? null,
                          sourceLabel: "Current OptiFine cape",
                        })
                      }
                      onView={() => setUse3dRender(true)}
                      onCopyUrl={() => void copyToClipboard(optifineCapeHistory[0]!.url)}
                      onOpen={() => window.open(optifineCapeHistory[0]!.url, "_blank", "noopener,noreferrer")}
                    />
                    <div className="mt-2 flex gap-1.5">
                      <a href={optifineCapeHistory[0].url} target="_blank" rel="noreferrer" className="rounded-full px-2.5 py-1 text-[10px] font-semibold mmid-chip-soft">View</a>
                      <button type="button" onClick={() => void copyToClipboard(optifineCapeHistory[0]!.url)} className="rounded-full px-2.5 py-1 text-[10px] font-semibold mmid-chip">Copy URL</button>
                    </div>
                    <div className="mt-2 text-[10px] text-slate-400">Last changed: {new Date(optifineCapeHistory[0].fetchedAt).toLocaleString()}</div>
                  </>
                ) : (
                  <div className="rounded border border-dashed border-slate-700 bg-slate-950/70 px-2.5 py-3 text-[11px] text-slate-400">No OptiFine cape found.</div>
                )}
              </div>
            </div>
          </div>

          <div>
        {/* Provider filters */}
        <div className="flex flex-wrap gap-1.5 border-t border-slate-800/70 pt-3">
          {[
            { id: "all", label: "All" },
            { id: "mojang", label: "Mojang" },
            { id: "optifine", label: "OptiFine" },
            { id: "lunar", label: "Lunar" },
            { id: "badlion", label: "Badlion" },
          ].map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => setCosmeticsSource(s.id as typeof cosmeticsSource)}
              className={`rounded-full px-3 py-1 text-[11px] font-semibold ${cosmeticsSource === s.id ? "mmid-chip-active" : "mmid-chip"}`}
            >
              {s.label}
            </button>
          ))}
        </div>

        {/* Skin history */}
        {(cosmeticsSource === "all" || cosmeticsSource === "mojang") && (
          <div className="mt-4 rounded-lg border border-white/10 bg-black/20 p-3">
            <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-200">Skin history</div>
            {skinHistory.length > 0 ? (
              <div className="grid grid-cols-[repeat(auto-fill,minmax(72px,72px))] gap-3">
                {skinHistory.map((item, idx) => (
                  <CosmeticPreviewTile
                    key={`${item.url}-${idx}`}
                    label="Skin"
                    imgSrc={item.url}
                    alt={`Skin ${idx + 1}`}
                    textureType="skin"
                    size={72}
                    isActive={previewSkinUrl === item.url}
                    onHover={() =>
                      setCosmeticsPreview({
                        skinUrl: item.url,
                        capeUrl: mojangCapeHistory[0]?.url ?? optifineCapeHistory[0]?.url ?? capeTextureUrl,
                        sourceLabel: `Skin history #${idx + 1}`,
                      })
                    }
                    onView={() => setUse3dRender(true)}
                    onCopyUrl={() => void copyToClipboard(item.url)}
                    onOpen={() => window.open(item.url, "_blank", "noopener,noreferrer")}
                    footer={new Date(item.fetchedAt).toLocaleDateString()}
                  />
                ))}
              </div>
            ) : (
              <div className="rounded border border-dashed border-slate-700 bg-slate-950/70 px-3 py-4 text-[11px] text-slate-400">No skin history cached yet.</div>
            )}
          </div>
        )}

        {/* Cape history */}
        {(cosmeticsSource === "all" || cosmeticsSource === "mojang") && (
          <div className="mt-4 rounded-lg border border-white/10 bg-black/20 p-3">
            <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-cyan-200">Minecraft capes</div>
            {mojangCapeHistory.length > 0 ? (
              <div className="grid grid-cols-[repeat(auto-fill,minmax(72px,72px))] gap-3">
                {mojangCapeHistory.map((item, idx) => (
                  <CosmeticPreviewTile
                    key={`${item.url}-${idx}`}
                    label="Mojang"
                    imgSrc={item.url}
                    alt={`Mojang cape ${idx + 1}`}
                    size={72}
                    isActive={previewCapeUrl === item.url}
                    onHover={() =>
                      setCosmeticsPreview({
                        skinUrl: skinTextureUrl,
                        capeUrl: item.url,
                        sourceLabel: `Mojang cape #${idx + 1}`,
                      })
                    }
                    onView={() => setUse3dRender(true)}
                    onCopyUrl={() => void copyToClipboard(item.url)}
                    onOpen={() => window.open(item.url, "_blank", "noopener,noreferrer")}
                    footer={new Date(item.fetchedAt).toLocaleDateString()}
                  />
                ))}
              </div>
            ) : (
              <div className="rounded border border-dashed border-slate-700 bg-slate-950/70 px-3 py-4 text-[11px] text-slate-400">No Mojang cape history cached yet.</div>
            )}
          </div>
        )}

        {(cosmeticsSource === "all" || cosmeticsSource === "optifine") && (
          <div className="mt-4 rounded-lg border border-white/10 bg-black/20 p-3">
            <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-fuchsia-200">OptiFine capes</div>
            {optifineCapeHistory.length > 0 ? (
              <div className="grid grid-cols-[repeat(auto-fill,minmax(72px,72px))] gap-3">
                {optifineCapeHistory.map((item, idx) => (
                  <CosmeticPreviewTile
                    key={`${item.url}-${idx}`}
                    label="OptiFine"
                    imgSrc={item.url}
                    alt={`OptiFine cape ${idx + 1}`}
                    size={72}
                    isActive={previewCapeUrl === item.url}
                    onHover={() =>
                      setCosmeticsPreview({
                        skinUrl: skinTextureUrl,
                        capeUrl: item.url,
                        sourceLabel: `OptiFine cape #${idx + 1}`,
                      })
                    }
                    onView={() => setUse3dRender(true)}
                    onCopyUrl={() => void copyToClipboard(item.url)}
                    onOpen={() => window.open(item.url, "_blank", "noopener,noreferrer")}
                    footer={new Date(item.fetchedAt).toLocaleDateString()}
                  />
                ))}
              </div>
            ) : (
              <div className="rounded border border-dashed border-slate-700 bg-slate-950/70 px-3 py-4 text-[11px] text-slate-400">No OptiFine cape history cached yet.</div>
            )}
          </div>
        )}

        {(cosmeticsSource === "lunar" || cosmeticsSource === "badlion") && (
          <div className="mt-4 rounded border border-dashed border-slate-700 bg-slate-950/70 px-3 py-4 text-[11px] text-slate-400">
            {cosmeticsSource === "lunar" ? "Lunar cosmetics support is planned." : "Badlion cosmetics support is planned."}
          </div>
        )}
          </div>
        </div>
      </div>
      )}

      {/* MM Stats (bottom) */}
      {detailTab === "stats" && (
      <div className="rounded-xl border border-emerald-400/40 bg-gradient-to-br from-[#02100f] via-[#020c1b] to-[#000814] p-4 text-xs text-slate-100 shadow-[0_0_40px_rgba(0,0,0,0.9)]">
        <div className="mb-2 flex items-start justify-between gap-3">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-emerald-300/80">
              MM Stats
            </div>
            <div className="mt-1 text-[12px] text-emerald-100">Classic · Double Up · Infection · Assassins</div>
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

            {/* KPI strip */}
            <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
              <div className="rounded-lg border border-emerald-500/25 bg-black/35 px-3 py-2">
                <div className="text-[10px] uppercase tracking-wide text-emerald-300/80">Wins</div>
                <div className="mt-1 text-xl font-semibold text-emerald-200">{formatNum(stats.wins)}</div>
              </div>
              <div className="rounded-lg border border-orange-500/25 bg-black/35 px-3 py-2">
                <div className="text-[10px] uppercase tracking-wide text-orange-300/80">KDR</div>
                <div className="mt-1 text-xl font-semibold text-orange-200">{formatKdr(stats.kdr)}</div>
              </div>
              <div className="rounded-lg border border-cyan-500/25 bg-black/35 px-3 py-2">
                <div className="text-[10px] uppercase tracking-wide text-cyan-300/80">WLR</div>
                <div className="mt-1 text-xl font-semibold text-cyan-200">
                  {formatRatio(
                    stats.wins == null || stats.gamesPlayed == null
                      ? null
                      : stats.wins / Math.max(1, stats.gamesPlayed - stats.wins),
                  )}
                </div>
              </div>
              <div className="rounded-lg border border-sky-500/25 bg-black/35 px-3 py-2">
                <div className="text-[10px] uppercase tracking-wide text-sky-300/80">Games</div>
                <div className="mt-1 text-xl font-semibold text-sky-200">{formatNum(stats.gamesPlayed)}</div>
              </div>
              <div className="rounded-lg border border-yellow-500/25 bg-black/35 px-3 py-2">
                <div className="text-[10px] uppercase tracking-wide text-yellow-300/80">Coins</div>
                <div className="mt-1 text-xl font-semibold text-yellow-200">{formatNum(stats.tokens)}</div>
              </div>
            </div>

            {/* Tab content - renders different stats based on active tab */}
            {statsTab === "overall" && (
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
                    <div className="text-slate-300">Bow kills</div>
                    <div className="text-right font-semibold text-emerald-200">{formatNum(stats.bowKillsTotal ?? stats.bowKills)}</div>
                  </div>
                </div>
              </div>                  
            )}

            {/* CLASSIC MODE TAB */}
            {statsTab === "classic" && (
              <div className="mt-3 grid gap-3 text-[13px] sm:grid-cols-2 lg:grid-cols-3">
                {stats.classic ? (
                  <>
                    <div className="rounded-lg bg-black/40 px-3 py-2">
                      <div className="text-[10px] uppercase tracking-wide text-emerald-300/80">Classic Mode</div>
                      <div className="mt-1 grid grid-cols-2 gap-x-3 gap-y-1">
                        <div className="text-slate-300">Wins</div>
                        <div className="text-right font-semibold text-emerald-200">{formatNum(stats.classic.wins)}</div>
                        <div className="text-slate-300">Kills</div>
                        <div className="text-right font-semibold text-emerald-200">{formatNum(stats.classic.kills)}</div>
                        <div className="text-slate-300">Deaths</div>
                        <div className="text-right font-semibold text-rose-200">{formatNum(stats.classic.deaths)}</div>
                        <div className="text-slate-300">KDR</div>
                        <div className="text-right font-semibold text-orange-200">{formatKdr(stats.classic.kdr)}</div>
                        <div className="text-slate-300">Games played</div>
                        <div className="text-right font-semibold text-sky-200">{formatNum(stats.classic.gamesPlayed)}</div>
                      </div>
                    </div>

                    <div className="rounded-lg bg-black/40 px-3 py-2">
                      <div className="text-[10px] uppercase tracking-wide text-emerald-300/80">Role wins</div>
                      <div className="mt-1 grid grid-cols-2 gap-x-3 gap-y-1">
                        <div className="text-slate-300">Murderer wins</div>
                        <div className="text-right font-semibold text-rose-200">{formatNum(stats.classic.murdererWins)}</div>
                        <div className="text-slate-300">Detective wins</div>
                        <div className="text-right font-semibold text-cyan-200">{formatNum(stats.classic.detectiveWins)}</div>
                        <div className="text-slate-300">Hero wins</div>
                        <div className="text-right font-semibold text-yellow-200">{formatNum(stats.classic.heroWins)}</div>
                      </div>
                    </div>

                    <div className="rounded-lg bg-black/40 px-3 py-2">
                      <div className="text-[10px] uppercase tracking-wide text-emerald-300/80">Kill breakdown</div>
                      <div className="mt-1 grid grid-cols-2 gap-x-3 gap-y-1">
                        <div className="text-slate-300">Kills as murderer</div>
                        <div className="text-right font-semibold text-rose-200">{formatNum(stats.classic.killsAsMurderer)}</div>
                        <div className="text-slate-300">Bow kills</div>
                        <div className="text-right font-semibold text-emerald-200">{formatNum(stats.classic.bowKills)}</div>
                        <div className="text-slate-300">Trap kills</div>
                        <div className="text-right font-semibold text-amber-200">{formatNum(stats.classic.trapKills)}</div>
                        <div className="text-slate-300">Thrown knife kills</div>
                        <div className="text-right font-semibold text-rose-200">{formatNum(stats.classic.thrownKnifeKills)}</div>
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="col-span-full rounded-lg border border-dashed border-emerald-500/30 bg-black/20 p-6 text-center">
                    <p className="text-sm text-slate-300">No Classic mode data available for this player.</p>
                    <p className="mt-1 text-[11px] text-slate-400">They may not have played this mode yet.</p>
                  </div>
                )}
              </div>
            )}

            {/* DOUBLE UP MODE TAB */}
            {statsTab === "double" && (
              <div className="mt-3 grid gap-3 text-[13px] sm:grid-cols-2 lg:grid-cols-3">
                {stats.doubleUp ? (
                  <>
                    <div className="rounded-lg bg-black/40 px-3 py-2">
                      <div className="text-[10px] uppercase tracking-wide text-emerald-300/80">Double Up Mode</div>
                      <div className="mt-1 grid grid-cols-2 gap-x-3 gap-y-1">
                        <div className="text-slate-300">Wins</div>
                        <div className="text-right font-semibold text-emerald-200">{formatNum(stats.doubleUp.wins)}</div>
                        <div className="text-slate-300">Kills</div>
                        <div className="text-right font-semibold text-emerald-200">{formatNum(stats.doubleUp.kills)}</div>
                        <div className="text-slate-300">Deaths</div>
                        <div className="text-right font-semibold text-rose-200">{formatNum(stats.doubleUp.deaths)}</div>
                        <div className="text-slate-300">KDR</div>
                        <div className="text-right font-semibold text-orange-200">{formatKdr(stats.doubleUp.kdr)}</div>
                        <div className="text-slate-300">Games played</div>
                        <div className="text-right font-semibold text-sky-200">{formatNum(stats.doubleUp.gamesPlayed)}</div>
                      </div>
                    </div>

                    <div className="rounded-lg bg-black/40 px-3 py-2">
                      <div className="text-[10px] uppercase tracking-wide text-emerald-300/80">Role wins</div>
                      <div className="mt-1 grid grid-cols-2 gap-x-3 gap-y-1">
                        <div className="text-slate-300">Murderer wins</div>
                        <div className="text-right font-semibold text-rose-200">{formatNum(stats.doubleUp.murdererWins)}</div>
                        <div className="text-slate-300">Detective wins</div>
                        <div className="text-right font-semibold text-cyan-200">{formatNum(stats.doubleUp.detectiveWins)}</div>
                        <div className="text-slate-300">Hero wins</div>
                        <div className="text-right font-semibold text-yellow-200">{formatNum(stats.doubleUp.heroWins)}</div>
                      </div>
                    </div>

                    <div className="rounded-lg bg-black/40 px-3 py-2">
                      <div className="text-[10px] uppercase tracking-wide text-emerald-300/80">Kill breakdown</div>
                      <div className="mt-1 grid grid-cols-2 gap-x-3 gap-y-1">
                        <div className="text-slate-300">Kills as murderer</div>
                        <div className="text-right font-semibold text-rose-200">{formatNum(stats.doubleUp.killsAsMurderer)}</div>
                        <div className="text-slate-300">Bow kills</div>
                        <div className="text-right font-semibold text-emerald-200">{formatNum(stats.doubleUp.bowKills)}</div>
                        <div className="text-slate-300">Trap kills</div>
                        <div className="text-right font-semibold text-amber-200">{formatNum(stats.doubleUp.trapKills)}</div>
                        <div className="text-slate-300">Thrown knife kills</div>
                        <div className="text-right font-semibold text-rose-200">{formatNum(stats.doubleUp.thrownKnifeKills)}</div>

                      </div>
                    </div>
                  </>
                ) : (
                  <div className="col-span-full rounded-lg border border-dashed border-emerald-500/30 bg-black/20 p-6 text-center">
                    <p className="text-sm text-slate-300">No Double Up mode data available for this player.</p>
                    <p className="mt-1 text-[11px] text-slate-400">They may not have played this mode yet.</p>
                  </div>
                )}
              </div>
            )}

            {/* ASSASSINS MODE TAB */}
            {statsTab === "assassins" && (
              <div className="mt-3 grid gap-3 text-[13px] sm:grid-cols-2 lg:grid-cols-3">
                {stats.assassins ? (
                  <>
                    <div className="rounded-lg bg-black/40 px-3 py-2">
                      <div className="text-[10px] uppercase tracking-wide text-purple-300/80">Assassins</div>
                      <div className="mt-1 grid grid-cols-2 gap-x-3 gap-y-1">
                        <div className="text-slate-300">Wins</div>
                        <div className="text-right font-semibold text-emerald-200">{formatNum(stats.assassins.wins)}</div>
                        <div className="text-slate-300">Kills</div>
                        <div className="text-right font-semibold text-emerald-200">{formatNum(stats.assassins.kills)}</div>
                        <div className="text-slate-300">Deaths</div>
                        <div className="text-right font-semibold text-rose-200">{formatNum(stats.assassins.deaths)}</div>
                        <div className="text-slate-300">KDR</div>
                        <div className="text-right font-semibold text-orange-200">{formatKdr(stats.assassins.kdr)}</div>
                      </div>
                    </div>

                    <div className="rounded-lg bg-black/40 px-3 py-2">
                      <div className="text-[10px] uppercase tracking-wide text-purple-300/80">Other Stats</div>
                      <div className="mt-1 grid grid-cols-2 gap-x-3 gap-y-1">
                        <div className="text-slate-300">Games played</div>
                        <div className="text-right font-semibold text-sky-200">{formatNum(stats.assassins.gamesPlayed)}</div>
                        <div className="text-slate-300">Coins</div>
                        <div className="text-right font-semibold text-yellow-200">{formatNum(stats.assassins.coins)}</div>
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="col-span-full rounded-lg border border-dashed border-purple-500/30 bg-black/20 p-6 text-center">
                    <p className="text-sm text-slate-300">No Assassins mode data available for this player.</p>
                    <p className="mt-1 text-[11px] text-slate-400">They may not have played this mode yet.</p>
                  </div>
                )}
              </div>
            )}

            {/* INFECTION MODE TAB */}
            {statsTab === "infection" && (
              <div className="mt-3 grid gap-3 text-[13px] sm:grid-cols-2 lg:grid-cols-3">
                {stats.infection ? (
                  <>
                    <div className="rounded-lg bg-black/40 px-3 py-2">
                      <div className="text-[10px] uppercase tracking-wide text-red-300/80">Infection</div>
                      <div className="mt-1 grid grid-cols-2 gap-x-3 gap-y-1">
                        <div className="text-slate-300">Total wins</div>
                        <div className="text-right font-semibold text-emerald-200">{formatNum(stats.infection.wins)}</div>
                        <div className="text-slate-300">Kills</div>
                        <div className="text-right font-semibold text-emerald-200">{formatNum(stats.infection.kills)}</div>
                        <div className="text-slate-300">Deaths</div>
                        <div className="text-right font-semibold text-rose-200">{formatNum(stats.infection.deaths)}</div>
                        <div className="text-slate-300">Games played</div>
                        <div className="text-right font-semibold text-sky-200">{formatNum(stats.infection.gamesPlayed)}</div>
                      </div>
                    </div>

                    <div className="rounded-lg bg-black/40 px-3 py-2">
                      <div className="text-[10px] uppercase tracking-wide text-red-300/80">Wins by role</div>
                      <div className="mt-1 grid grid-cols-2 gap-x-3 gap-y-1">
                        <div className="text-slate-300">Survivor wins</div>
                        <div className="text-right font-semibold text-cyan-200">{formatNum(stats.infection.survivorWins)}</div>
                        <div className="text-slate-300">Infected wins</div>
                        <div className="text-right font-semibold text-rose-200">{formatNum(stats.infection.infectedWins)}</div>
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="col-span-full rounded-lg border border-dashed border-red-500/30 bg-black/20 p-6 text-center">
                    <p className="text-sm text-slate-300">No Infection mode data available for this player.</p>
                    <p className="mt-1 text-[11px] text-slate-400">They may not have played this mode yet.</p>
                  </div>
                )}
              </div>
            )}

            {/* Summary strip moved below mode panels */}
            <div className="mt-4 grid gap-3 border-t border-emerald-500/30 pt-3 md:grid-cols-[minmax(0,1.5fr)_minmax(0,1.5fr)] items-stretch text-[12px]">
              {/* Hypixel Stats */}
              <div className="rounded-lg bg-black/35 px-3 py-2">
                <div className="text-[10px] uppercase tracking-wide text-emerald-200/80">Hypixel Stats</div>
                <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1">
                  <div className="text-slate-300">Quests completed</div>
                  <div className="text-right font-semibold text-emerald-200">{formatNum(stats.questsCompleted)}</div>
                  <div className="text-slate-300">Challenges completed</div>
                  <div className="text-right font-semibold text-emerald-200">{formatNum(stats.challengesCompleted)}</div>
                  <div className="text-slate-300">Reward streak</div>
                  <div className="text-right font-semibold text-amber-200">{formatNum(stats.rewardStreak)}</div>
                  <div className="text-slate-300">Gifts sent</div>
                  <div className="text-right font-semibold text-pink-200">{formatNum(stats.giftsSent)}</div>
                  <div className="text-slate-300">Ranks gifted</div>
                  <div className="text-right font-semibold text-pink-200">{formatNum(stats.ranksGifted)}</div>
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
        
      

        </>
        )}
      </div>
      )}

      {detailTab === "usernames" && (
      <div className="rounded-xl border border-slate-800/80 p-4 text-xs text-slate-100 shadow-[0_0_40px_rgba(0,0,0,0.75)] mmid-surface-1">
        <div className="mb-2 flex items-start justify-between gap-3">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-300/90">
              Usernames & Alts
            </div>
            <div className="mt-1 text-[12px] text-slate-400">Username history and known alternate accounts</div>
          </div>
        </div>

        <div className="mt-3 grid gap-4 md:grid-cols-2 items-start">
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
              Known alts (coming soon)
            </h3>
            <p className="text-[12px] text-slate-300">
              This section will show related UUIDs and linked alt accounts once this feature is implemented.
            </p>
          </div>
        </div>
      </div>
      )}
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
  /** If provided, selects this row initially (used by legacy-view deep links). */
  initialActiveUuid?: string | null;
};

export default function MMIDDirectoryMasterDetail({
  rows,
  canEdit = false,
  currentUserName,
  initialActiveUuid,
}: MMIDDirectoryMasterDetailProps) {
  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [searchScopes, setSearchScopes] = useState<SearchScopeState>(DEFAULT_SEARCH_SCOPES);

  const [activeUuid, setActiveUuid] = useState<string | null>(() => {
    if (initialActiveUuid && rows.some((r) => r.uuid === initialActiveUuid)) return initialActiveUuid;
    const preferred = rows.find((r) => r.username.toLowerCase() === "inpuzah");
    return preferred?.uuid ?? rows[0]?.uuid ?? null;
  });

  const virtuosoRef = useRef<VirtuosoHandle | null>(null);

  const filtered = useMemo(() => {
    const tokens = q
      .trim()
      .toLowerCase()
      .split(/\s+/)
      .map((t) => t.trim())
      .filter(Boolean);

    const hasQuery = tokens.length > 0;
    const hasAnyScope = Object.values(searchScopes).some(Boolean);
    const scopes: SearchScopeState = hasAnyScope ? searchScopes : DEFAULT_SEARCH_SCOPES;

    const scoreField = (field: string, token: string) => {
      if (!field) return 0;
      if (field === token) return 120;
      if (field.startsWith(token)) return 80;
      if (field.includes(token)) return 40;
      return 0;
    };

    const rowsWithScore = rows
      .filter((r) => matchesStatusFilter(r.status ?? null, statusFilter))
      .map((r) => {
        if (!hasQuery) return { row: r, score: 0 };

        const username = r.username.toLowerCase();
        const uuidDashed = r.uuid.toLowerCase();
        const uuidPlain = r.uuid.replace(/-/g, "").toLowerCase();
        const guild = (r.guild ?? "").toLowerCase();
        const rank = (r.rank ?? "").toLowerCase();
        const status = (r.status ?? "").toLowerCase();
        const guildTag = (r.hypixelStats?.mmStats?.guildTag ?? "").toLowerCase();
        const tagsJoined = [...(r.typeOfCheating ?? []), ...(r.redFlags ?? [])]
          .join("|")
          .toLowerCase();
        const notes = (r.notesEvidence ?? "").toLowerCase();
        const usernameHistory = (r.usernameHistory ?? [])
          .map((h) => h.username.toLowerCase())
          .join("|");

        const fieldsByScope: Record<SearchScope, string[]> = {
          player: [username, rank, status, usernameHistory],
          uuid: [uuidDashed, uuidPlain],
          guild: [guild, guildTag],
          tags: [tagsJoined, notes],
        };

        let score = 0;
        for (const token of tokens) {
          let best = 0;
          for (const scope of Object.keys(scopes) as SearchScope[]) {
            if (!scopes[scope]) continue;
            for (const field of fieldsByScope[scope]) {
              best = Math.max(best, scoreField(field, token));
            }
          }
          if (best === 0) return { row: r, score: -1 };
          score += best;
        }

        return { row: r, score };
      })
      .filter((x) => x.score >= 0);

    if (!hasQuery) return rowsWithScore.map((x) => x.row);

    // Relevance sort when searching.
    return rowsWithScore
      .sort((a, b) => b.score - a.score || a.row.username.localeCompare(b.row.username, "en", { sensitivity: "base" }))
      .map((x) => x.row);
  }, [rows, q, statusFilter, searchScopes]);

  const hasQuery = q.trim().length > 0;
  const scopesAtDefault =
    searchScopes.player === DEFAULT_SEARCH_SCOPES.player &&
    searchScopes.uuid === DEFAULT_SEARCH_SCOPES.uuid &&
    searchScopes.guild === DEFAULT_SEARCH_SCOPES.guild &&
    searchScopes.tags === DEFAULT_SEARCH_SCOPES.tags;
  const hasActiveFilters = hasQuery || statusFilter !== "all" || !scopesAtDefault;

  const { flat, groupCounts, groupLabels, letterToIndex, lettersPresent } = useMemo(() => {
    if (hasQuery) {
      return {
        flat: filtered,
        groupCounts: [filtered.length],
        groupLabels: ["Results"],
        letterToIndex: new Map<string, number>(),
        lettersPresent: new Set<string>(),
      };
    }

    return buildAlphaIndex(filtered);
  }, [filtered, hasQuery]);


  useEffect(() => {
    // When switching into search mode (or refining the query), reset scroll.
    // Otherwise it's easy to end up "below" the (now much smaller) virtual list and see a blank panel.
    if (!hasQuery) return;
    virtuosoRef.current?.scrollToIndex({ index: 0, align: "start", behavior: "auto" });
  }, [hasQuery, q]);

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

  return (
      <div className="relative min-h-[100dvh] w-full text-foreground mmid-ui-scale bg-[radial-gradient(1200px_500px_at_55%_-120px,rgba(251,191,36,0.08),transparent_55%),radial-gradient(900px_420px_at_15%_0%,rgba(56,189,248,0.07),transparent_60%)]">
      <div className="w-full px-3 py-5 lg:px-4">
        {/* Master/detail grid */}
        <div
          className="grid min-h-[calc(100dvh-9rem)] gap-0 items-start [grid-template-columns:1fr] lg:gap-3 lg:[grid-template-columns:minmax(0,50%)_minmax(0,50%)]"
        >
          {/* Left: directory panel */}
          <div className="relative flex h-[calc(100dvh-9rem)] min-h-[32rem] flex-col overflow-hidden rounded-lg border shadow-lg backdrop-blur-sm mmid-surface-1">
            <div className="space-y-3 border-b px-4 py-4 mmid-surface-2">
              <div className="flex items-center gap-2">
                <Input
                  id="mmid-directory-search"
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="Search players, UUIDs, guilds, tags…"
                  className="h-11 flex-1 border-slate-700/80 bg-slate-900/70 text-[15px] text-slate-100 placeholder:text-slate-400"
                />
                <Button
                  type="button"
                  variant="secondary"
                  disabled={!hasActiveFilters}
                  className="h-11 px-4 text-[14px] mmid-chip disabled:opacity-50"
                  onClick={() => {
                    setQ("");
                    setSearchScopes(DEFAULT_SEARCH_SCOPES);
                    setStatusFilter("all");
                  }}
                >
                  <Filter className="mr-1.5 h-3.5 w-3.5" />
                  Clear filters
                </Button>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {(
                  [
                    { key: "player", label: "Players" },
                    { key: "guild", label: "Guilds" },
                    { key: "uuid", label: "UUID" },
                    { key: "tags", label: "Tags / Notes" },
                  ] as { key: SearchScope; label: string }[]
                ).map((s) => {
                  const enabled = !!searchScopes[s.key];
                  return (
                    <button
                      key={s.key}
                      type="button"
                      onClick={() =>
                        setSearchScopes((prev) => ({
                          ...prev,
                          [s.key]: !prev[s.key],
                        }))
                      }
                      className={
                        "rounded-full px-3 py-1.5 text-[13px] font-semibold transition " +
                        (enabled ? "mmid-chip-active" : "mmid-chip")
                      }
                    >
                      {s.label}
                    </button>
                  );
                })}

                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
                  className="h-10 rounded-full px-3 text-[13px] font-semibold mmid-chip"
                  aria-label="Directory status filter"
                >
                  {STATUS_FILTERS.map((s) => (
                    <option key={s.value} value={s.value}>
                      Status: {s.label}
                    </option>
                  ))}
                </select>

                {!hasQuery && (
                  <select
                    value=""
                    onChange={(e) => {
                      const v = e.target.value;
                      if (!v) return;
                      jumpTo(v);
                    }}
                    className="h-10 rounded-full px-3 text-[13px] font-semibold mmid-chip"
                    aria-label="Jump to letter"
                  >
                    <option value="">Jump to letter</option>
                    {[...LETTERS, "#"].map((L) => (
                      <option key={L} value={L} disabled={!lettersPresent.has(L)}>
                        {L}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-1.5">
                {STATUS_FILTERS.map((s) => (
                  <button
                    key={`quick-${s.value}`}
                    type="button"
                    onClick={() => setStatusFilter(s.value)}
                    className={
                      "rounded-full px-3 py-1.5 text-[12px] font-semibold uppercase tracking-wide transition " +
                      (statusFilter === s.value ? "mmid-chip-active" : "mmid-chip")
                    }
                  >
                    {s.label}
                  </button>
                ))}
              </div>

              <div className="flex flex-wrap items-center gap-2 text-[12px]">
                {q.trim() && (
                  <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 mmid-chip">
                    Query: <span className="font-mono">{q.trim()}</span>
                    <button type="button" onClick={() => setQ("")} className="mmid-subtle-text hover:text-amber-200">✕</button>
                  </span>
                )}

                {statusFilter !== "all" && (
                  <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 mmid-chip">
                    Status: {STATUS_FILTERS.find((s) => s.value === statusFilter)?.label ?? "All"}
                    <button type="button" onClick={() => setStatusFilter("all")} className="mmid-subtle-text hover:text-amber-200">✕</button>
                  </span>
                )}

                {(Object.keys(searchScopes) as SearchScope[])
                  .filter((k) => searchScopes[k] !== DEFAULT_SEARCH_SCOPES[k])
                  .map((k) => (
                    <span key={`chip-scope-${k}`} className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 mmid-chip">
                      Search in: {k}
                      <button
                        type="button"
                        onClick={() => setSearchScopes((prev) => ({ ...prev, [k]: DEFAULT_SEARCH_SCOPES[k] }))}
                        className="mmid-subtle-text hover:text-amber-200"
                      >
                        ✕
                      </button>
                    </span>
                  ))}
              </div>

              <div className="text-[13px] mmid-muted-text">
                Showing <span className="font-semibold text-slate-100">{filtered.length}</span> of {rows.length} entries
                {q.trim() ? (
                  <>
                    {" "}for <span className="font-mono text-slate-200">{q.trim()}</span>
                  </>
                ) : null}
              </div>
            </div>

            {flat.length === 0 ? (
              <div className="flex h-full flex-col items-center justify-center gap-3 px-4 py-8 text-center">
                <div className="text-sm font-semibold text-slate-200">No matches found</div>
                <div className="text-xs text-slate-400">Try a broader query or clear active filters.</div>
                <Button
                  type="button"
                  variant="secondary"
                  className="h-9 px-3 mmid-chip"
                  onClick={() => {
                    setQ("");
                    setSearchScopes(DEFAULT_SEARCH_SCOPES);
                    setStatusFilter("all");
                  }}
                >
                  Clear filters
                </Button>
              </div>
            ) : hasQuery ? (
              <>
                <div className="sticky top-0 z-10 border-b px-3 py-1 backdrop-blur mmid-surface-2">
                  <span className="text-xs tracking-wider text-slate-300">Results</span>
                </div>

                <Virtuoso
                  key="search"
                  ref={virtuosoRef}
                  style={{ height: "100%" }}
                  components={{ Scroller: DirectoryScroller }}
                  data={flat}
                  computeItemKey={(_, item) => item.uuid}
                  itemContent={(_, e) => {
                    const isActive = activeEntry && activeEntry.uuid === e.uuid;

                    const stats = e.hypixelStats?.mmStats ?? null;
                    const guildTag = stats?.guildTag ?? null;
                    const guildTagCss = hypixelColorToCss(stats?.guildColor) ?? null;
                    const usernameCss = baseRankCssColor(e.rank) ?? null;
                    const statusLower = (e.status ?? "").toLowerCase();
                    const statusDotClass = statusLower.includes("legit") || statusLower.includes("clear")
                      ? "bg-emerald-400"
                      : statusLower.includes("need") || statusLower.includes("review")
                      ? "bg-amber-400"
                      : statusLower.includes("cheat") || statusLower.includes("flag")
                      ? "bg-rose-400"
                      : "bg-slate-500";
                    const chips = [
                      e.status,
                      ...(e.typeOfCheating ?? []),
                      ...(e.redFlags ?? []),
                    ].filter(Boolean) as string[];

                    return (
                      <button
                        key={e.uuid}
                        type="button"
                        onClick={() => setActiveUuid(e.uuid)}
                        className={`group mmid-list-row relative flex w-full items-center justify-between gap-3 overflow-hidden rounded-md border border-transparent text-left text-base transition-all duration-150 ease-out hover:-translate-y-0.5 hover:scale-[1.02] hover:border-amber-400/55 hover:bg-[rgba(251,191,36,0.08)] ${
                          isActive ? "border-amber-300/70 bg-[rgba(251,191,36,0.16)]" : "bg-transparent"
                        }`}
                        aria-label={`View ${e.username}`}
                      >
                        <div className="flex min-w-0 flex-1 items-start gap-3">
                          <span className={`mt-1.5 h-2.5 w-2.5 rounded-full ${statusDotClass}`} aria-hidden="true" />
                          <MinecraftSkin
                            id={e.uuid}
                            name={e.username}
                            size={256}
                            loadingLabel="Loading skin…"
                            className="mmid-avatar shrink-0 object-contain drop-shadow-[0_6px_10px_rgba(0,0,0,0.55)]"
                          />

                          <div className="min-w-0 flex-1">
                            <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
                              {e.rank && renderHypixelRankTag(e.rank, stats?.rankPlusColor)}

                              <span
                                className="truncate font-minecraft text-[17px] leading-none"
                                style={usernameCss ? { color: usernameCss } : undefined}
                              >
                                {e.username}
                              </span>

                              {guildTag && (
                                <span
                                  className="inline-flex items-center rounded-full border bg-slate-900/70 px-1.5 py-0.5 font-minecraft text-[10px] leading-none"
                                  style={guildTagCss ? { color: guildTagCss, borderColor: guildTagCss } : undefined}
                                >
                                  [{guildTag}]
                                </span>
                              )}
                            </div>

                            <div className="mt-1 flex items-center gap-2 overflow-hidden text-[12px] whitespace-nowrap">
                              {chips.slice(0, 2).map((chip, i) => (
                                <span
                                  key={`chip-dir-${i}`}
                                  className={`inline-flex items-center rounded-full font-semibold mmid-chip-size ${
                                    i === 0 && e.status ? statusTone(e.status) : behaviorTagTone(chip)
                                  }`}
                                >
                                  {chip}
                                </span>
                              ))}
                              {chips.length > 2 && (
                                <span
                                  className="inline-flex items-center rounded-full border border-slate-500/55 bg-slate-700/25 font-semibold text-slate-100 mmid-chip-size"
                                  title={chips.slice(2).join(", ")}
                                >
                                  +{chips.length - 2}
                                </span>
                              )}
                            </div>

                            <div className="mt-1 flex items-center justify-between gap-2">
                              <div className="min-w-0 truncate text-[12px] text-slate-300">
                                {e.guild ?? "No guild"}
                              </div>
                              <div className="hidden text-[10px] text-slate-500 sm:block">&nbsp;</div>
                            </div>
                          </div>
                        </div>

                        <div className="ml-2 flex flex-col items-end justify-center text-right">
                          <span className="mt-1 text-[10px] uppercase tracking-wide text-transparent" aria-hidden="true">Open</span>
                        </div>

                        <span className="sr-only">click anywhere on the card to open</span>
                      </button>
                    );
                  }}
                />
              </>
            ) : (
              <GroupedVirtuoso
                key="browse"
                ref={virtuosoRef}
                style={{ height: "100%" }}
                components={{ Scroller: DirectoryScroller }}
                data={flat}
                groupCounts={groupCounts}
                computeItemKey={(index) => flat[index]?.uuid ?? `row-${index}`}
                groupContent={(gi) => (
                  <div className="sticky top-0 z-10 border-b px-3 py-1 backdrop-blur mmid-surface-2">
                    <span className="text-xs tracking-wider text-slate-300">{groupLabels[gi]}</span>
                  </div>
                )}
                itemContent={(index) => {
                  const e = flat[index] as MmidRow | undefined;
                  if (!e) return null;

                  const isActive = activeEntry && activeEntry.uuid === e.uuid;

                  const stats = e.hypixelStats?.mmStats ?? null;
                  const guildTag = stats?.guildTag ?? null;
                  const guildTagCss = hypixelColorToCss(stats?.guildColor) ?? null;
                  const usernameCss = baseRankCssColor(e.rank) ?? null;
                  const statusLower = (e.status ?? "").toLowerCase();
                  const statusDotClass = statusLower.includes("legit") || statusLower.includes("clear")
                    ? "bg-emerald-400"
                    : statusLower.includes("need") || statusLower.includes("review")
                    ? "bg-amber-400"
                    : statusLower.includes("cheat") || statusLower.includes("flag")
                    ? "bg-rose-400"
                    : "bg-slate-500";
                  const chips = [
                    e.status,
                    ...(e.typeOfCheating ?? []),
                    ...(e.redFlags ?? []),
                  ].filter(Boolean) as string[];

                  return (
                    <button
                      key={e.uuid}
                      type="button"
                      onClick={() => setActiveUuid(e.uuid)}
                        className={`group mmid-list-row relative flex w-full items-center justify-between gap-3 overflow-hidden rounded-md border border-transparent text-left text-base transition-all duration-150 ease-out hover:-translate-y-0.5 hover:scale-[1.02] hover:border-amber-400/55 hover:bg-[rgba(251,191,36,0.08)] ${
                        isActive ? "border-amber-300/70 bg-[rgba(251,191,36,0.16)]" : "bg-transparent"
                      }`}
                      aria-label={`View ${e.username}`}
                    >
                      <div className="flex min-w-0 flex-1 items-start gap-3">
                        <span className={`mt-1.5 h-2.5 w-2.5 rounded-full ${statusDotClass}`} aria-hidden="true" />
                        <MinecraftSkin
                          id={e.uuid}
                          name={e.username}
                          size={256}
                          loadingLabel="Loading skin…"
                          className="mmid-avatar shrink-0 object-contain drop-shadow-[0_6px_10px_rgba(0,0,0,0.55)]"
                        />

                        <div className="min-w-0 flex-1">
                          <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
                            {e.rank && renderHypixelRankTag(e.rank, stats?.rankPlusColor)}

                            <span
                              className="truncate font-minecraft text-[17px] leading-none"
                              style={usernameCss ? { color: usernameCss } : undefined}
                            >
                              {e.username}
                            </span>

                            {guildTag && (
                              <span
                                className="inline-flex items-center rounded-full border bg-slate-900/70 px-1.5 py-0.5 font-minecraft text-[10px] leading-none"
                                style={guildTagCss ? { color: guildTagCss, borderColor: guildTagCss } : undefined}
                              >
                                [{guildTag}]
                              </span>
                            )}
                          </div>

                          <div className="mt-1 flex items-center gap-2 overflow-hidden text-[12px] whitespace-nowrap">
                            {chips.slice(0, 2).map((chip, i) => (
                              <span
                                key={`chip-dir-${i}`}
                                className={`inline-flex items-center rounded-full font-semibold mmid-chip-size ${
                                  i === 0 && e.status ? statusTone(e.status) : behaviorTagTone(chip)
                                }`}
                              >
                                {chip}
                              </span>
                            ))}
                            {chips.length > 2 && (
                              <span
                                className="inline-flex items-center rounded-full border border-slate-500/55 bg-slate-700/25 font-semibold text-slate-100 mmid-chip-size"
                                title={chips.slice(2).join(", ")}
                              >
                                +{chips.length - 2}
                              </span>
                            )}
                          </div>

                          <div className="mt-1 flex items-center justify-between gap-2">
                            <div className="min-w-0 truncate text-[12px] text-slate-300">
                              {e.guild ?? "No guild"}
                            </div>
                            <div className="hidden text-[10px] text-slate-500 sm:block">&nbsp;</div>
                          </div>
                        </div>
                      </div>

                      <div className="ml-2 flex flex-col items-end justify-center text-right">
                        <span className="mt-1 text-[10px] uppercase tracking-wide text-transparent" aria-hidden="true">Open</span>
                      </div>

                      <span className="sr-only">click anywhere on the card to open</span>
                    </button>
                  );
                }}
              />
            )}
          </div>

          {/* Right: Entry detail */}
          <div className="h-[calc(100dvh-9rem)] min-h-[32rem] overflow-y-auto rounded-lg border p-6 shadow-lg backdrop-blur-sm mmid-surface-1">
            <EntryDetailPanel entry={activeEntry} canEdit={canEdit} currentUserName={currentUserName} />
          </div>
        </div>
      </div>
    </div>
  );
}

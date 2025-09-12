"use client";

import React, { useMemo, useState, useCallback } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Star, Users, Search, Sparkles, X } from "lucide-react";
import { AutoSizer, Grid, GridCellProps } from "react-virtualized";

export type MmidEntry = {
  id: string;
  username: string;
  uuid?: string | null;
  guild?: string | null;
  rank?: string | null;
  status?: string | null;          // comma string like "Legit, Teaming"
  typeOfCheating?: string | null;  // comma string for now
  redFlags?: string | null;        // comma string for now
  notesEvidence?: string | null;
  reviewer?: string | null;
  confidence?: number | null;      // 0..5
};

// ---- background image ----
const BG_URL =
  "https://external-content.duckduckgo.com/iu/?u=https%3A%2F%2Fi.pinimg.com%2Foriginals%2Fea%2F00%2F0c%2Fea000cc6fb9375b14a7b21d55dcf9745.jpg&f=1&nofb=1&ipt=28986ad446f22f0ccb779adbd6fb94d95c92f99344e60ec7bfc44a9cd08336c0";

// ---- status pill helper ----
const statusBadge = (s?: string | null) => {
  if (!s) return <Badge variant="secondary">Unknown</Badge>;
  const text = s;
  const base = "px-2.5 py-1 text-xs rounded-full border-0";
  if (/legit/i.test(text)) return <span className={`${base} bg-emerald-600/90 text-white`}>Legit</span>;
  if (/pending/i.test(text)) return <span className={`${base} bg-slate-700/70 text-white`}>Pending</span>;
  if (/team/i.test(text)) return <span className={`${base} bg-amber-600/90 text-white`}>Teaming</span>;
  if (/flag|suspect|cheat/i.test(text)) return <span className={`${base} bg-rose-600/90 text-white`}>Flagged</span>;
  return <span className={`${base} bg-sky-600/90 text-white`}>{text}</span>;
};

// ---- stars ----
const Stars = ({ value = 0 }: { value?: number | null }) => {
  const count = Math.max(0, Math.min(5, value ?? 0));
  return (
    <div className="flex items-center gap-1">
      {Array.from({ length: 5 }).map((_, i) => (
        <Star key={i} className={`h-4 w-4 ${i < count ? "fill-yellow-400" : "fill-transparent"} stroke-yellow-400`} />
      ))}
    </div>
  );
};

// ---- modal card ----
function EntryCard({
  entry,
  open,
  onOpenChange,
}: {
  entry: MmidEntry | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  if (!entry) return null;
  const multiStatus = entry.status?.split(/,\s*/g) ?? [];
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl border-white/10 bg-slate-900/70 backdrop-blur-xl p-0 overflow-hidden">
        <div className="relative h-28 w-full bg-gradient-to-r from-sky-900/60 via-cyan-800/60 to-teal-800/60">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-white/10 via-transparent to-transparent mix-blend-overlay" />
        </div>
        <div className="-mt-10 px-6 pb-6">
          <DialogHeader>
            <div className="flex items-start gap-4">
              <Avatar className="h-20 w-20 ring-2 ring-white/20">
                <AvatarFallback className="bg-slate-700 text-white">
                  {entry.username.substring(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1">
                <DialogTitle className="text-2xl font-semibold tracking-wide">{entry.username}</DialogTitle>
                <DialogDescription className="mt-1 text-sky-200/90">
                  <span className="mr-3">
                    Rank: <span className="font-semibold text-white/90">{entry.rank ?? "Unranked"}</span>
                  </span>
                  {entry.reviewer && (
                    <span className="mr-3">
                      Reviewed by: <span className="font-semibold text-white/90">{entry.reviewer}</span>
                    </span>
                  )}
                  <span className="inline-flex items-center gap-1 align-middle">
                    Confidence: <Stars value={entry.confidence ?? 0} />
                  </span>
                </DialogDescription>
              </div>
              <Button variant="ghost" size="icon" className="-mr-2" onClick={() => onOpenChange(false)}>
                <X className="h-5 w-5" />
              </Button>
            </div>
          </DialogHeader>

          <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card className="bg-white/[0.02] border-white/10">
              <CardContent className="p-4 space-y-2">
                <div className="text-xs uppercase tracking-widest text-white/60">Guild</div>
                <div className="text-base">{entry.guild ?? <span className="text-white/50">No Guild</span>}</div>
                <Separator className="my-2 bg-white/10" />
                <div className="text-xs uppercase tracking-widest text-white/60">Status</div>
                <div className="flex flex-wrap gap-2 pt-1">
                  {multiStatus.length ? multiStatus.map((s, i) => <span key={i}>{statusBadge(s)}</span>) : statusBadge(null)}
                </div>
              </CardContent>
            </Card>

            <Card className="bg-white/[0.02] border-white/10">
              <CardContent className="p-4 space-y-2">
                <div className="text-xs uppercase tracking-widest text-white/60">Type of cheating</div>
                <div className="text-base">{entry.typeOfCheating ?? <span className="text-white/50">N/A</span>}</div>
                <Separator className="my-2 bg-white/10" />
                <div className="text-xs uppercase tracking-widest text-white/60">Red flags</div>
                <div className="text-base">{entry.redFlags ?? <span className="text-white/50">None</span>}</div>
              </CardContent>
            </Card>

            <Card className="md:col-span-2 bg-white/[0.02] border-white/10">
              <CardContent className="p-4">
                <div className="text-xs uppercase tracking-widest text-white/60 mb-2">Notes / Evidence</div>
                <p className="leading-relaxed whitespace-pre-wrap text-white/90">{entry.notesEvidence || "N/A"}</p>
              </CardContent>
            </Card>

            <div className="md:col-span-2 text-center text-sm text-white/60">Data from MMID · Virtualized grid</div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ---- Virtualized Grid (react-virtualized) ----
export default function MMIDDirectoryVirtual({ data }: { data: MmidEntry[] }) {
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<MmidEntry | null>(null);
  const [open, setOpen] = useState(false);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return data;
    return data.filter((e) =>
      [
        e.username,
        e.guild,
        e.rank,
        e.status,
        e.typeOfCheating,
        e.redFlags,
        e.reviewer,
      ]
        .filter(Boolean)
        .some((t) => (t as string).toLowerCase().includes(q))
    );
  }, [data, query]);

  // layout constants
  const GAP = 16;       // px (applied to both row/column spacing)
  const CARD_W = 380;   // px
  const CARD_H = 120;   // px

  // cell renderer for react-virtualized Grid
  const cellRenderer = useCallback(
    ({ columnIndex, rowIndex, key, style, parent }: GridCellProps) => {
      // itemsPerRow is computed in the AutoSizer render
      const { items, itemsPerRow } = (parent.props as any).itemData as {
        items: MmidEntry[];
        itemsPerRow: number;
      };

      const index = rowIndex * itemsPerRow + columnIndex;
      if (index >= items.length) {
        return <div key={key} style={style} />;
      }
      const e = items[index];

      // Apply a bit of inner spacing (gap) so cards don't touch
      const cellStyle: React.CSSProperties = {
        ...style,
        left: (style as any).left + GAP / 2,
        top: (style as any).top + GAP / 2,
        width: (style as any).width - GAP,
        height: (style as any).height - GAP,
      };

      return (
        <div key={key} style={cellStyle}>
          <button
            onClick={() => {
              setSelected(e);
              setOpen(true);
            }}
            className="group text-left w-full h-full"
            aria-label={`Open ${e.username}`}
          >
            <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-white/[0.04] hover:bg-white/[0.06] transition shadow-sm h-full">
              <div className="p-4 flex items-center gap-3">
                <Avatar className="h-12 w-12 ring-2 ring-white/10">
                  <AvatarFallback className="bg-slate-700 text-white">
                    {e.username.substring(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <div className="font-semibold truncate max-w-[12rem]">{e.username}</div>
                    {e.rank && (
                      <Badge variant="outline" className="border-cyan-400/40 text-cyan-200/90">
                        {e.rank}
                      </Badge>
                    )}
                  </div>
                  <div className="mt-1 flex items-center gap-2 text-sm text-white/70">
                    <Users className="h-4 w-4" /> {e.guild ?? "No Guild"}
                  </div>
                </div>
              </div>
              <Separator className="bg-white/10" />
              <div className="p-3 flex items-center justify-between">
                <div className="flex flex-wrap gap-2 items-center">
                  {(e.status?.split(/,\s*/g) ?? []).map((s, i) => (
                    <span key={i}>{statusBadge(s)}</span>
                  ))}
                </div>
                <div className="flex items-center gap-1 opacity-90">
                  <Stars value={e.confidence ?? 0} />
                </div>
              </div>
            </div>
          </button>
        </div>
      );
    },
    []
  );

  return (
    <div className="relative min-h-[100dvh] w-full text-white">
      {/* background */}
      <div className="fixed inset-0 -z-10">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={BG_URL} alt="background" className="h-full w-full object-cover" />
        <div className="absolute inset-0 bg-slate-950/60" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_rgba(255,255,255,0.12),_transparent_60%)]" />
        <div className="absolute inset-0 backdrop-blur-[2px]" />
      </div>

      {/* header */}
      <div className="mx-auto max-w-6xl px-4 py-8">
        <header className="mb-6 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight flex items-center gap-2">
              <Sparkles className="h-7 w-7" /> MMID Directory
            </h1>
            <p className="text-white/70 mt-1">Virtualized grid — smooth with 1,400+ entries.</p>
          </div>

          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/50" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search by username, guild, rank, status…"
                className="pl-9 bg-white/10 border-white/10 text-white placeholder:text-white/50 w-72"
              />
            </div>
            <Button variant="secondary" className="bg-white/10 border-white/10 text-white" onClick={() => setQuery("")}>
              Reset
            </Button>
          </div>
        </header>
      </div>

      {/* grid container */}
      <div className="mx-auto max-w-6xl px-4 pb-10">
        <div className="h-[70vh] w-full rounded-2xl border border-white/10 bg-white/[0.04]">
          <AutoSizer>
            {({ height, width }) => {
              const items = filtered;

              // compute columns based on available width
              const itemsPerRow = Math.max(1, Math.floor((width + GAP) / (CARD_W + GAP)));
              const rowCount = Math.ceil(items.length / itemsPerRow);

              return (
                <Grid
                  height={height}
                  width={width}
                  columnCount={itemsPerRow}
                  columnWidth={CARD_W + GAP}
                  rowCount={rowCount}
                  rowHeight={CARD_H + GAP}
                  cellRenderer={(props) =>
                    cellRenderer({
                      ...props,
                      // pass items + itemsPerRow to the renderer via parent.props.itemData
                      // (react-virtualized doesn't have itemData like react-window,
                      // so we attach to parent via a little hack)
                    } as GridCellProps)
                  }
                  // @ts-expect-error attach our data on props (read back via parent.props in cellRenderer)
                  itemData={{ items, itemsPerRow }}
                />
              );
            }}
          </AutoSizer>
        </div>
      </div>

      <EntryCard entry={selected} open={open} onOpenChange={setOpen} />
    </div>
  );
}

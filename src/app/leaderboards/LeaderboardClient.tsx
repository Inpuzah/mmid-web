"use client";

import { useState } from "react";

import type { MmidRow } from "../directory/_components/MMIDFullWidthCardList";
import { EntryCard } from "../directory/_components/MMIDFullWidthCardList";

export type LeaderboardRowWithDirectory = {
  uuid: string;
  username: string | null;
  value: number | null;
  position: number;
  mmidEntry: MmidRow | null;
};

export type LeaderboardClientProps = {
  rows: LeaderboardRowWithDirectory[];
  statLabel: string;
  scopeLabel: string;
};

function isCheatingStatus(status: string | null | undefined): boolean {
  if (!status) return false;
  const val = status.toLowerCase();
  return (
    val.includes("confirmed") ||
    val.includes("cheat") ||
    val.includes("cheater") ||
    val.includes("flagged")
  );
}

export default function LeaderboardClient({ rows, statLabel, scopeLabel }: LeaderboardClientProps) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState<MmidRow | null>(null);

  const directoryRows: MmidRow[] = rows
    .map((row) => row.mmidEntry)
    .filter((entry): entry is MmidRow => entry != null);

  const handleOpenEntry = (entry: MmidRow | null) => {
    if (!entry) return;
    setActive(entry);
    setOpen(true);
  };

  return (
    <section className="space-y-5">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-amber-300">
            Hypixel · Murder Mystery
          </p>
          <h1 className="text-xl font-extrabold text-slate-50">Leaderboards</h1>
          <p className="mt-2 text-sm text-slate-300/90">
            Showing <span className="font-semibold text-slate-50">{statLabel}</span> ·
            <span className="ml-1 font-semibold text-slate-50">{scopeLabel}</span>
          </p>
        </div>
        <p className="text-xs max-w-sm text-slate-400">
          Players that appear in the MMID directory and are flagged for cheating are highlighted in red.
          Click a name with a linked directory entry to open the full MMID card.
        </p>
      </header>

      <div className="overflow-hidden rounded-[3px] border-2 border-black/80 bg-slate-950/80 shadow-[0_0_0_1px_rgba(0,0,0,0.85),0_8px_0_0_rgba(0,0,0,0.9)]">
        <table className="w-full text-sm">
          <thead className="bg-slate-900/90 text-slate-200">
            <tr className="uppercase tracking-[0.18em] text-[11px]">
              <th className="px-3 py-2 text-left w-[4ch]">#</th>
              <th className="px-3 py-2 text-left">Player</th>
              <th className="px-3 py-2 text-left">Directory</th>
              <th className="px-3 py-2 text-right">{statLabel}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {rows.map((row) => {
              const isCheater = isCheatingStatus(row.mmidEntry?.status ?? null);
              const showName = row.username ?? "Unknown";
              const valueText =
                row.value == null || Number.isNaN(row.value)
                  ? "—"
                  : row.value.toLocaleString();

              return (
                <tr
                  key={`${row.position}-${row.uuid}`}
                  className="bg-black/40 hover:bg-black/70"
>
                  <td className="px-3 py-2 text-xs text-slate-300 align-middle">
                    {row.position}
                  </td>
                  <td className="px-3 py-2 align-middle">
                    {row.mmidEntry ? (
                      <button
                        type="button"
                        onClick={() => handleOpenEntry(row.mmidEntry!)}
                        className={
                          "text-xs font-medium underline-offset-2 hover:underline " +
                          (isCheater ? "text-rose-400" : "text-slate-50")
                        }
                      >
                        {showName}
                      </button>
                    ) : (
                      <span
                        className={
                          "text-xs font-medium " +
                          (isCheater ? "text-rose-400" : "text-slate-100")
                        }
                      >
                        {showName}
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-xs text-slate-300 align-middle">
                    {row.mmidEntry ? (
                      <span
                        className={
                          "inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold " +
                          (isCheater
                            ? "bg-rose-500/80 text-black"
                            : "bg-emerald-500/80 text-black")
                        }
                      >
                        {isCheater ? "Cheating / Flagged" : "Listed (non-cheating)"}
                      </span>
                    ) : (
                      <span className="text-[11px] text-slate-500">Not in MMID</span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-right text-xs text-slate-100 align-middle">
                    {valueText}
                  </td>
                </tr>
              );
            })}
            {rows.length === 0 && (
              <tr>
                <td className="px-4 py-6 text-center text-slate-400" colSpan={4}>
                  No leaderboard data available from Hypixel right now.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <EntryCard
        entry={active}
        open={open}
        onOpenChange={setOpen}
        rows={directoryRows}
        onSelectEntry={(entry) => {
          setActive(entry);
          setOpen(true);
        }}
      />
    </section>
  );
}

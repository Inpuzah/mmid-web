import { notFound } from "next/navigation";
import { getServerSession } from "next-auth";

import { authOptions } from "@/auth";
import { prisma } from "@/lib/prisma";
import MinecraftSkin from "@/components/MinecraftSkin";
import { voteOnEntry } from "@/app/directory/actions";
import { ArrowDown, ArrowUp } from "lucide-react";

export const dynamic = "force-dynamic";

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
    v.includes("harasses others") ||
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

function Stars({ n = 0 }: { n?: number | null }) {
  const v = Math.max(0, Math.min(5, Number(n ?? 0)));
  return (
    <span className="inline-flex items-center gap-0.5" aria-label={`${v}/5`}>
      {Array.from({ length: 5 }).map((_, i) => (
        <span
          key={i}
          className={`inline-block h-3 w-3 rounded-full border border-yellow-400/70 ${
            i < v ? "bg-yellow-400" : "bg-transparent"
          }`}
        />
      ))}
    </span>
  );
}

export default async function MmidProfilePage({
  params,
}: {
  params: Promise<{ uuid: string }>;
}) {
  const { uuid: rawUuid } = await params;
  const uuid = rawUuid.trim();
  if (!uuid) notFound();

  const session = await getServerSession(authOptions);
  const userId = (session?.user as any)?.id as string | undefined;

  const [entry, voteAggregate, userVote] = await Promise.all([
    prisma.mmidEntry.findUnique({
      where: { uuid },
      include: {
        usernameHistory: {
          orderBy: { changedAt: "desc" },
        },
      },
    }),
    prisma.mmidEntryVote.aggregate({
      _sum: { value: true },
      where: { entryUuid: uuid },
    }),
    userId
      ? prisma.mmidEntryVote.findUnique({
          where: { entryUuid_userId: { entryUuid: uuid, userId } },
          select: { value: true },
        })
      : Promise.resolve(null),
  ]);

  if (!entry) {
    notFound();
  }

  const voteScore = voteAggregate._sum.value ?? 0;
  const userVoteValue = userVote?.value ?? 0;
  const guildColor = entry.guild ? stringToHsl(entry.guild) : "hsl(220 15% 30%)";

  return (
    <main className="mx-auto max-w-5xl space-y-6 py-6 text-sm text-foreground">
      <section className="rounded-[3px] border-2 border-black/80 bg-[radial-gradient(circle_at_top,#1f2937_0%,#020617_65%)] px-5 py-4 shadow-[0_0_0_1px_rgba(0,0,0,0.85),0_8px_0_0_rgba(0,0,0,0.9)]">
        <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-amber-300">
              Murder Mystery · MMID Profile
            </p>
            <h1 className="mt-1 text-2xl font-extrabold text-white drop-shadow-[0_0_6px_rgba(0,0,0,0.9)]">
              {entry.username}
            </h1>
            <p className="mt-1 text-xs text-slate-300/90">
              Dedicated MMID profile page for this player. This page is separate from the main directory view.
            </p>
          </div>
          <div className="flex flex-col items-end gap-2 text-xs text-slate-200">
            <div className="rounded-[3px] border border-slate-700/80 bg-black/40 px-3 py-2 text-[11px] shadow-[0_0_0_1px_rgba(0,0,0,0.85)]">
              <div className="text-[10px] uppercase tracking-[0.18em] text-slate-400">UUID</div>
              <div className="mt-0.5 font-mono text-[11px] text-slate-100 break-all">{entry.uuid}</div>
            </div>
            <a
              href={`https://namemc.com/profile/${encodeURIComponent(entry.uuid)}`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 rounded-[3px] border border-sky-400/80 bg-sky-600 px-3 py-1 text-[11px] font-semibold text-white shadow-[0_0_0_1px_rgba(0,0,0,0.85)] hover:bg-sky-500"
            >
              View on NameMC
            </a>
          </div>
        </header>
      </section>

      <section className="mx-auto grid max-w-5xl grid-cols-1 gap-4 md:grid-cols-[minmax(0,1.4fr)_minmax(0,2.6fr)]">
        <div className="space-y-4">
          <div className="rounded-[3px] border border-slate-900 bg-slate-950/80 p-3 text-center shadow-[0_0_0_1px_rgba(0,0,0,0.85)]">
            <MinecraftSkin
              id={entry.uuid}
              name={entry.username}
              className="mx-auto h-40 w-auto rounded-lg ring-2 ring-white/10"
            />
            <p className="mt-2 text-[11px] text-slate-400">Skin preview from current Minecraft profile.</p>
          </div>

          <div className="space-y-2 rounded-[3px] border border-slate-900 bg-slate-950/80 p-3 text-xs shadow-[0_0_0_1px_rgba(0,0,0,0.85)]">
            <div className="text-[11px] uppercase tracking-[0.18em] text-slate-400">Directory verdict</div>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <span
                className={`inline-flex items-center rounded-full px-3 py-1 text-[11px] font-semibold ${statusTone(
                  entry.status,
                )}`}
              >
                {entry.status ?? "Not set"}
              </span>
              <span className="flex items-center gap-1 text-[11px] text-slate-300">
                <span className="text-slate-400">Confidence:</span>
                <Stars n={entry.confidenceScore ?? 0} />
              </span>
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <span className="text-[11px] uppercase tracking-[0.18em] text-slate-400">Reviewed by</span>
              <span className="rounded-full bg-slate-800/90 px-2.5 py-0.5 text-[11px] font-medium text-slate-100">
                {entry.reviewedBy ?? "Unassigned"}
              </span>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div className="grid gap-3 md:grid-cols-[minmax(0,2fr)_minmax(0,1.4fr)]">
            <div className="rounded-[3px] border border-slate-900 bg-slate-950/80 p-3 text-xs shadow-[0_0_0_1px_rgba(0,0,0,0.85)]">
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <span className="text-[11px] uppercase tracking-[0.18em] text-slate-400">Rank</span>
                <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${rankClass(entry.rank)}`}>
                  {entry.rank ?? "Unknown"}
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[11px] uppercase tracking-[0.18em] text-slate-400">Guild</span>
                <span
                  className="rounded-full px-2.5 py-0.5 text-[11px] font-semibold"
                  style={{ backgroundColor: guildColor }}
                >
                  {entry.guild ?? "No guild"}
                </span>
              </div>
            </div>

            <div className="rounded-[3px] border border-slate-900 bg-black/80 p-3 text-xs shadow-[0_0_0_1px_rgba(0,0,0,0.85)]">
              <div className="mb-2 text-[11px] uppercase tracking-[0.18em] text-slate-300">Votes</div>
              <div className="flex items-center justify-between gap-3">
                <div className="flex flex-col">
                  <span className="text-2xl font-extrabold text-slate-50 leading-none">{voteScore}</span>
                  <span className="mt-1 text-[10px] uppercase tracking-[0.18em] text-slate-400">Net votes</span>
                </div>
                <div className="flex gap-1.5">
                  <form action={voteOnEntry} className="inline-flex">
                    <input type="hidden" name="entryUuid" value={entry.uuid} />
                    <input type="hidden" name="direction" value="up" />
                    <button
                      type="submit"
                      className={`inline-flex h-8 w-8 items-center justify-center rounded-full border text-xs font-semibold transition ${
                        userVoteValue === 1
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
                        userVoteValue === -1
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

          <div className="rounded-[3px] border border-slate-900 bg-slate-950/80 p-3 text-xs shadow-[0_0_0_1px_rgba(0,0,0,0.85)]">
            <div className="mb-1 text-[11px] uppercase tracking-[0.18em] text-slate-300">Cheating tags</div>
            <div className="mb-2 flex flex-wrap gap-1.5">
              {(entry.typeOfCheating ?? []).map((t, i) => (
                <span
                  key={`tc-${i}`}
                  className="rounded-full bg-slate-700/80 px-2 py-0.5 text-[11px] text-white"
                >
                  {t}
                </span>
              ))}
              {!(entry.typeOfCheating && entry.typeOfCheating.length) && (
                <span className="text-[11px] text-slate-500">No cheating tags recorded</span>
              )}
            </div>
            <div className="mb-1 text-[11px] uppercase tracking-[0.18em] text-slate-300">Behavior tags</div>
            <div className="flex flex-wrap gap-1.5">
              {(entry.redFlags ?? []).map((t, i) => (
                <span
                  key={`rf-${i}`}
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

          <div className="rounded-[3px] border border-slate-900 bg-slate-950/80 p-3 text-xs shadow-[0_0_0_1px_rgba(0,0,0,0.85)]">
            <div className="mb-1 text-[11px] uppercase tracking-[0.18em] text-slate-300">Notes / Evidence</div>
            <div className="whitespace-pre-line text-[12px] text-slate-200">
              {entry.notesEvidence?.trim() ? (
                entry.notesEvidence
              ) : (
                <span className="text-slate-500">No notes recorded yet.</span>
              )}
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}

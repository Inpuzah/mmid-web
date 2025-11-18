// src/app/leaderboards/page.tsx
import { prisma } from "@/lib/prisma";
import { fetchMurderMysteryLeaderboard, type MmStatType, type MmTimeScope } from "@/lib/hypixel-leaderboards";
import { resolveNameByUuid } from "@/lib/minecraft";
import LeaderboardClient, { type LeaderboardRowWithDirectory } from "./LeaderboardClient";

export const dynamic = "force-dynamic";

function firstStr(v: string | string[] | undefined): string {
  return Array.isArray(v) ? v[0] : v ?? "";
}

function normalizeStatType(raw: string): MmStatType {
  const v = raw.trim().toLowerCase();
  return v === "wins" ? "wins" : "kills";
}

function normalizeScope(raw: string): MmTimeScope {
  const v = raw.trim().toLowerCase();
  if (v === "monthly") return "monthly";
  if (v === "alltime" || v === "overall" || v === "lifetime") return "alltime";
  return "weekly";
}

function statLabel(stat: MmStatType): string {
  return stat === "wins" ? "Wins" : "Kills";
}

function scopeLabel(scope: MmTimeScope): string {
  if (scope === "monthly") return "Monthly";
  if (scope === "alltime") return "All-time";
  return "Weekly";
}

export default async function LeaderboardsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  // Default view: Wins · All-time
  const stat = normalizeStatType(firstStr(sp.stat || "wins"));
  const scope = normalizeScope(firstStr(sp.scope || "alltime"));

  const hypixelRows = await fetchMurderMysteryLeaderboard(stat, scope);

  // Resolve player names from UUIDs via Mojang, independent of Hypixel rate limits.
  const hypixelWithNames = await Promise.all(
    hypixelRows.map(async (r) => {
      const name = await resolveNameByUuid(r.uuid).catch(() => null);
      return {
        ...r,
        username: name ?? r.username ?? r.uuid,
      };
    })
  );

  // Use both UUIDs and usernames to cross-reference with the MMID directory,
  // since some entries may be keyed differently.
  const uuids = hypixelWithNames.map((r) => r.uuid).filter((v): v is string => Boolean(v));
  const names = hypixelWithNames.map((r) => r.username).filter((v): v is string => Boolean(v));

  const [entriesByUuid, entriesByName] = await Promise.all([
    uuids.length
      ? prisma.mmidEntry.findMany({
          where: { uuid: { in: uuids } },
        })
      : Promise.resolve([]),
    names.length
      ? prisma.mmidEntry.findMany({
          where: { username: { in: names } },
        })
      : Promise.resolve([]),
  ]);

  const directoryByUuid = new Map<string, (typeof entriesByUuid)[number]>();
  for (const e of entriesByUuid) {
    directoryByUuid.set(e.uuid, e);
  }

  const directoryByName = new Map<string, (typeof entriesByName)[number]>();
  for (const e of entriesByName) {
    directoryByName.set(e.username.toLowerCase(), e);
  }

  const rows: LeaderboardRowWithDirectory[] = hypixelWithNames.map((r) => {
    const entry =
      directoryByUuid.get(r.uuid) ??
      (r.username ? directoryByName.get(r.username.toLowerCase()) ?? null : null);

    return {
      uuid: r.uuid,
      username: r.username,
      value: r.value,
      position: r.position,
      mmidEntry: entry
        ? {
            uuid: entry.uuid,
            username: entry.username,
            guild: entry.guild ?? null,
            rank: entry.rank ?? null,
            status: entry.status ?? null,
            typeOfCheating: entry.typeOfCheating ?? [],
            redFlags: entry.redFlags ?? [],
            notesEvidence: entry.notesEvidence ?? null,
            reviewedBy: entry.reviewedBy ?? null,
            confidenceScore: entry.confidenceScore ?? 0,
            voteScore: 0,
            userVote: 0,
          }
        : null,
    };
  });

  const sLabel = statLabel(stat);
  const scLabel = scopeLabel(scope);

  const scopes: MmTimeScope[] = ["alltime", "weekly", "monthly"];
  const stats: MmStatType[] = ["wins", "kills"];

  return (
    <main className="space-y-6 py-6 text-base text-foreground">
      <section className="rounded-[3px] border-2 border-black/80 bg-[radial-gradient(circle_at_top,#1f2937_0%,#020617_65%)] px-5 py-4 shadow-[0_0_0_1px_rgba(0,0,0,0.85),0_8px_0_0_rgba(0,0,0,0.9)]">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-amber-300">
              Murder Mystery · Hypixel
            </p>
            <h1 className="text-2xl font-extrabold text-slate-50">Leaderboard Browser</h1>
            <p className="mt-2 text-sm text-slate-300/90 max-w-xl">
              Pulls Hypixel Murder Mystery leaderboards and cross-references them with the MMID directory.
              Data is refreshed at most once every ~4 hours to respect Hypixel API limits.
            </p>
          </div>
          <div className="flex flex-col gap-2 text-xs text-slate-200 sm:items-end">
            {/* Stat toggles: Wins / Kills */}
            <div className="flex gap-1.5 justify-end">
              {stats.map((st) => {
                const active = st === stat;
                return (
                  <a
                    key={st}
                    href={`/leaderboards?stat=${st}&scope=${scope}`}
                    className={
                      "rounded-[4px] border px-3 py-1.5 font-semibold uppercase tracking-[0.18em] transition " +
                      (active
                        ? "bg-amber-400 text-black border-amber-400 shadow-[0_0_0_1px_rgba(0,0,0,0.85),0_3px_0_0_rgba(0,0,0,0.9)]"
                        : "bg-black/50 border-slate-700 text-slate-200 hover:bg-black/70")
                    }
                  >
                    {statLabel(st)}
                  </a>
                );
              })}
            </div>
            {/* Scope toggles: All-time / Weekly / Monthly */}
            <div className="flex gap-1.5 justify-end">
              {scopes.map((sc) => {
                const active = sc === scope;
                return (
                  <a
                    key={sc}
                    href={`/leaderboards?stat=${stat}&scope=${sc}`}
                    className={
                      "rounded-[4px] border px-3 py-1.5 font-semibold uppercase tracking-[0.18em] transition " +
                      (active
                        ? "bg-sky-400 text-black border-sky-400 shadow-[0_0_0_1px_rgba(0,0,0,0.85),0_3px_0_0_rgba(0,0,0,0.9)]"
                        : "bg-black/50 border-slate-700 text-slate-200 hover:bg-black/70")
                    }
                  >
                    {scopeLabel(sc)}
                  </a>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      <LeaderboardClient rows={rows} statLabel={sLabel} scopeLabel={scLabel} />
    </main>
  );
}

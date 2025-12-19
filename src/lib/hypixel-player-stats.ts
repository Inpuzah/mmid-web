// src/lib/hypixel-player-stats.ts
//
// Thin helper around the Hypixel /player + /guild endpoints that:
// - extracts the Murder Mystery stats we care about for MMID
// - caches the raw payloads + derived stats in Prisma
// - exposes a small, stable shape for the directory to consume
//
// This is intentionally conservative about freshness: we treat any
// snapshot newer than SNAPSHOT_TTL_MS as fresh and never re-fetch
// automatically from the directory page. Maintainers can force a
// refresh via the existing "Hypixel" button on each directory card.

import { prisma } from "@/lib/prisma";
import { hypixelFetchJson } from "@/lib/hypixel-client";
import { withPgAdvisoryLock } from "@/lib/lock";

const SNAPSHOT_TTL_MS = 5 * 60 * 1000; // 5 minutes

export type DirectoryMmStats = {
  // Murder Mystery overall stats used by the MMID card.
  wins?: number | null;
  kills?: number | null;
  deaths?: number | null;
  kdr?: number | null;
  gamesPlayed?: number | null;

  murdererWins?: number | null;
  detectiveWins?: number | null;
  heroWins?: number | null;

  killsAsMurderer?: number | null;
  bowKills?: number | null;
  thrownKnifeKills?: number | null;
  trapKills?: number | null;
  heroKills?: number | null;

  bowKillsTotal?: number | null;
  suicides?: number | null;

  tokens?: number | null;
  goldPickedUp?: number | null;

  /**
   * Currently equipped Murder Mystery knife skin, as reported by Hypixel.
   * This comes from stats.MurderMystery.active_knife_skin and looks like
   * "knife_skin_shears", "knife_skin_rudolphs_snack", etc.
   */
  equippedKnifeSkin?: string | null;

  // Global Hypixel profile info we surface in the MMID panel.
  networkExp?: number | null;
  networkLevel?: number | null;
  achievementPoints?: number | null;
  karma?: number | null;
  rewardStreak?: number | null;
  totalDailyRewards?: number | null;
  totalRewards?: number | null;
  questsCompleted?: number | null;
  challengesCompleted?: number | null;
  giftsSent?: number | null;
  ranksGifted?: number | null;
  firstLogin?: number | null; // unix ms
  lastLogin?: number | null;  // unix ms

  /** Optional guild tag, e.g. "MMID" (without brackets). */
  guildTag?: string | null;

  /** Optional guild name colour from Hypixel guild data (e.g. "RED", "GOLD"). */
  guildColor?: string | null;

  /** Optional rank plus colour from Hypixel (e.g. "RED", "GOLD"). */
  rankPlusColor?: string | null;
};

export type DirectoryPlayerSnapshot = {
  uuid: string;
  mmStats: DirectoryMmStats | null;
  fetchedAt: Date;
};

// Hypixel uses nested stats under `stats.MurderMystery`. We only
// extract a curated subset that is generally meaningful across modes
// and matches the MMID stats card.
function extractMmStatsFromPlayer(player: any): DirectoryMmStats | null {
  if (!player || typeof player !== "object") return null;
  const mm = (player.stats && player.stats.MurderMystery) || undefined;
  if (!mm || typeof mm !== "object") return null;

  const num = (v: unknown): number | null => {
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  };

  const wins = num(mm.wins || mm.overall_wins);
  const kills = num(mm.kills || mm.overall_kills);
  const deaths = num(mm.deaths || mm.overall_deaths);
  const gamesPlayed = num(mm.games || mm.games_played || mm.total_games);

  const murdererWins = num(mm.murderer_wins || mm.wins_as_murderer);
  const detectiveWins = num(mm.detective_wins || mm.wins_as_detective);
  const heroWins = num(mm.hero_wins);

  // Hypixel has used multiple field names over time. In particular:
  // - some payloads report "knife_kills" instead of "kills_as_murderer" / "murderer_kills"
  // - thrown knife kills are usually "thrown_knife_kills"
  const killsAsMurderer = num(mm.kills_as_murderer || mm.murderer_kills || mm.knife_kills);
  const bowKills = num(mm.bow_kills || mm.bow_kills_murderer);
  const thrownKnifeKills = num(mm.thrown_knife_kills);
  const trapKills = num(mm.trap_kills);
  const heroKills = num(mm.hero_kills);

  const bowKillsTotal = num(mm.bow_kills_total || mm.bow_kills);
  const suicides = num(mm.suicides);

  const tokens = num(mm.tokens || mm.coins);

  // Hypixel sometimes exposes "coins_pickedup" rather than a dedicated gold counter.
  // We treat this as the best available proxy for "gold picked up" in the UI.
  const goldPickedUp = num(
    mm.gold_picked_up ||
      mm.gold_picked_up_total ||
      mm.coins_pickedup ||
      mm.coins_picked_up,
  );

  const equippedKnifeSkin = typeof mm.active_knife_skin === "string" ? mm.active_knife_skin : null;

  // Global profile fields live directly on the player object.
  const networkExp = num((player as any).networkExp);
  let networkLevel: number | null = null;
  if (networkExp != null) {
    // Official Hypixel network level formula.
    const raw = Math.sqrt(2 * networkExp + 30625) / 50 - 2.5;
    networkLevel = Number(raw.toFixed(2));
  }

  const achievementPoints = num((player as any).achievementPoints);
  const karma = num((player as any).karma);
  const rewardStreak = num((player as any).rewardStreak);
  const totalDailyRewards = num((player as any).totalDailyRewards);
  const totalRewards = num((player as any).totalRewards);

  // Quests: sum completions arrays across all quests, if present.
  let questsCompleted: number | null = null;
  const quests = (player as any).quests;
  if (quests && typeof quests === "object") {
    let total = 0;
    for (const key of Object.keys(quests)) {
      const q: any = (quests as any)[key];
      if (q && Array.isArray(q.completions)) total += q.completions.length;
    }
    questsCompleted = total;
  }

  // Challenges: some payloads expose an all_time map of challenge -> count.
  let challengesCompleted: number | null = null;
  const challenges = (player as any).challenges;
  if (challenges && typeof challenges === "object" && (challenges as any).all_time) {
    let totalC = 0;
    const allTime: any = (challenges as any).all_time;
    for (const key of Object.keys(allTime)) {
      const v = Number(allTime[key]);
      if (Number.isFinite(v)) totalC += v;
    }
    challengesCompleted = totalC;
  }

  // Gifting metadata.
  let giftsSent: number | null = null;
  let ranksGifted: number | null = null;
  const giftingMeta = (player as any).giftingMeta;
  if (giftingMeta && typeof giftingMeta === "object") {
    giftsSent = num((giftingMeta as any).giftsGiven);
    ranksGifted = num((giftingMeta as any).ranksGiven);
  }

  const firstLogin = num((player as any).firstLogin);
  const lastLogin = num((player as any).lastLogin);

  const rankPlusColorRaw = (player as any).rankPlusColor || (player as any).monthlyRankColor;
  const rankPlusColor = typeof rankPlusColorRaw === "string" ? rankPlusColorRaw : null;

  const kdr = kills != null && deaths != null && deaths > 0 ? Number((kills / deaths).toFixed(2)) : null;

  return {
    wins,
    kills,
    deaths,
    kdr,
    gamesPlayed,
    murdererWins,
    detectiveWins,
    heroWins,
    killsAsMurderer,
    bowKills,
    thrownKnifeKills,
    trapKills,
    heroKills,
    bowKillsTotal,
    suicides,
    tokens,
    goldPickedUp,
    equippedKnifeSkin,
    networkExp,
    networkLevel,
    achievementPoints,
    karma,
    rewardStreak,
    totalDailyRewards,
    totalRewards,
    questsCompleted,
    challengesCompleted,
    giftsSent,
    ranksGifted,
    firstLogin,
    lastLogin,
    rankPlusColor,
  };
}

function normalizeUuid(raw: string): string {
  return raw.replace(/-/g, "").toLowerCase();
}

export async function getCachedPlayerSnapshot(uuidRaw: string): Promise<DirectoryPlayerSnapshot | null> {
  const uuid = normalizeUuid(uuidRaw);
  const row = await prisma.hypixelPlayerSnapshot.findUnique({ where: { uuid } });
  if (!row) return null;

  const fetchedAt = row.fetchedAt;
  const ageMs = Date.now() - fetchedAt.getTime();

  const mmStats: DirectoryMmStats | null = row.mmStatsJson
    ? (row.mmStatsJson as unknown as DirectoryMmStats)
    : null;

  return { uuid, mmStats, fetchedAt };
}

const playerRefreshInFlight = new Map<string, Promise<DirectoryPlayerSnapshot>>();

function playerLockKey(uuidNoDashLower: string) {
  // Keep key1 stable; key2 is a cheap deterministic 32-bit hash.
  let h = 0;
  for (let i = 0; i < uuidNoDashLower.length; i++) {
    h = (h * 31 + uuidNoDashLower.charCodeAt(i)) | 0;
  }
  return { key1: 44872, key2: h };
}

async function refreshPlayerSnapshotFromHypixelImpl(
  uuidRaw: string,
  opts?: { player?: any; guild?: any },
): Promise<DirectoryPlayerSnapshot> {
  const uuid = normalizeUuid(uuidRaw);

  type HypixelPlayerRes = { success?: boolean; player?: any };
  type HypixelGuildRes = { success?: boolean; guild?: any };

  let playerPayload: any | null = opts?.player ?? null;
  let guildPayload: any | null = opts?.guild ?? null;

  if (!playerPayload || typeof playerPayload !== "object") {
    const [playerRes, guildRes] = (await Promise.all([
      hypixelFetchJson<HypixelPlayerRes>(`/player?uuid=${uuid}`, { revalidateSeconds: 60 }),
      hypixelFetchJson<HypixelGuildRes>(`/guild?player=${uuid}`, { revalidateSeconds: 60 * 5 }).catch(
        () => ({ success: false } as HypixelGuildRes),
      ),
    ])) as [HypixelPlayerRes, HypixelGuildRes];

    playerPayload = playerRes?.player ?? null;
    guildPayload = guildRes?.guild ?? null;
  }

  const player = playerPayload;
  const guild = guildPayload;

  let mmStats = extractMmStatsFromPlayer(player);

  // Attach guild tag/colour if available so the card can show [TAG] and guild colour.
  if (mmStats && guild && typeof guild === "object") {
    if (typeof (guild as any).tag === "string") {
      (mmStats as any).guildTag = (guild as any).tag as string;
    }
    const rawGuildColor =
      (guild as any).tagColor ||
      (guild as any).color ||
      (guild as any).nameColor ||
      null;
    if (typeof rawGuildColor === "string") {
      (mmStats as any).guildColor = rawGuildColor as string;
    }
  }

  const snapshot = await prisma.hypixelPlayerSnapshot.upsert({
    where: { uuid },
    create: {
      uuid,
      playerJson: player ?? {},
      guildJson: guild ?? undefined,
      mmStatsJson: mmStats ?? undefined,
    },
    update: {
      playerJson: player ?? {},
      guildJson: guild ?? undefined,
      mmStatsJson: mmStats ?? undefined,
      fetchedAt: new Date(),
    },
  });

  return {
    uuid,
    mmStats,
    fetchedAt: snapshot.fetchedAt,
  } satisfies DirectoryPlayerSnapshot;
}

// Force-refresh a player's snapshot from Hypixel and persist the result.
//
// This is used by maintainer/admin actions and should be safe to call from
// multiple concurrent requests: we coalesce per-process and also guard with
// a Postgres advisory lock across processes.
export async function refreshPlayerSnapshotFromHypixel(
  uuidRaw: string,
  opts?: { player?: any; guild?: any },
): Promise<DirectoryPlayerSnapshot> {
  const uuid = normalizeUuid(uuidRaw);

  const existing = playerRefreshInFlight.get(uuid);
  if (existing) return existing;

  const p = (async () => {
    const lockKey = playerLockKey(uuid);

    const locked = await withPgAdvisoryLock(lockKey, async () => {
      return await refreshPlayerSnapshotFromHypixelImpl(uuidRaw, opts);
    });

    if (locked.ran && locked.value) return locked.value;

    // Another process is refreshing; return cached data if available.
    const cached = await getCachedPlayerSnapshot(uuidRaw);
    if (cached) return cached;

    // If we can't read a cache yet, wait briefly and retry once.
    await new Promise((r) => setTimeout(r, 500));
    const cached2 = await getCachedPlayerSnapshot(uuidRaw);
    if (cached2) return cached2;

    // Worst case: proceed without lock. This should be rare.
    return await refreshPlayerSnapshotFromHypixelImpl(uuidRaw, opts);
  })();

  playerRefreshInFlight.set(uuid, p);
  p.finally(() => playerRefreshInFlight.delete(uuid));
  return p;
}

// Helper used by any backend consumer that wants "fresh enough" data
// without forcing a network call if the cache is still warm.
export async function getOrRefreshPlayerSnapshot(
  uuidRaw: string,
): Promise<DirectoryPlayerSnapshot | null> {
  const existing = await getCachedPlayerSnapshot(uuidRaw);
  if (existing && Date.now() - existing.fetchedAt.getTime() < SNAPSHOT_TTL_MS) {
    return existing;
  }

  try {
    return await refreshPlayerSnapshotFromHypixel(uuidRaw);
  } catch (err) {
    // If refreshing fails, fall back to stale data if we have it.
    if (existing) return existing;
    throw err;
  }
}
// src/lib/hypixel-player-stats.ts
//
// Updated version with Classic, Double Up, Assassins, Infection stats
//
// Thin helper around the Hypixel /player + /guild endpoints that:
// - extracts the Murder Mystery stats we care about for MMID
// - extracts the rest of the game modes (Assassins, Infection)
// - caches the raw payloads + derived stats in Prisma
// - exposes a small, stable shape for the directory to consume

import { prisma } from "@/lib/prisma";
import { hypixelFetchJson } from "@/lib/hypixel-client";
import { withPgAdvisoryLock } from "@/lib/lock";

// const SNAPSHOT_TTL_MS = 5 * 60 * 1000; // 5 minutes
const SNAPSHOT_TTL_MS = 0;

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

/** Murder Mystery overall stats used by the MMID card. */
export type MurderMysteryStats = {
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
  // heroKills?: number | null;

  bowKillsTotal?: number | null;
  suicides?: number | null;

  tokens?: number | null;
  goldPickedUp?: number | null;

  equippedKnifeSkin?: string | null;
};

/** Murder Mystery Classic mode specific stats */
export type MurderMysteryClassicStats = {
  wins?: number | null;
  kills?: number | null;
  deaths?: number | null;
  kdr?: number | null;
  gamesPlayed?: number | null;
  
  murdererWins?: number | null;
  detectiveWins?: number | null;
  heroWins?: number | null;
  
  killsAsMurderer?: number | null;
  trapKills?: number | null;
  bowKills?: number | null;
  thrownKnifeKills?: number | null;
};

/** Murder Mystery Double Up mode specific stats */
export type MurderMysteryDoubleUpStats = {
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
  trapKills?: number | null;
  thrownKnifeKills?: number | null;
};

/** Assassins game mode stats */
export type AssassinsStats = {
  kills?: number | null;
  deaths?: number | null;
  kdr?: number | null;
  wins?: number | null;
  gamesPlayed?: number | null;
  coins?: number | null;
};

/** Infection game mode stats */
export type InfectionStats = {
  kills?: number | null;
  deaths?: number | null;
  wins?: number | null;
  survivorWins?: number | null;
  infectedWins?: number | null;
  gamesPlayed?: number | null;
};

/** Complete stats for directory display */
export type DirectoryMmStats = {
  // Overall Murder Mystery stats (existing)
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
  // heroKills?: number | null;

  bowKillsTotal?: number | null;
  suicides?: number | null;

  tokens?: number | null;
  goldPickedUp?: number | null;

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
  firstLogin?: number | null;
  lastLogin?: number | null;

  guildTag?: string | null;
  guildColor?: string | null;
  rankPlusColor?: string | null;

  // ===== MORE GAME MODES =====
  
  /** Murder Mystery Classic mode breakdown */
  classic?: MurderMysteryClassicStats | null;
  
  /** Murder Mystery Double Up mode breakdown */
  doubleUp?: MurderMysteryDoubleUpStats | null;
  
  /** Assassins mode stats */
  assassins?: AssassinsStats | null;
  
  /** Infection mode stats */
  infection?: InfectionStats | null;
};

export type DirectoryPlayerSnapshot = {
  uuid: string;
  mmStats: DirectoryMmStats | null;
  fetchedAt: Date;
};

// ============================================================================
// EXTRACTION FUNCTIONS
// ============================================================================

/**
 * Helper: safely parse a number from unknown value
 */
function num(v: unknown): number | null {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

/**
 * Extract overall Murder Mystery stats from Hypixel player data
 */
function extractOverallMmStats(mm: any): MurderMysteryStats {
  const wins = num(mm.wins || mm.overall_wins);
  const kills = num(mm.kills || mm.overall_kills);
  const deaths = num(mm.deaths || mm.overall_deaths);
  const gamesPlayed = num(mm.games || mm.games_played || mm.total_games);

  const murdererWins = num(mm.murderer_wins || mm.wins_as_murderer);
  const detectiveWins = num(mm.detective_wins || mm.wins_as_detective);
  const heroWins = num(mm.was_hero);

  const killsAsMurderer = num(mm.kills_as_murderer || mm.murderer_kills || mm.knife_kills);
  const bowKills = num(mm.bow_kills || mm.bow_kills_murderer);
  const thrownKnifeKills = num(mm.thrown_knife_kills);
  const trapKills = num(mm.trap_kills);
  // const heroKills = num(mm.was_hero);

  const bowKillsTotal = num(mm.bow_kills_total || mm.bow_kills);
  const suicides = num(mm.suicides);

  const tokens = num(mm.tokens || mm.coins);
  const goldPickedUp = num(
    mm.gold_picked_up ||
    mm.gold_picked_up_total ||
    mm.coins_pickedup ||
    mm.coins_picked_up,
  );

  const equippedKnifeSkin = typeof mm.active_knife_skin === "string" ? mm.active_knife_skin : null;

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
    // heroKills,
    bowKillsTotal,
    suicides,
    tokens,
    goldPickedUp,
    equippedKnifeSkin,
  };
}

/**
 * Extract Murder Mystery CLASSIC mode stats
 * Hypixel uses prefixes like "wins_MURDER_CLASSIC", "kills_MURDER_CLASSIC", etc.
 */
function extractClassicStats(mm: any): MurderMysteryClassicStats | null {
  if (!mm || typeof mm !== "object") return null;

  const wins = num(mm.wins_MURDER_CLASSIC);
  const kills = num(mm.kills_MURDER_CLASSIC);
  const deaths = num(mm.deaths_MURDER_CLASSIC);
  const gamesPlayed = num(mm.games_MURDER_CLASSIC);
  
  const murdererWins = num(mm.murderer_wins_MURDER_CLASSIC);
  const detectiveWins = num(mm.detective_wins_MURDER_CLASSIC);
  const heroWins = num(mm.was_hero_MURDER_CLASSIC);
  
  const killsAsMurderer = num(mm.kills_as_murderer_MURDER_CLASSIC || mm.knife_kills_MURDER_CLASSIC);
  const trapKills = num(mm.trap_kills_MURDER_CLASSIC);
  const bowKills = num(mm.bow_kills_MURDER_CLASSIC);
  const thrownKnifeKills = num(mm.thrown_knife_kills_MURDER_CLASSIC);

  const kdr = kills != null && deaths != null && deaths > 0 
    ? Number((kills / deaths).toFixed(2)) 
    : null;

  // If no data, return null
  const hasData = wins != null || kills != null || deaths != null || gamesPlayed != null;
  if (!hasData) return null;

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
    trapKills,
    bowKills,
    thrownKnifeKills,
  };
}

/**
 * Extract Murder Mystery DOUBLE UP mode stats
 * Hypixel uses prefixes like "wins_MURDER_DOUBLE_UP", "kills_MURDER_DOUBLE_UP", etc.
 */
function extractDoubleUpStats(mm: any): MurderMysteryDoubleUpStats | null {
  if (!mm || typeof mm !== "object") return null;

  const wins = num(mm.wins_MURDER_DOUBLE_UP);
  const kills = num(mm.kills_MURDER_DOUBLE_UP);
  const deaths = num(mm.deaths_MURDER_DOUBLE_UP);
  const gamesPlayed = num(mm.games_MURDER_DOUBLE_UP);
  
  const murdererWins = num(mm.murderer_wins_MURDER_DOUBLE_UP);
  const detectiveWins = num(mm.detective_wins_MURDER_DOUBLE_UP);
  const heroWins = num(mm.was_hero_MURDER_DOUBLE_UP);

  
  const killsAsMurderer = num(mm.kills_as_murderer_MURDER_DOUBLE_UP || mm.knife_kills_MURDER_DOUBLE_UP);
  const bowKills = num(mm.bow_kills_MURDER_DOUBLE_UP);
  const trapKills = num(mm.trap_kills_MURDER_DOUBLE_UP);
  const thrownKnifeKills = num(mm.thrown_knife_kills_MURDER_DOUBLE_UP);

  const kdr = kills != null && deaths != null && deaths > 0 
    ? Number((kills / deaths).toFixed(2)) 
    : null;

  const hasData = wins != null || kills != null || deaths != null || gamesPlayed != null;
  if (!hasData) return null;

  return {
    wins,
    kills,
    deaths,
    kdr,
    gamesPlayed,
    murdererWins,
    detectiveWins,
    killsAsMurderer,
    bowKills,
    trapKills,
    heroWins,
    thrownKnifeKills
  };
}

/**
 * Extract Murder Mystery ASSASSINS mode stats
 * Hypixel uses prefixes like "wins_MURDER_ASSASSINS", etc.
 */
function extractAssassinsStats(mm: any): AssassinsStats | null {
  if (!mm || typeof mm !== "object") return null;

  const wins = num(mm.wins_MURDER_ASSASSINS);
  const kills = num(mm.kills_MURDER_ASSASSINS);
  const deaths = num(mm.deaths_MURDER_ASSASSINS);
  const gamesPlayed = num(mm.games_MURDER_ASSASSINS);
  const coins = num(mm.coins_MURDER_ASSASSINS);

  const kdr =
    kills != null && deaths != null && deaths > 0
      ? Number((kills / deaths).toFixed(2))
      : null;

  const hasData =
    wins != null || kills != null || deaths != null || gamesPlayed != null;

  if (!hasData) return null;

  return {
    wins,
    kills,
    deaths,
    kdr,
    gamesPlayed,
    coins,
  };
}


/**
 * Extract Murder Mystery INFECTION mode stats
 * Hypixel uses prefixes like "wins_MURDER_INFECTION", etc.
 */
function extractInfectionStats(mm: any): InfectionStats | null {
  if (!mm || typeof mm !== "object") return null;

  const wins = num(mm.wins_MURDER_INFECTION);
  const kills = num(mm.kills_MURDER_INFECTION);
  const deaths = num(mm.deaths_MURDER_INFECTION);
  const gamesPlayed = num(mm.games_MURDER_INFECTION);

  const survivorWins = num(mm.survivor_wins_MURDER_INFECTION);
  const infectedWins = num(mm.infected_wins_MURDER_INFECTION);

  const hasData =
    wins != null || kills != null || deaths != null || gamesPlayed != null;

  if (!hasData) return null;

  return {
    wins,
    kills,
    deaths,
    survivorWins,
    infectedWins,
    gamesPlayed,
  };
}


/**
 * Main extraction function that combines ALL game modes
 */
function extractMmStatsFromPlayer(player: any): DirectoryMmStats | null {
  if (!player || typeof player !== "object") return null;
  
  const mm = (player.stats && player.stats.MurderMystery) || undefined;

  
  if (!mm || typeof mm !== "object") return null;

  // Extract overall MM stats (existing code)
  const overallStats = extractOverallMmStats(mm);

  // Extract mode-specific stats
  const classic = extractClassicStats(mm);
  const doubleUp = extractDoubleUpStats(mm);
  const assassins = extractAssassinsStats(mm);
  const infection = extractInfectionStats(mm);

  // Global profile fields live directly on the player object.
  const networkExp = num((player as any).networkExp);
  let networkLevel: number | null = null;
  if (networkExp != null) {
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

  // Challenges
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

  // Gifting metadata
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

  return {
    ...overallStats,
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
    
    // MODE-SPECIFIC STATS
    classic,
    doubleUp,
    assassins,
    infection,
  };
}

// ============================================================================
// DATABASE OPERATIONS 
// ============================================================================

function normalizeUuid(raw: string): string {
  return raw.replace(/-/g, "").toLowerCase();
}

export async function getCachedPlayerSnapshot(uuidRaw: string): Promise<DirectoryPlayerSnapshot | null> {
  const uuid = normalizeUuid(uuidRaw);
  const row = await prisma.hypixelPlayerSnapshot.findUnique({ where: { uuid } });
  if (!row) return null;

  const fetchedAt = row.fetchedAt;
  const mmStats: DirectoryMmStats | null = row.mmStatsJson
    ? (row.mmStatsJson as unknown as DirectoryMmStats)
    : null;

  return { uuid, mmStats, fetchedAt };
}

const playerRefreshInFlight = new Map<string, Promise<DirectoryPlayerSnapshot>>();

function playerLockKey(uuidNoDashLower: string) {
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
  // console.log("REFRESH CALLED FOR:", uuidRaw);

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
  // console.log("MM keys:", Object.keys(player.stats?.MurderMystery || {}));

  let mmStats = extractMmStatsFromPlayer(player);

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

    const cached = await getCachedPlayerSnapshot(uuidRaw);
    if (cached) return cached;

    await new Promise((r) => setTimeout(r, 500));
    const cached2 = await getCachedPlayerSnapshot(uuidRaw);
    if (cached2) return cached2;

    return await refreshPlayerSnapshotFromHypixelImpl(uuidRaw, opts);
  })();

  playerRefreshInFlight.set(uuid, p);
  p.finally(() => playerRefreshInFlight.delete(uuid));
  return p;
}

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
    if (existing) return existing;
    throw err;
  }
}

// src/lib/hypixel-leaderboards.ts

import { prisma } from "./prisma";
import { hypixelFetchJson } from "./hypixel-client";

export type MmStatType = "kills" | "wins";
export type MmTimeScope = "weekly" | "monthly" | "alltime";

export type MmLeaderboardRow = {
  uuid: string;
  username: string | null;
  value: number | null;
  position: number; // 1-based rank
};

type HypixelLeaderboardBoard = {
  path: string; // e.g. "stats.MurderMystery.kills"
  prefix: string; // e.g. "weekly_murdermystery_kills"
  title: string; // e.g. "Weekly Kills"
  location?: string;
  count: number;
  leaders: string[]; // UUIDs (usually without dashes)
};

type HypixelLeaderboardsResponse = {
  success: boolean;
  leaderboards?: {
    [game: string]: HypixelLeaderboardBoard[];
  };
};

type HypixelPlayerResponse = {
  success: boolean;
  player?: any;
};

function inferStatType(board: HypixelLeaderboardBoard): MmStatType | null {
  const text = `${board.path} ${board.prefix} ${board.title}`.toLowerCase();
  if (text.includes("win")) return "wins";
  if (text.includes("kill")) return "kills";
  return null;
}

function inferScope(board: HypixelLeaderboardBoard): MmTimeScope | null {
  const text = `${board.path} ${board.prefix} ${board.title}`.toLowerCase();
  if (text.includes("weekly") || text.includes("week")) return "weekly";
  if (text.includes("monthly") || text.includes("month")) return "monthly";
  // Hypixel usually calls the permanent ones "overall" / "lifetime" etc.
  if (text.includes("overall") || text.includes("lifetime") || text.includes("general")) {
    return "alltime";
  }
  return null;
}

function getByDotPath(obj: any, path: string): any {
  return path.split(".").reduce((acc, key) => (acc == null ? undefined : acc[key]), obj);
}

// In-memory cache on top of Next's fetch cache so we don't hammer /player
// during a single snapshot refresh run.
const playerCache = new Map<string, { player: any; fetchedAt: number }>();
const PLAYER_TTL_MS = 1000 * 60 * 10; // 10 minutes

// To avoid burning through Hypixel's 300/5min limit, cap the number of
// leaderboard entries we resolve per refresh.
const MAX_LEADERS = 25;

async function fetchHypixelPlayer(uuid: string): Promise<any | null> {
  const key = uuid.replace(/-/g, "");
  const now = Date.now();
  const cached = playerCache.get(key);
  if (cached && now - cached.fetchedAt < PLAYER_TTL_MS) {
    return cached.player;
  }

  let res: HypixelPlayerResponse;
  try {
    res = await hypixelFetchJson<HypixelPlayerResponse>(`/player?uuid=${key}`);
  } catch (err) {
    console.error("Failed to load Hypixel /player for", key, err);
    return null;
  }
  if (!res.success || !res.player) return null;

  playerCache.set(key, { player: res.player, fetchedAt: now });
  return res.player;
}

/**
 * Low-level: fetches a Murder Mystery leaderboard directly from Hypixel.
 * This is intended for background refresh jobs, not for user-facing requests.
 */
export async function fetchMurderMysteryLeaderboardFromHypixel(
  statType: MmStatType,
  scope: MmTimeScope
): Promise<MmLeaderboardRow[]> {
  let data: HypixelLeaderboardsResponse;
  try {
    data = await hypixelFetchJson<HypixelLeaderboardsResponse>("/leaderboards");
  } catch (err) {
    console.error("Failed to load Hypixel /leaderboards:", err);
    return [];
  }

  const boards = data.leaderboards?.MURDER_MYSTERY ?? [];
  if (!boards.length) return [];

  // Try to find the board that matches the requested stat + scope.
  let selected: HypixelLeaderboardBoard | undefined;
  for (const b of boards) {
    const st = inferStatType(b);
    const sc = inferScope(b);
    if (st === statType && sc === scope) {
      selected = b;
      break;
    }
  }

  // Fallback: closest match on stat type, then any MM board.
  if (!selected) {
    selected =
      boards.find((b) => inferStatType(b) === statType) ??
      boards[0];
  }

  const leaders = (selected?.leaders ?? []).slice(0, MAX_LEADERS);
  if (!leaders.length) return [];

  const rows: MmLeaderboardRow[] = [];
  let position = 1;

  for (const raw of leaders) {
    const uuid = String(raw);
    const player = await fetchHypixelPlayer(uuid);

    if (!player) {
      rows.push({ uuid, username: null, value: null, position });
      position += 1;
      continue;
    }

    const statRaw = getByDotPath(player, selected.path);
    const value = typeof statRaw === "number" ? statRaw : Number(statRaw ?? 0) || null;
    const username =
      player.displayname ??
      player.playername ??
      player.username ??
      null;

    rows.push({
      uuid: player.uuid ?? uuid,
      username,
      value,
      position,
    });
    position += 1;
  }

  return rows;
}

const SNAPSHOT_MAX_AGE_MS = 1000 * 60 * 60 * 4; // 4 hours

/**
 * Public API used by the /leaderboards page.
 *
 * It reads from our own cached snapshot table first. If there is no snapshot,
 * or the latest one is stale, it will attempt a single background-style
 * refresh from Hypixel and store the result. If that fails, it falls back to
 * the last known snapshot (if any) so user-facing pages never spam Hypixel.
 */
export async function fetchMurderMysteryLeaderboard(
  statType: MmStatType,
  scope: MmTimeScope
): Promise<MmLeaderboardRow[]> {
  const now = Date.now();

  const existing = await prisma.hypixelMmLeaderboardSnapshot.findFirst({
    where: { stat: statType, scope },
    orderBy: { fetchedAt: "desc" },
  });

  const isFresh = existing && now - existing.fetchedAt.getTime() < SNAPSHOT_MAX_AGE_MS;

  if (isFresh) {
    return (existing.dataJson as unknown as MmLeaderboardRow[]) ?? [];
  }

  // Try to refresh from Hypixel once. This is still gated by the global
  // Hypixel client rate limiter and our MAX_LEADERS cap.
  try {
    const rows = await fetchMurderMysteryLeaderboardFromHypixel(statType, scope);

    if (rows.length) {
      await prisma.hypixelMmLeaderboardSnapshot.create({
        data: {
          stat: statType,
          scope,
          dataJson: rows as unknown as object,
          fetchedAt: new Date(),
        },
      });
      return rows;
    }
  } catch (err) {
    console.error("Failed to refresh Hypixel MM leaderboard snapshot", { statType, scope, err });
  }

  // Fall back to whatever we have cached, even if stale.
  if (existing) {
    return (existing.dataJson as unknown as MmLeaderboardRow[]) ?? [];
  }

  return [];
}

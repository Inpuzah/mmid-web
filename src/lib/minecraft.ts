// src/lib/minecraft.ts
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const isUuidLike = (v: string) => /^[0-9a-fA-F-]{32,36}$/.test(v);
const stripDashes = (v: string) => v.replace(/-/g, "");

async function fetchJson<T>(url: string, init?: RequestInit) {
  const res = await fetch(url, { ...init, next: { revalidate: 60 } });
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  return (await res.json()) as T;
}

export async function resolveNameByUuid(uuidDashed: string) {
  const id = stripDashes(uuidDashed);
  const prof = await fetchJson<{ name: string }>(
    `https://sessionserver.mojang.com/session/minecraft/profile/${id}`
  );
  return prof?.name ?? null;
}

export function hypixelRank(p: any): string | null {
  if (!p) return null;
  if (p.rank && p.rank !== "NORMAL") return p.rank; // ADMIN, YOUTUBER, etc
  if (p.monthlyPackageRank === "SUPERSTAR") return "MVP++";
  if (p.newPackageRank) return String(p.newPackageRank).replace(/_/g, " ");
  return null;
}

import { hypixelFetchJson } from "./hypixel-client";
import { prisma } from "@/lib/prisma";

export async function getHypixelMeta(uuidDashed: string) {
  const id = stripDashes(uuidDashed);

  let rank: string | null = null;
  let guild: string | null = null;

  try {
    const player = await hypixelFetchJson<any>(`/player?uuid=${id}`);
    rank = hypixelRank(player?.player) ?? null;
  } catch {}

  try {
    const g = await hypixelFetchJson<any>(`/guild?player=${id}`);
    guild = g?.guild?.name ?? null;
  } catch {}

  return { rank, guild };
}

/* --------------------------------------------------------------------------
 * Mojang + OptiFine skin / cape snapshots
 * -------------------------------------------------------------------------- */

export type MinecraftTextureHistoryItem = {
  url: string;
  fetchedAt: string; // ISO
};

export type MinecraftTextureHistory = {
  skinHistory: MinecraftTextureHistoryItem[];
  mojangCapeHistory: MinecraftTextureHistoryItem[];
  optifineCapeHistory: MinecraftTextureHistoryItem[];
};

type MojangProfileProperty = { name: string; value: string };
type MojangProfile = {
  id: string;
  name: string;
  properties?: MojangProfileProperty[];
};

type MojangTexturesPayload = {
  timestamp?: number;
  profileId?: string;
  profileName?: string;
  textures?: {
    SKIN?: { url?: string };
    CAPE?: { url?: string };
  };
};

function decodeBase64Json<T = unknown>(value: string): T | null {
  try {
    if (typeof (globalThis as any).atob === "function") {
      const json = (globalThis as any).atob(value);
      return JSON.parse(json) as T;
    }
    const B = (globalThis as any).Buffer;
    if (B && typeof B.from === "function") {
      const json = B.from(value, "base64").toString("utf8");
      return JSON.parse(json) as T;
    }
  } catch {
    // ignore
  }
  return null;
}

/**
 * Fetch the current Mojang SKIN + CAPE textures for a UUID (no dashes).
 */
async function fetchMojangTextures(uuidNoDash: string) {
  try {
    const prof = await fetchJson<MojangProfile>(
      `https://sessionserver.mojang.com/session/minecraft/profile/${uuidNoDash}?unsigned=false`,
    );
    const texProp = (prof.properties || []).find((p) => p.name === "textures");
    if (!texProp?.value) return { profile: prof, textures: null as MojangTexturesPayload | null };

    const payload = decodeBase64Json<MojangTexturesPayload>(texProp.value);
    return { profile: prof, textures: payload };
  } catch {
    return { profile: null as MojangProfile | null, textures: null as MojangTexturesPayload | null };
  }
}

/**
 * Best-effort probe for an OptiFine cape for the given username.
 */
async function fetchOptifineCape(username: string): Promise<string | null> {
  if (!username) return null;
  const url = `https://optifine.net/capes/${encodeURIComponent(username)}.png`;
  try {
    const res = await fetch(url, {
      method: "HEAD",
      next: { revalidate: 60 },
    });
    if (!res.ok) return null;
    return res.url || url;
  } catch {
    return null;
  }
}

/**
 * Take and persist a MinecraftProfileSnapshot for the given player.
 */
export async function refreshMinecraftProfileSnapshot(uuidDashed: string, username: string) {
  const uuidNoDash = stripDashes(uuidDashed).toLowerCase();

  const [{ textures }, optifineCapeUrl] = await Promise.all([
    fetchMojangTextures(uuidNoDash),
    fetchOptifineCape(username),
  ]);

  const skinUrl = textures?.textures?.SKIN?.url ?? null;
  const mojangCapeUrl = textures?.textures?.CAPE?.url ?? null;

  const snapshot = await prisma.minecraftProfileSnapshot.create({
    data: {
      uuid: uuidNoDash,
      username,
      skinUrl,
      mojangCapeUrl,
      optifineCapeUrl,
      texturesJson: textures ?? undefined,
    },
  });

  return snapshot;
}

/**
 * Read a grouped, de-duplicated history of skins and capes for a UUID.
 */
export async function getMinecraftTextureHistory(uuidDashed: string): Promise<MinecraftTextureHistory> {
  const uuidNoDash = stripDashes(uuidDashed).toLowerCase();

  const rows = await prisma.minecraftProfileSnapshot.findMany({
    where: { uuid: uuidNoDash },
    orderBy: { fetchedAt: "desc" },
  });

  const skinHistory: MinecraftTextureHistoryItem[] = [];
  const mojangCapeHistory: MinecraftTextureHistoryItem[] = [];
  const optifineCapeHistory: MinecraftTextureHistoryItem[] = [];

  const pushUnique = (list: MinecraftTextureHistoryItem[], url: string | null | undefined, fetchedAt: Date) => {
    if (!url) return;
    if (list.some((i) => i.url === url)) return;
    list.push({ url, fetchedAt: fetchedAt.toISOString() });
  };

  for (const r of rows) {
    pushUnique(skinHistory, r.skinUrl, r.fetchedAt);
    pushUnique(mojangCapeHistory, r.mojangCapeUrl, r.fetchedAt);
    pushUnique(optifineCapeHistory, r.optifineCapeUrl, r.fetchedAt);
  }

  return { skinHistory, mojangCapeHistory, optifineCapeHistory };
}

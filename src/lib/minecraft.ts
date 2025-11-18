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

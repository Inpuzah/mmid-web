// src/app/entries/new/actions.ts
"use server";

import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/auth";
import { revalidatePath } from "next/cache";
import { verifyHCaptcha } from "@/lib/captcha";
import { redirect } from "next/navigation";
import type { Prisma } from "@prisma/client";
import { headers } from "next/headers";

/* ────────────────────────────────────────────────────────────
   Helpers
   ──────────────────────────────────────────────────────────── */
function isMaintainerOrAdmin(role?: string | null) {
  return !!role && ["ADMIN", "MAINTAINER"].includes(role);
}
const isUuidLike = (v: string) => /^[0-9a-fA-F-]{32,36}$/.test(v);
const stripDashes = (v: string) => v.replace(/-/g, "");
const addDashes = (v: string) =>
  v.length === 32
    ? `${v.slice(0, 8)}-${v.slice(8, 12)}-${v.slice(12, 16)}-${v.slice(16, 20)}-${v.slice(20)}`
    : v;

async function fetchJson<T>(url: string, init?: RequestInit) {
  const res = await fetch(url, { ...init, next: { revalidate: 60 } });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return (await res.json()) as T;
}

function hypixelRank(p: any): string | null {
  if (!p) return null;
  if (p.rank && p.rank !== "NORMAL") return p.rank; // ADMIN, YOUTUBER, etc
  if (p.monthlyPackageRank === "SUPERSTAR") return "MVP++";
  if (p.newPackageRank) return String(p.newPackageRank).replace(/_/g, " ");
  return null;
}

// Next 15: headers() returns a Promise
async function getClientMeta() {
  const h = await headers();
  const ipRaw = h.get("x-forwarded-for") || h.get("x-real-ip") || "";
  const ip = ipRaw.split(",")[0]?.trim() || undefined;
  const userAgent = h.get("user-agent") || undefined;
  return { ip, userAgent };
}

async function resolveActorId(session: any): Promise<string | undefined> {
  let actorId = (session?.user as any)?.id as string | undefined;
  if (!actorId && session?.user?.email) {
    const u = await prisma.user.findUnique({ where: { email: session.user.email } });
    actorId = u?.id;
  }
  return actorId;
}

// Local enums (Prisma.* enums not exported in your client)
type ProposalAction = "CREATE" | "UPDATE" | "DELETE";
type AuditAction =
  | "PROPOSAL_CREATED"
  | "PROPOSAL_APPROVED"
  | "PROPOSAL_REJECTED"
  | "ENTRY_CREATED"
  | "ENTRY_UPDATED"
  | "ENTRY_DELETED"
  | "USER_ROLE_CHANGED"
  | "AUTH_SIGNIN";

// Ensure JSON-safe values for audit meta
const toJson = (v: any) => JSON.parse(JSON.stringify(v)) as Prisma.InputJsonValue;

/* ────────────────────────────────────────────────────────────
   SERVER ACTION: Lookup Mojang + Hypixel and return prefill
   ──────────────────────────────────────────────────────────── */
export type PrefillState = {
  ok: boolean;
  error?: string | null;
  prefill?: {
    uuid: string;
    username: string;
    guild: string | null;
    rank: string | null;
    skinUrl: string;   // for preview
    headUrl: string;   // for small avatar
  } | null;
};

export async function lookupMinecraft(_: PrefillState, formData: FormData): Promise<PrefillState> {
  const session = await getServerSession(authOptions);
  if (!session) return { ok: false, error: "Unauthorized" }; // any authed user can look up

  const raw = String(formData.get("query") ?? "").trim();
  if (!raw) return { ok: false, error: "Enter a UUID or username" };

  try {
    // 1) Resolve username/uuid via Mojang
    let uuidNoDash = "";
    let username = "";

    if (isUuidLike(raw)) {
      uuidNoDash = stripDashes(raw);
      const prof = await fetchJson<{ name: string }>(
        `https://sessionserver.mojang.com/session/minecraft/profile/${uuidNoDash}`
      );
      username = prof?.name ?? "";
    } else {
      const prof = await fetchJson<{ id: string; name: string }>(
        `https://api.mojang.com/users/profiles/minecraft/${encodeURIComponent(raw)}`
      );
      uuidNoDash = prof?.id ?? "";
      username = prof?.name ?? raw;
      if (!uuidNoDash) throw new Error("Username not found");
    }
    if (!uuidNoDash) throw new Error("Could not resolve UUID");

    const uuidDashed = addDashes(uuidNoDash);

    // 2) Hypixel: rank + guild
    let rank: string | null = null;
    let guild: string | null = null;

    const key = process.env.HYPIXEL_API_KEY;
    const h = key ? { "API-Key": key } : undefined;

    try {
      const player = await fetchJson<any>(`https://api.hypixel.net/player?uuid=${uuidNoDash}`, { headers: h });
      rank = hypixelRank(player?.player) ?? null;
    } catch {}
    try {
      const guildRes = await fetchJson<any>(`https://api.hypixel.net/guild?player=${uuidNoDash}`, { headers: h });
      guild = guildRes?.guild?.name ?? null;
    } catch {}

    // 3) Skin preview – use 3D bust for the large preview, simple head for small avatar
    const skinUrl = `https://visage.surgeplay.com/bust/256/${encodeURIComponent(username)}.png`;
    const headUrl = `https://mc-heads.net/avatar/${encodeURIComponent(username)}/80`;

    return {
      ok: true,
      prefill: { uuid: uuidDashed, username, guild, rank, skinUrl, headUrl },
    };
  } catch (e: any) {
    return { ok: false, error: e?.message ?? "Lookup failed" };
  }
}

/* ────────────────────────────────────────────────────────────
   SERVER ACTION: Save
   - ADMIN/MAINTAINER: apply directly to MmidEntry (merge/replace safe) + audit
   - USER: verify hCaptcha, create Proposal(PENDING) + audit, redirect with notice
   ──────────────────────────────────────────────────────────── */
export async function upsertEntry(formData: FormData) {
  const session = await getServerSession(authOptions);
  if (!session) throw new Error("Unauthorized");

  const role = (session?.user as any)?.role ?? "USER";
  const { ip, userAgent } = await getClientMeta();

  const getS = (k: string) => {
    const v = formData.get(k);
    return typeof v === "string" ? v.trim() : "";
  };
  const getAll = (k: string) => formData.getAll(k).map(String).map((s) => s.trim()).filter(Boolean);

  // Explicit targetUuid tells us which existing row is being edited
  const targetUuid = getS("targetUuid") || null;

  const uuid = getS("uuid");
  const username = getS("username");
  if (!uuid) throw new Error("UUID is required");
  if (!username) throw new Error("Username is required");

  const guild = getS("guild") || null;
  const status = getS("status") || null;
  const rank = getS("rank") || null;

  const typeOfCheating = Array.from(new Set(getAll("typeOfCheating")));
  const redFlags = Array.from(new Set(getAll("redFlags")));

  // Reviewer default
  const reviewerInput = getS("reviewedBy");
  const reviewedBy = reviewerInput || (session?.user?.name ?? session?.user?.email ?? null);

  const cs = getS("confidenceScore");
  const n = Number(cs);
  const confidenceScore = Number.isFinite(n) ? Math.max(0, Math.min(5, Math.trunc(n))) : null;

  const notesEvidence = getS("notesEvidence") || null;

  const lu = getS("lastUpdated");
  let lastUpdated = lu ? (isNaN(new Date(lu).getTime()) ? null : new Date(lu)) : null;

  let nameMcLink = getS("nameMcLink") || null;
  if (!nameMcLink && uuid) nameMcLink = `https://namemc.com/profile/${encodeURIComponent(uuid)}`;

  const payload = {
    uuid, username, guild, status, rank,
    typeOfCheating, reviewedBy, confidenceScore, redFlags,
    notesEvidence, lastUpdated, nameMcLink,
  } satisfies Prisma.MmidEntryUncheckedCreateInput;

  // Determine if we're editing an existing entry
  const existing = targetUuid
    ? await prisma.mmidEntry.findUnique({ where: { uuid: targetUuid } })
    : await prisma.mmidEntry.findUnique({ where: { uuid } });

  // ADMIN/MAINTAINER: apply immediately
  if (isMaintainerOrAdmin(role)) {
    const actorId = await resolveActorId(session);

    // If no lastUpdated was provided, stamp it with "now" for maintainer edits
    if (!lastUpdated) {
      payload.lastUpdated = new Date();
    }

    await prisma.$transaction(async (tx) => {
      // If editing and UUID changed, replace the row (avoid duplicates)
      if (existing && targetUuid && uuid !== targetUuid) {
        // record previous username before replacement
        if (existing.username && existing.username !== payload.username) {
          await tx.mmidUsernameHistory.create({
            data: {
              entryUuid: targetUuid,
              username: existing.username,
            },
          });
        }

        await tx.mmidEntry.delete({ where: { uuid: targetUuid } });
        await tx.mmidEntry.upsert({
          where: { uuid },
          create: payload,
          update: payload,
        });
        await tx.auditLog.create({
          data: {
            action: "ENTRY_UPDATED" as AuditAction,
            actorId,
            targetType: "MmidEntry",
            targetId: uuid,
            meta: toJson({ replacedUuid: targetUuid, payload }),
            ip,
            userAgent,
          },
        });
      } else {
        const key = existing?.uuid ?? uuid;
        const created = !existing;

        if (existing && existing.username && existing.username !== payload.username) {
          await tx.mmidUsernameHistory.create({
            data: {
              entryUuid: existing.uuid,
              username: existing.username,
            },
          });
        }

        await tx.mmidEntry.upsert({
          where: { uuid: key },
          create: { ...payload, uuid: key },
          update: payload,
        });
        await tx.auditLog.create({
          data: {
            action: (created ? "ENTRY_CREATED" : "ENTRY_UPDATED") as AuditAction,
            actorId,
            targetType: "MmidEntry",
            targetId: key,
            meta: toJson({ payload }),
            ip,
            userAgent,
          },
        });
      }
    });

    revalidatePath("/directory");
    redirect("/directory?notice=entry-saved");
  }

  // USER: verify hCaptcha then create proposal (PENDING)
  const captchaToken = getS("hcaptcha_token");
  const captchaOK = await verifyHCaptcha(captchaToken);
  if (!captchaOK) throw new Error("Captcha verification failed");

  // Resolve proposer
  let proposerId = (session?.user as any)?.id as string | undefined;
  if (!proposerId && session.user?.email) {
    const u = await prisma.user.findUnique({ where: { email: session.user.email } });
    proposerId = u?.id;
  }
  if (!proposerId) throw new Error("Unable to resolve user id");

  const action: ProposalAction = existing ? "UPDATE" : "CREATE";

  const proposedData = {
    ...payload,
    lastUpdated: lastUpdated ? lastUpdated.toISOString() : null,
  };

  const proposal = await prisma.mmidEntryProposal.create({
    data: {
      action,
      status: "PENDING",
      targetUuid: existing ? (targetUuid ?? uuid) : null, // lock the row being edited
      proposedData,
      proposerId,
    },
  });

  // Audit: proposal created
  await prisma.auditLog.create({
    data: {
      action: "PROPOSAL_CREATED" as AuditAction,
      actorId: proposerId,
      targetType: "Proposal",
      targetId: proposal.id,
      meta: toJson({ action, targetUuid: proposal.targetUuid, proposedData }),
      ip,
      userAgent,
    },
  });

  // Back to directory with a flash
  redirect("/directory?notice=proposal-submitted");
}

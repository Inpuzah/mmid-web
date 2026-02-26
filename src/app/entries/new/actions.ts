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
import { hypixelFetchJson } from "@/lib/hypixel-client";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { assertReportSchemaReady, isReportSchemaReady } from "@/lib/report-schema";

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

type AuditAction =
  | "ENTRY_CREATED"
  | "ENTRY_UPDATED"
  | "ENTRY_DELETED"
  | "USER_ROLE_CHANGED"
  | "AUTH_SIGNIN";

// Ensure JSON-safe values for audit meta
const toJson = (v: any) => JSON.parse(JSON.stringify(v)) as Prisma.InputJsonValue;

const STATUS_TAG_OPTIONS = [
  "Alt",
  "Needs Reviewed",
  "Legit",
  "History",
  "Confirmed Cheater",
  "Teaming",
] as const;

const CHEATING_TAG_OPTIONS = [
  "N/A",
  "General Hack Client",
  "ESP / X-Ray",
  "Blink",
  "Murder Finder/Callout",
  "Consistent Teaming",
  "Exploiter (Bug Abuse)",
  "Resource Pack Abuse/Large Knives Abuse",
  "Other",
  "Boosting",
] as const;

const RED_FLAG_OPTIONS = [
  "Inconclusive",
  "Generally nice person",
  "Previously Banned",
  "Doxxer",
  "Catfish",
  "Harasses Others",
  "Pedophile",
  "Beamer",
] as const;

function normalizeSelectedTags(values: string[], allowed: readonly string[]) {
  const allowedSet = new Set(allowed);
  return Array.from(new Set(values.filter((value) => allowedSet.has(value))));
}

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

    // 2) Hypixel: rank + guild (optional)
    let rank: string | null = null;
    let guild: string | null = null;

    const canUseHypixel = Boolean(process.env.HYPIXEL_API_KEY);

    if (canUseHypixel) {
      try {
        const player = await hypixelFetchJson<any>(`/player?uuid=${uuidNoDash}`, { revalidateSeconds: 60 });
        rank = hypixelRank(player?.player) ?? null;
      } catch {}

      try {
        const guildRes = await hypixelFetchJson<any>(`/guild?player=${uuidNoDash}`, { revalidateSeconds: 60 });
        guild = guildRes?.guild?.name ?? null;
      } catch {}
    }

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
  SERVER ACTION: Maintainer entry upsert
  ──────────────────────────────────────────────────────────── */
function safeReturnTo(formData: FormData): string | null {
  const v = formData.get("returnTo");
  if (typeof v !== "string") return null;
  const s = v.trim();
  if (!s.startsWith("/")) return null;
  // Prevent protocol-relative URLs like "//evil.com".
  if (s.startsWith("//")) return null;
  return s;
}

function withQuery(basePath: string, params: Record<string, string>) {
  // Use a dummy origin to make URL parsing safe in Node.
  const u = new URL(basePath, "http://local");
  for (const [k, v] of Object.entries(params)) u.searchParams.set(k, v);
  return u.pathname + (u.search ? u.search : "");
}

export async function upsertEntry(formData: FormData) {
  const session = await getServerSession(authOptions);
  if (!session) throw new Error("Unauthorized");

  const role = (session?.user as any)?.role ?? "USER";
  if (!isMaintainerOrAdmin(role)) throw new Error("Forbidden");
  const { ip, userAgent } = await getClientMeta();

  const returnTo = safeReturnTo(formData) ?? "/directory";

  const getS = (k: string) => {
    const v = formData.get(k);
    return typeof v === "string" ? v.trim() : "";
  };
  const getAll = (k: string) => formData.getAll(k).map(String).map((s) => s.trim()).filter(Boolean);

  // Explicit targetUuid tells us which existing row is being edited
  const targetUuid = getS("targetUuid") || null;
  const reportId = getS("reportId") || null;

  const reportsReady = await isReportSchemaReady();
  if (!reportsReady) {
    redirect(withQuery(returnTo, { notice: "directory-report-schema-missing" }));
  }

  if (!reportId) {
    redirect(withQuery(returnTo, { notice: "directory-report-context-required" }));
  }

  const uuid = getS("uuid");
  const username = getS("username");
  if (!uuid) throw new Error("UUID is required");
  if (!username) throw new Error("Username is required");

  const reportDb = prisma as any;
  const report = await reportDb.report.findUnique({
    where: { id: reportId },
    select: {
      id: true,
      status: true,
      subjectUsername: true,
      subjectUuid: true,
      reviewedBy: {
        select: {
          name: true,
          email: true,
        },
      },
      attachments: {
        select: {
          id: true,
        },
      },
    },
  });

  if (!report || !["APPROVED_FOR_MAINTAINER", "MAINTAINER_DRAFT"].includes(report.status)) {
    redirect(withQuery(returnTo, { notice: "directory-report-invalid" }));
  }

  const normalizeUuid = (value: string) => value.replace(/-/g, "").toLowerCase();
  const activeTargetUuid = targetUuid ?? uuid;
  const reportSubjectUuid = report.subjectUuid ? normalizeUuid(String(report.subjectUuid)) : null;
  const targetUuidNorm = normalizeUuid(activeTargetUuid);
  const usernameMatches = (report.subjectUsername ?? "").trim().toLowerCase() === username.toLowerCase();
  const uuidMatches = reportSubjectUuid ? reportSubjectUuid === targetUuidNorm : true;

  if (!uuidMatches || (!reportSubjectUuid && !usernameMatches)) {
    redirect(withQuery(returnTo, { notice: "directory-report-mismatch" }));
  }

  const guild = getS("guild") || null;
  const rank = getS("rank") || null;

  const statusTags = normalizeSelectedTags(getAll("statusTags"), STATUS_TAG_OPTIONS);
  const status = statusTags.length > 0 ? statusTags.join(", ") : null;
  const typeOfCheating = normalizeSelectedTags(getAll("typeOfCheating"), CHEATING_TAG_OPTIONS);
  const redFlags = normalizeSelectedTags(getAll("redFlags"), RED_FLAG_OPTIONS);

  // Reviewer default
  const reviewerInput = getS("reviewedBy");
  const reviewedBy =
    reviewerInput ||
    report.reviewedBy?.name ||
    report.reviewedBy?.email ||
    (session?.user?.name ?? session?.user?.email ?? null);

  const cs = getS("confidenceScore");
  const n = Number(cs);
  const confidenceScore = Number.isFinite(n) ? Math.max(1, Math.min(5, Math.trunc(n))) : null;

  const notesRaw = getS("notesEvidence");
  const attachmentsRaw = getS("notesAttachments");

  if (typeOfCheating.includes("Other") && notesRaw.trim().length === 0) {
    throw new Error("When Type of cheating includes Other, explain details in Notes");
  }

  const hiddenAttachmentIds = new Set(getAll("hiddenAttachmentIds"));
  const allowedAttachmentIds = new Set((report.attachments ?? []).map((item: { id: string }) => item.id));
  const hiddenIds = Array.from(hiddenAttachmentIds).filter((id) => allowedAttachmentIds.has(id));

  let notesEvidence: string | null = null;
  if (notesRaw || attachmentsRaw) {
    const parts: string[] = [];
    if (notesRaw) parts.push(notesRaw);
    if (attachmentsRaw) {
      // Store attachments after a marker so the UI can hide/show them separately.
      parts.push("---ATTACHMENTS---\n" + attachmentsRaw.trim());
    }
    notesEvidence = parts.join("\n\n");
  }

  const lu = getS("lastUpdated");
  let lastUpdated = lu ? (isNaN(new Date(lu).getTime()) ? null : new Date(lu)) : null;

  let nameMcLink = getS("nameMcLink") || null;
  if (!nameMcLink && uuid) nameMcLink = `https://namemc.com/profile/${encodeURIComponent(uuid)}`;

  const payload: any = {
    uuid, username, guild, status, rank,
    statusTags,
    typeOfCheating, reviewedBy, confidenceScore, redFlags,
    notesEvidence, lastUpdated, nameMcLink,
  };

  // Determine if we're editing an existing entry
  const existing = targetUuid
    ? await prisma.mmidEntry.findUnique({ where: { uuid: targetUuid } })
    : await prisma.mmidEntry.findUnique({ where: { uuid } });

  const actorId = await resolveActorId(session);

  if (!lastUpdated) {
    payload.lastUpdated = new Date();
  }

  await prisma.$transaction(async (tx) => {
    if (existing && targetUuid && uuid !== targetUuid) {
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
          meta: toJson({ reportId, replacedUuid: targetUuid, payload }),
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
          meta: toJson({ reportId, payload }),
          ip,
          userAgent,
        },
      });
    }

    await (tx as any).reportAttachment.updateMany({
      where: { reportId },
      data: { hideFromDirectory: false },
    });

    if (hiddenIds.length > 0) {
      await (tx as any).reportAttachment.updateMany({
        where: {
          reportId,
          id: { in: hiddenIds },
        },
        data: { hideFromDirectory: true },
      });
    }

    await tx.report.update({
      where: { id: reportId },
      data: {
        status: "RESOLVED",
        resolvedAt: new Date(),
      },
    });
  });

  revalidatePath("/directory");
  revalidatePath("/maintainer/queue");
  revalidatePath("/maintainer/reports");

  redirect(withQuery(returnTo, { notice: "entry-saved", reportId }));
}

function normalizeSeverity(raw: string): "LOW" | "MED" | "HI" {
  const value = raw.trim().toLowerCase();
  if (value === "low") return "LOW";
  if (value === "med" || value === "medium") return "MED";
  if (value === "hi" || value === "high") return "HI";
  return "MED";
}

function sanitizeFilename(name: string) {
  return name.replace(/[^a-zA-Z0-9._-]/g, "_");
}

async function saveReportAttachment(reportId: string, file: File, index: number) {
  const safeOriginal = sanitizeFilename(file.name || `attachment-${index + 1}`);
  const stamp = `${Date.now()}-${index}`;
  const filename = `${stamp}-${safeOriginal}`;

  const relativeDir = path.join("uploads", "reports", reportId);
  const absoluteDir = path.join(process.cwd(), "public", relativeDir);
  await mkdir(absoluteDir, { recursive: true });

  const absoluteFilePath = path.join(absoluteDir, filename);
  const bytes = Buffer.from(await file.arrayBuffer());
  await writeFile(absoluteFilePath, bytes);

  const publicPath = `/${relativeDir.replace(/\\/g, "/")}/${filename}`;
  return {
    originalName: file.name || `attachment-${index + 1}`,
    mimeType: file.type || null,
    sizeBytes: file.size,
    storagePath: publicPath,
  };
}

export async function submitReport(formData: FormData) {
  await assertReportSchemaReady();
  const session = await getServerSession(authOptions);
  if (!session) throw new Error("Unauthorized");

  const getS = (key: string) => {
    const value = formData.get(key);
    return typeof value === "string" ? value.trim() : "";
  };
  const getAllStrings = (key: string) =>
    formData
      .getAll(key)
      .map((value) => String(value).trim())
      .filter(Boolean);

  const subjectUsername = getS("subjectUsername");
  const subjectUuid = getS("subjectUuid") || null;
  const subjectRank = getS("subjectRank") || null;
  const subjectGuild = getS("subjectGuild") || null;
  const reason = getS("reason");
  const severity = normalizeSeverity(getS("severity"));
  const evidenceDescription = getS("evidenceDescription");

  const replayIds = Array.from(new Set(getAllStrings("replayIds")));
  const videoLinks = Array.from(new Set(getAllStrings("videoLinks")));
  const files = formData
    .getAll("evidenceFiles")
    .filter((item): item is File => item instanceof File && item.size > 0);

  if (!subjectUsername) throw new Error("Username is required");
  if (!reason) throw new Error("Reason is required");
  if (!evidenceDescription) throw new Error("Evidence description is required");
  if (replayIds.length === 0 && videoLinks.length === 0 && files.length === 0) {
    throw new Error("At least one evidence item is required");
  }

  if (process.env.HCAPTCHA_SITE_KEY) {
    const captchaToken = getS("hcaptcha_token");
    const captchaOK = await verifyHCaptcha(captchaToken);
    if (!captchaOK) throw new Error("Captcha verification failed");
  }

  let reporterId = (session.user as any)?.id as string | undefined;
  if (!reporterId && session.user?.email) {
    const user = await prisma.user.findUnique({ where: { email: session.user.email } });
    reporterId = user?.id;
  }
  if (!reporterId) throw new Error("Unable to resolve user id");

  if (files.length > 8) {
    throw new Error("You can upload up to 8 files per report");
  }
  for (const file of files) {
    if (file.size > 20 * 1024 * 1024) {
      throw new Error(`File ${file.name} is too large (max 20MB each)`);
    }
  }

  const reportDb = prisma as any;

  const report = await reportDb.report.create({
    data: {
      reporterId,
      subjectUsername,
      subjectUuid,
      subjectRank,
      subjectGuild,
      reason,
      severity,
      evidenceDescription,
      replayEvidence:
        replayIds.length > 0
          ? { create: replayIds.map((replayId) => ({ replayId })) }
          : undefined,
      videoEvidence:
        videoLinks.length > 0
          ? { create: videoLinks.map((url) => ({ url })) }
          : undefined,
    },
  });

  if (files.length > 0) {
    const attachments = [] as Array<{
      originalName: string;
      mimeType: string | null;
      sizeBytes: number;
      storagePath: string;
    }>;
    for (let index = 0; index < files.length; index += 1) {
      attachments.push(await saveReportAttachment(report.id, files[index], index));
    }

    await reportDb.reportAttachment.createMany({
      data: attachments.map((file) => ({
        reportId: report.id,
        originalName: file.originalName,
        mimeType: file.mimeType,
        sizeBytes: file.sizeBytes,
        storagePath: file.storagePath,
      })),
    });
  }

  revalidatePath("/reports/new");
  revalidatePath("/maintainer/reports");
  redirect("/reports/new?notice=report-submitted");
}

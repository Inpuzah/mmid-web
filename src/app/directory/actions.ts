"use server";

import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/auth";
import { revalidatePath } from "next/cache";
import { requireMaintainer } from "@/lib/authz";
import { logAudit } from "@/lib/audit";
import { headers } from "next/headers";
import { hypixelFetchJson } from "@/lib/hypixel-client";
import { redirect } from "next/navigation";
import type { AuditAction } from "@prisma/client";

async function resolveUserId(session: any): Promise<string> {
  let userId = (session?.user as any)?.id as string | undefined;
  if (!userId && session?.user?.email) {
    const u = await prisma.user.findUnique({ where: { email: session.user.email } });
    userId = u?.id;
  }
  if (!userId) throw new Error("Unable to resolve user id");
  return userId;
}

async function getClientMeta() {
  const h = await headers();
  const ipRaw = h.get("x-forwarded-for") || h.get("x-real-ip") || "";
  const ip = ipRaw.split(",")[0]?.trim() || undefined;
  const userAgent = h.get("user-agent") || undefined;
  return { ip, userAgent };
}

function stripDashes(v: string) {
  return v.replace(/-/g, "");
}

function hypixelRank(p: any): string | null {
  if (!p) return null;
  if (p.rank && p.rank !== "NORMAL") return p.rank; // ADMIN, YOUTUBER, etc
  if (p.monthlyPackageRank === "SUPERSTAR") return "MVP++";
  if (p.newPackageRank) return String(p.newPackageRank).replace(/_/g, " ");
  return null;
}

export async function voteOnEntry(formData: FormData): Promise<void> {
  const session = await getServerSession(authOptions);
  if (!session) {
    throw new Error("Sign in required to vote");
  }

  const userId = await resolveUserId(session);
  const entryUuid = String(formData.get("entryUuid") ?? "").trim();
  const direction = String(formData.get("direction") ?? "").trim();

  if (!entryUuid) return;
  if (direction !== "up" && direction !== "down") return;

  const value = direction === "up" ? 1 : -1;

  await prisma.$transaction(async (tx) => {
    const existing = await tx.mmidEntryVote.findUnique({
      where: { entryUuid_userId: { entryUuid, userId } },
    });

    if (!existing) {
      await tx.mmidEntryVote.create({ data: { entryUuid, userId, value } });
      return;
    }

    if (existing.value === value) {
      // same vote clicked again: remove vote
      await tx.mmidEntryVote.delete({
        where: { entryUuid_userId: { entryUuid, userId } },
      });
    } else {
      // switch from up→down or down→up
      await tx.mmidEntryVote.update({
        where: { entryUuid_userId: { entryUuid, userId } },
        data: { value },
      });
    }
  });

  // Refresh views that depend on vote counts
  revalidatePath("/directory");
  revalidatePath("/admin/flags");
}

export async function checkUsernameChange(formData: FormData) {
  const { session } = await requireMaintainer();
  const entryUuid = String(formData.get("entryUuid") ?? "").trim();
  if (!entryUuid) return;

  const entry = await prisma.mmidEntry.findUnique({ where: { uuid: entryUuid } });
  if (!entry) return;

  const uuidNoDash = stripDashes(entryUuid);
  try {
    const res = await fetch(
      `https://sessionserver.mojang.com/session/minecraft/profile/${uuidNoDash}`,
      { next: { revalidate: 60 } }
    );
    if (!res.ok) {
      throw new Error(`Mojang lookup failed with ${res.status}`);
    }
    const data = (await res.json()) as { name?: string };
    const newName = data.name?.trim();

    const { ip, userAgent } = await getClientMeta();
    const actorId = await resolveUserId(session);
    const reviewer = (session?.user as any)?.name ?? session?.user?.email ?? null;

    if (!newName || newName.toLowerCase() === entry.username.toLowerCase()) {
      await logAudit({
        action: "ENTRY_UPDATED" as AuditAction,
        actorId,
        targetType: "MmidEntry",
        targetId: entryUuid,
        meta: { op: "checkUsername", changed: false },
        ip,
        userAgent,
      });
      revalidatePath("/directory");
      redirect("/directory?notice=directory-username-unchanged");
    }

    await prisma.mmidEntry.update({
      where: { uuid: entryUuid },
      data: {
        username: newName,
        lastUpdated: new Date(),
        reviewedBy: reviewer ?? entry.reviewedBy,
      },
    });

    await logAudit({
      action: "ENTRY_UPDATED" as AuditAction,
      actorId,
      targetType: "MmidEntry",
      targetId: entryUuid,
      meta: { op: "checkUsername", oldUsername: entry.username, newUsername: newName },
      ip,
      userAgent,
    });

    revalidatePath("/directory");
    redirect("/directory?notice=directory-username-updated");
  } catch (e) {
    console.error(e);
    revalidatePath("/directory");
  }
}

export async function checkHypixelData(formData: FormData) {
  const { session } = await requireMaintainer();
  const entryUuid = String(formData.get("entryUuid") ?? "").trim();
  if (!entryUuid) return;

  const entry = await prisma.mmidEntry.findUnique({ where: { uuid: entryUuid } });
  if (!entry) return;

  const uuidNoDash = stripDashes(entryUuid);

  try {
    const [player, guildRes] = await Promise.all([
      hypixelFetchJson<any>(`/player?uuid=${uuidNoDash}`, { revalidateSeconds: 60 }),
      hypixelFetchJson<any>(`/guild?player=${uuidNoDash}`, { revalidateSeconds: 60 }),
    ]);

    const rank = hypixelRank(player?.player) ?? null;
    const guild = guildRes?.guild?.name ?? null;

    const updates: { rank?: string | null; guild?: string | null } = {};
    if (rank !== entry.rank) updates.rank = rank;
    if (guild !== entry.guild) updates.guild = guild;

    const { ip, userAgent } = await getClientMeta();
    const actorId = await resolveUserId(session);
    const reviewer = (session?.user as any)?.name ?? session?.user?.email ?? null;

    if (Object.keys(updates).length > 0) {
      await prisma.mmidEntry.update({
        where: { uuid: entryUuid },
        data: {
          ...updates,
          lastUpdated: new Date(),
          reviewedBy: reviewer ?? entry.reviewedBy,
        },
      });

      await logAudit({
        action: "ENTRY_UPDATED" as AuditAction,
        actorId,
        targetType: "MmidEntry",
        targetId: entryUuid,
        meta: { op: "checkHypixel", before: { rank: entry.rank, guild: entry.guild }, after: updates },
        ip,
        userAgent,
      });
    } else {
      await logAudit({
        action: "ENTRY_UPDATED" as AuditAction,
        actorId,
        targetType: "MmidEntry",
        targetId: entryUuid,
        meta: { op: "checkHypixel", changed: false },
        ip,
        userAgent,
      });
    }

    revalidatePath("/directory");
    redirect("/directory?notice=directory-hypixel-updated");
  } catch (e) {
    console.error(e);
    revalidatePath("/directory");
    redirect("/directory?notice=directory-hypixel-error");
  }
}
export async function markEntryNeedsReview(formData: FormData) {
  const { session } = await requireMaintainer();
  const entryUuid = String(formData.get("entryUuid") ?? "").trim();
  if (!entryUuid) return;

  const entry = await prisma.mmidEntry.findUnique({ where: { uuid: entryUuid } });
  if (!entry) return;

  const status = "Needs Reviewed";
  const { ip, userAgent } = await getClientMeta();
  const actorId = await resolveUserId(session);
  const reviewer = (session?.user as any)?.name ?? session?.user?.email ?? null;

  await prisma.mmidEntry.update({
    where: { uuid: entryUuid },
    data: {
      status,
      lastUpdated: new Date(),
      reviewedBy: reviewer ?? entry.reviewedBy,
    },
  });

  await logAudit({
    action: "ENTRY_UPDATED" as AuditAction,
    actorId,
    targetType: "MmidEntry",
    targetId: entryUuid,
    meta: { op: "markNeedsReview", previousStatus: entry.status, newStatus: status },
    ip,
    userAgent,
  });

  revalidatePath("/directory");
  redirect("/directory?notice=directory-marked-needs-review");
}

export async function deleteEntryPermanently(formData: FormData) {
  const { session } = await requireMaintainer();
  const entryUuid = String(formData.get("entryUuid") ?? "").trim();
  if (!entryUuid) return;

  const entry = await prisma.mmidEntry.findUnique({ where: { uuid: entryUuid } });
  if (!entry) return;

  const { ip, userAgent } = await getClientMeta();
  const actorId = await resolveUserId(session);

  await prisma.mmidEntry.delete({ where: { uuid: entryUuid } });

  await logAudit({
    action: "ENTRY_DELETED" as AuditAction,
    actorId,
    targetType: "MmidEntry",
    targetId: entryUuid,
    meta: { op: "deleteEntry", snapshot: { ...entry } },
    ip,
    userAgent,
  });

  revalidatePath("/directory");
  revalidatePath("/admin/flags");
  redirect("/directory?notice=directory-entry-deleted");
}

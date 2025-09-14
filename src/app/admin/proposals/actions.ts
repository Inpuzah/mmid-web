// src/app/admin/proposals/actions.ts
"use server";

import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/auth";
import { revalidatePath } from "next/cache";
import type { Prisma } from "@prisma/client";
import { headers } from "next/headers";

function assertManager(role?: string | null) {
  if (!role || !["ADMIN", "MAINTAINER"].includes(role)) {
    throw new Error("Unauthorized");
  }
}

// Not in Prisma types — define locally
type ProposalAction = "CREATE" | "UPDATE" | "DELETE";

async function getClientMeta() {
  const h = await headers();
  const ipRaw = h.get("x-forwarded-for") || h.get("x-real-ip") || "";
  const ip = ipRaw.split(",")[0]?.trim() || undefined;
  const userAgent = h.get("user-agent") || undefined;
  return { ip, userAgent };
}

async function resolveReviewerId(session: any): Promise<string> {
  let reviewerId = (session?.user as any)?.id as string | undefined;
  if (!reviewerId && session?.user?.email) {
    const u = await prisma.user.findUnique({ where: { email: session.user.email } });
    reviewerId = u?.id;
  }
  if (!reviewerId) throw new Error("Unable to resolve reviewer id");
  return reviewerId;
}

function toEntryPayload(data: any): Prisma.MmidEntryUncheckedCreateInput {
  const asArray = (v: any) =>
    Array.isArray(v) ? v.map(String) : v ? [String(v)] : [];
  const numOrNull = (v: any) => {
    const n = Number(v);
    return Number.isFinite(n) ? Math.trunc(n) : null;
  };
  return {
    uuid: String(data.uuid),
    username: String(data.username),
    guild: data.guild ?? null,
    status: data.status ?? null,
    rank: data.rank ?? null,
    typeOfCheating: asArray(data.typeOfCheating),
    reviewedBy: data.reviewedBy ?? null,
    confidenceScore: numOrNull(data.confidenceScore),
    redFlags: asArray(data.redFlags),
    notesEvidence: data.notesEvidence ?? null,
    lastUpdated: data.lastUpdated ? new Date(data.lastUpdated) : null,
    nameMcLink: data.nameMcLink ?? null,
  };
}

export async function approveProposal(formData: FormData) {
  const session = await getServerSession(authOptions);
  assertManager((session?.user as any)?.role);

  const id = String(formData.get("proposalId") ?? "");
  const reviewComment = String(formData.get("reviewComment") ?? "") || null;
  if (!id) throw new Error("proposalId required");

  const reviewerId = await resolveReviewerId(session);
  const { ip, userAgent } = await getClientMeta();

  const proposal = await prisma.mmidEntryProposal.findUnique({ where: { id } });
  if (!proposal) throw new Error("Proposal not found");
  if (proposal.status !== "PENDING") throw new Error("Proposal is not pending");

  const data = proposal.proposedData as any;
  const payload = toEntryPayload(data);
  const action: ProposalAction = proposal.action as ProposalAction;
  const targetUuid = proposal.targetUuid || null;

  await prisma.$transaction(async (tx) => {
    if (action === "CREATE") {
      await tx.mmidEntry.upsert({
        where: { uuid: payload.uuid },
        create: payload,
        update: payload,
      });
      await tx.auditLog.create({
        data: {
          action: "ENTRY_CREATED" as Prisma.AuditAction,
          actorId: reviewerId,
          targetType: "MmidEntry",
          targetId: payload.uuid,
          meta: { fromProposal: id, payload },
          ip,
          userAgent,
        },
      });
    } else if (action === "UPDATE") {
      const key = targetUuid || payload.uuid;
      if (payload.uuid !== key) {
        await tx.mmidEntry.delete({ where: { uuid: key } });
        await tx.mmidEntry.upsert({
          where: { uuid: payload.uuid },
          create: payload,
          update: payload,
        });
        await tx.auditLog.create({
          data: {
            action: "ENTRY_UPDATED" as Prisma.AuditAction,
            actorId: reviewerId,
            targetType: "MmidEntry",
            targetId: payload.uuid,
            meta: { fromProposal: id, replacedUuid: key, payload },
            ip,
            userAgent,
          },
        });
      } else {
        await tx.mmidEntry.upsert({
          where: { uuid: key },
          create: { ...payload, uuid: key },
          update: payload,
        });
        await tx.auditLog.create({
          data: {
            action: "ENTRY_UPDATED" as Prisma.AuditAction,
            actorId: reviewerId,
            targetType: "MmidEntry",
            targetId: key,
            meta: { fromProposal: id, payload },
            ip,
            userAgent,
          },
        });
      }
    } else if (action === "DELETE") {
      const key = targetUuid || payload.uuid;
      await tx.mmidEntry.deleteMany({ where: { uuid: key } });
      await tx.auditLog.create({
        data: {
          action: "ENTRY_DELETED" as Prisma.AuditAction,
          actorId: reviewerId,
          targetType: "MmidEntry",
          targetId: key,
          meta: { fromProposal: id },
          ip,
          userAgent,
        },
      });
    } else {
      throw new Error(`Unknown action: ${action}`);
    }

    await tx.mmidEntryProposal.update({
      where: { id },
      data: {
        status: "APPROVED",
        reviewedById: reviewerId,
        reviewedAt: new Date(),
        appliedAt: new Date(),
        reviewComment,
      },
    });

    await tx.auditLog.create({
      data: {
        action: "PROPOSAL_APPROVED" as Prisma.AuditAction,
        actorId: reviewerId,
        targetType: "Proposal",
        targetId: id,
        meta: { action, targetUuid, reviewComment },
        ip,
        userAgent,
      },
    });
  });

  revalidatePath("/directory");
  revalidatePath("/admin/proposals");
  return { ok: true };
}

export async function rejectProposal(formData: FormData) {
  const session = await getServerSession(authOptions);
  assertManager((session?.user as any)?.role);

  const id = String(formData.get("proposalId") ?? "");
  const reviewComment = String(formData.get("reviewComment") ?? "") || null;
  if (!id) throw new Error("proposalId required");

  const reviewerId = await resolveReviewerId(session);
  const { ip, userAgent } = await getClientMeta();

  await prisma.mmidEntryProposal.update({
    where: { id },
    data: {
      status: "REJECTED",
      reviewedById: reviewerId,
      reviewedAt: new Date(),
      reviewComment,
    },
  });

  await prisma.auditLog.create({
    data: {
      action: "PROPOSAL_REJECTED" as Prisma.AuditAction,
      actorId: reviewerId,
      targetType: "Proposal",
      targetId: id,
      meta: { reviewComment },
      ip,
      userAgent,
    },
  });

  revalidatePath("/admin/proposals");
  return { ok: true };
}

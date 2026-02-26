"use server";

import { revalidatePath } from "next/cache";
import { getServerSession } from "next-auth";
import { authOptions } from "@/auth";
import { prisma } from "@/lib/prisma";
import { assertReportSchemaReady } from "@/lib/report-schema";

const reportDb = prisma as any;

function canReviewReports(role?: string | null) {
  return role === "ADMIN" || role === "REPLAY_OFFICER";
}

function canMaintain(role?: string | null) {
  return role === "ADMIN" || role === "MAINTAINER";
}

async function requireUserAndRole() {
  const session = await getServerSession(authOptions);
  if (!session) throw new Error("Unauthorized");

  const role = (session.user as any)?.role as string | undefined;
  let userId = (session.user as any)?.id as string | undefined;
  if (!userId && session.user?.email) {
    const user = await prisma.user.findUnique({ where: { email: session.user.email } });
    userId = user?.id;
  }
  if (!userId) throw new Error("Unable to resolve user id");

  return { role, userId };
}

export async function startReportReview(formData: FormData) {
  await assertReportSchemaReady();
  const { role, userId } = await requireUserAndRole();
  if (!canReviewReports(role) && !canMaintain(role)) throw new Error("Forbidden");

  const reportId = String(formData.get("reportId") ?? "").trim();
  if (!reportId) throw new Error("Missing report id");

  await reportDb.report.update({
    where: { id: reportId },
    data: {
      status: "UNDER_REVIEW",
      reviewedById: userId,
    },
  });

  revalidatePath("/maintainer/reports");
}

export async function approveReport(formData: FormData) {
  await assertReportSchemaReady();
  const { role, userId } = await requireUserAndRole();
  if (!canReviewReports(role)) throw new Error("Forbidden");

  const reportId = String(formData.get("reportId") ?? "").trim();
  const note = String(formData.get("reviewDecisionNote") ?? "").trim();
  if (!reportId) throw new Error("Missing report id");

  await reportDb.report.update({
    where: { id: reportId },
    data: {
      status: "APPROVED_FOR_MAINTAINER",
      reviewedById: userId,
      reviewDecisionNote: note || null,
      reviewedAt: new Date(),
      approvedAt: new Date(),
    },
  });

  revalidatePath("/maintainer/reports");
  revalidatePath("/maintainer/queue");
}

export async function rejectReport(formData: FormData) {
  await assertReportSchemaReady();
  const { role, userId } = await requireUserAndRole();
  if (!canReviewReports(role)) throw new Error("Forbidden");

  const reportId = String(formData.get("reportId") ?? "").trim();
  const note = String(formData.get("reviewDecisionNote") ?? "").trim();
  if (!reportId) throw new Error("Missing report id");

  await reportDb.report.update({
    where: { id: reportId },
    data: {
      status: "REJECTED",
      reviewedById: userId,
      reviewDecisionNote: note || null,
      reviewedAt: new Date(),
    },
  });

  revalidatePath("/maintainer/reports");
}

export async function addMaintainerNote(formData: FormData) {
  await assertReportSchemaReady();
  const { role, userId } = await requireUserAndRole();
  if (!canMaintain(role)) throw new Error("Forbidden");

  const reportId = String(formData.get("reportId") ?? "").trim();
  const note = String(formData.get("note") ?? "").trim();
  if (!reportId) throw new Error("Missing report id");
  if (!note) throw new Error("Note is required");

  await reportDb.reportMaintainerNote.create({
    data: {
      reportId,
      authorId: userId,
      note,
    },
  });

  revalidatePath("/maintainer/queue");
}

export async function markReportResolved(formData: FormData) {
  await assertReportSchemaReady();
  const { role } = await requireUserAndRole();
  if (!canMaintain(role)) throw new Error("Forbidden");

  const reportId = String(formData.get("reportId") ?? "").trim();
  if (!reportId) throw new Error("Missing report id");

  await reportDb.report.update({
    where: { id: reportId },
    data: {
      status: "RESOLVED",
      resolvedAt: new Date(),
    },
  });

  revalidatePath("/maintainer/queue");
}

export async function saveMaintainerDraft(formData: FormData) {
  await assertReportSchemaReady();
  const { role, userId } = await requireUserAndRole();
  if (!canMaintain(role)) throw new Error("Forbidden");

  const reportId = String(formData.get("reportId") ?? "").trim();
  const note = String(formData.get("note") ?? "").trim();
  if (!reportId) throw new Error("Missing report id");

  try {
    await reportDb.report.update({
      where: { id: reportId },
      data: {
        status: "MAINTAINER_DRAFT",
        reviewedById: userId,
      },
    });
  } catch {
    throw new Error("Draft status is not available yet. Run Prisma migration and generate client.");
  }

  if (note) {
    await reportDb.reportMaintainerNote.create({
      data: {
        reportId,
        authorId: userId,
        note,
      },
    });
  }

  revalidatePath("/maintainer");
  revalidatePath("/maintainer/queue");
}

export async function sendBackToOfficer(formData: FormData) {
  await assertReportSchemaReady();
  const { role, userId } = await requireUserAndRole();
  if (!canMaintain(role)) throw new Error("Forbidden");

  const reportId = String(formData.get("reportId") ?? "").trim();
  const reason = String(formData.get("reason") ?? "").trim();
  if (!reportId) throw new Error("Missing report id");
  if (!reason) throw new Error("Reason is required");

  await reportDb.report.update({
    where: { id: reportId },
    data: {
      status: "UNDER_REVIEW",
    },
  });

  await reportDb.reportMaintainerNote.create({
    data: {
      reportId,
      authorId: userId,
      note: `Sent back to officer triage: ${reason}`,
    },
  });

  revalidatePath("/maintainer");
  revalidatePath("/maintainer/reports");
  revalidatePath("/maintainer/queue");
}

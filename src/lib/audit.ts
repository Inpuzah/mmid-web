import { prisma } from "@/lib/prisma";
import type { AuditAction } from "@prisma/client";

type AuditArgs = {
  action: AuditAction;
  actorId?: string | null;
  targetType?: string | null;
  targetId?: string | null;
  meta?: Record<string, any> | null;
  ip?: string | null;
  userAgent?: string | null;
};

export async function logAudit(a: AuditArgs) {
  try {
    await prisma.auditLog.create({
      data: {
        action: a.action,
        actorId: a.actorId ?? null,
        targetType: a.targetType ?? null,
        targetId: a.targetId ?? null,
        meta: a.meta ?? {},
        ip: a.ip ?? null,
        userAgent: a.userAgent ?? null,
      },
    });
  } catch {
    // Don't break the request if logging fails
  }
}

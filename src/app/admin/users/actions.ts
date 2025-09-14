// src/app/admin/users/actions.ts
"use server";

import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/auth";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";

// Optional: local type to document allowed audit actions
type AuditAction = "USER_ROLE_CHANGED";

function assertAdmin(role?: string | null) {
  if (!role || !["ADMIN", "MAINTAINER"].includes(role)) {
    throw new Error("Unauthorized");
  }
}

async function getClientMeta() {
  const h = await headers(); // Next 15: Promise<ReadonlyHeaders>
  const ipRaw = h.get("x-forwarded-for") || h.get("x-real-ip") || "";
  const ip = ipRaw.split(",")[0]?.trim() || undefined;
  const userAgent = h.get("user-agent") || undefined;
  return { ip, userAgent };
}

async function resolveActorId(session: any): Promise<string> {
  let actorId = (session?.user as any)?.id as string | undefined;
  if (!actorId && session?.user?.email) {
    const u = await prisma.user.findUnique({ where: { email: session.user.email } });
    actorId = u?.id;
  }
  if (!actorId) throw new Error("Unable to resolve actor id");
  return actorId;
}

export async function updateUserRole(formData: FormData) {
  const session = await getServerSession(authOptions);
  assertAdmin((session?.user as any)?.role);

  const userId = String(formData.get("userId") ?? "");
  const role = String(formData.get("role") ?? "");

  if (!userId) throw new Error("Missing userId");
  if (!["USER", "MAINTAINER", "ADMIN"].includes(role)) {
    throw new Error("Invalid role");
  }

  const { ip, userAgent } = await getClientMeta();
  const actorId = await resolveActorId(session);

  const updated = await prisma.user.update({
    where: { id: userId },
    data: { role: role as any },
    select: { id: true, role: true, email: true, name: true },
  });

  await prisma.auditLog.create({
    data: {
      action: "USER_ROLE_CHANGED" as AuditAction,
      actorId,
      targetType: "User",
      targetId: updated.id,
      meta: { newRole: updated.role, email: updated.email, name: updated.name },
      ip,
      userAgent,
    },
  });

  revalidatePath("/admin/users");
}

export async function promoteByDiscordId(formData: FormData) {
  const session = await getServerSession(authOptions);
  assertAdmin((session?.user as any)?.role);

  const discordId = String(formData.get("discordId") ?? "").trim();
  const role = String(formData.get("role") ?? "MAINTAINER");

  if (!discordId) throw new Error("Missing Discord ID");
  if (!["USER", "MAINTAINER", "ADMIN"].includes(role)) {
    throw new Error("Invalid role");
  }

  const user = await prisma.user.findFirst({
    where: {
      OR: [
        { discordId },
        { accounts: { some: { provider: "discord", providerAccountId: discordId } } },
      ],
    },
    select: { id: true, role: true, email: true, name: true },
  });

  if (!user) throw new Error("No user with that Discord ID");

  const { ip, userAgent } = await getClientMeta();
  const actorId = await resolveActorId(session);

  const updated = await prisma.user.update({
    where: { id: user.id },
    data: { role: role as any },
    select: { id: true, role: true, email: true, name: true },
  });

  await prisma.auditLog.create({
    data: {
      action: "USER_ROLE_CHANGED" as AuditAction,
      actorId,
      targetType: "User",
      targetId: updated.id,
      meta: { newRole: updated.role, email: updated.email, name: updated.name, via: "discordId" },
      ip,
      userAgent,
    },
  });

  revalidatePath("/admin/users");
}

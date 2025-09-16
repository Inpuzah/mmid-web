// src/lib/authz.ts
import { getServerSession } from "next-auth";
import { authOptions } from "@/auth";
import { prisma } from "@/lib/prisma";

type Role = "USER" | "MAINTAINER" | "ADMIN";

async function resolveUserId(session: any): Promise<string | null> {
  let id: string | null = (session?.user as any)?.id ?? null;
  if (!id && session?.user?.email) {
    id =
      (
        await prisma.user.findUnique({
          where: { email: session.user.email },
          select: { id: true },
        })
      )?.id ?? null;
  }
  return id;
}

export async function requireManager() {
  const session = await getServerSession(authOptions);
  const role = (session?.user as any)?.role as Role | undefined;
  if (!session || !["ADMIN", "MAINTAINER"].includes(role ?? "USER")) {
    // include status so route handlers can map to 401/403 if desired
    throw Object.assign(new Error("Unauthorized"), { status: 401 });
  }
  const reviewerId = await resolveUserId(session);
  return { session, role: role!, reviewerId };
}

export async function requireAdmin() {
  const session = await getServerSession(authOptions);
  const role = (session?.user as any)?.role as Role | undefined;
  if (!session) throw Object.assign(new Error("Unauthorized"), { status: 401 });
  if (role !== "ADMIN") throw Object.assign(new Error("Forbidden"), { status: 403 });
  const adminId = await resolveUserId(session);
  return { session, adminId };
}

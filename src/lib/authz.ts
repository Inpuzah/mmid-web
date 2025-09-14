import { getServerSession } from "next-auth";
import { authOptions } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function requireManager() {
  const session = await getServerSession(authOptions);
  const role = (session?.user as any)?.role ?? "USER";
  if (!session || !["ADMIN", "MAINTAINER"].includes(role)) throw new Error("Unauthorized");
  let reviewerId: string | null = (session?.user as any)?.id ?? null;
  if (!reviewerId && session?.user?.email) {
    reviewerId = (await prisma.user.findUnique({ where: { email: session.user.email }, select: { id: true } }))?.id ?? null;
  }
  return { session, role, reviewerId };
}

export async function requireAdmin() {
  const session = await getServerSession(authOptions);
  const role = (session?.user as any)?.role ?? "USER";
  if (!session || role !== "ADMIN") throw new Error("Unauthorized");
  let adminId: string | null = (session?.user as any)?.id ?? null;
  if (!adminId && session?.user?.email) {
    adminId = (await prisma.user.findUnique({ where: { email: session.user.email }, select: { id: true } }))?.id ?? null;
  }
  return { session, adminId };
}

// src/lib/authz.ts
import { getServerSession } from "next-auth";
import { authOptions } from "@/auth";

type Role = "USER" | "MAINTAINER" | "ADMIN";

function ensure<T>(v: T | null | undefined, message: string, status: number) {
  if (!v) {
    const err = new Error(message) as any;
    err.status = status;
    throw err;
  }
  return v;
}

export async function requireSession() {
  const session = await getServerSession(authOptions);
  return ensure(session, "Sign in required", 401);
}

export async function requireRole(allowed: Role[]) {
  const session = await requireSession();
  const role = ((session.user as any)?.role as Role) ?? "USER";
  if (!allowed.includes(role)) {
    const err = new Error("Forbidden") as any;
    err.status = 403;
    throw err;
  }
  return { session, role };
}

export async function requireAdmin() {
  return requireRole(["ADMIN"]);
}

export async function requireMaintainer() {
  return requireRole(["ADMIN", "MAINTAINER"]);
}

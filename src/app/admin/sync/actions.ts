"use server";

import { getServerSession } from "next-auth";
import { authOptions } from "@/auth";
import { revalidatePath } from "next/cache";
import { syncDirectoryFromSheet } from "@/lib/directory-sync";

function assertAdmin(role?: string | null) {
  if (!role || !["ADMIN", "MAINTAINER"].includes(role)) {
    throw new Error("Unauthorized");
  }
}

export async function syncMmidFromSheet() {
  const session = await getServerSession(authOptions);
  assertAdmin((session?.user as any)?.role);

  // For admin-triggered sync, perform a full rebuild so DB matches the sheet exactly.
  const result = await syncDirectoryFromSheet("rebuild");

  revalidatePath("/directory");
  return result;
}

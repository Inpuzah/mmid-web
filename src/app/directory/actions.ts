"use server";

import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/auth";
import { revalidatePath } from "next/cache";

async function resolveUserId(session: any): Promise<string> {
  let userId = (session?.user as any)?.id as string | undefined;
  if (!userId && session?.user?.email) {
    const u = await prisma.user.findUnique({ where: { email: session.user.email } });
    userId = u?.id;
  }
  if (!userId) throw new Error("Unable to resolve user id");
  return userId;
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

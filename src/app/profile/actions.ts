"use server";

import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/auth";
import { revalidatePath } from "next/cache";

export async function setVoteHistoryPreference(formData: FormData): Promise<void> {
  const session = await getServerSession(authOptions);
  if (!session || (!session.user?.email && !(session.user as any)?.id)) {
    throw new Error("Sign in required");
  }

  const userId = (session.user as any)?.id as string | undefined;
  const email = session.user?.email ?? undefined;

  const user = userId
    ? await prisma.user.findUnique({ where: { id: userId } })
    : email
    ? await prisma.user.findUnique({ where: { email } })
    : null;

  if (!user) {
    throw new Error("User not found");
  }

  const raw = String(formData.get("showVoteHistory") ?? "").toLowerCase();
  const enabled = raw === "on" || raw === "true" || raw === "1";

  await prisma.user.update({
    where: { id: user.id },
    data: { showVoteHistoryOnProfile: enabled },
  });

  revalidatePath("/profile");
}

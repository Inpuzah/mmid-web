"use server";

import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/auth";
import { revalidatePath } from "next/cache";
import { readDirectorySheet, mapRowToEntry } from "@/lib/google-sheets";

function assertAdmin(role?: string | null) {
  if (!role || !["ADMIN", "MAINTAINER"].includes(role)) {
    throw new Error("Unauthorized");
  }
}

export async function syncMmidFromSheet() {
  const session = await getServerSession(authOptions);
  assertAdmin((session?.user as any)?.role);

  const rawRows = await readDirectorySheet();
  const entries = rawRows
    .map(mapRowToEntry)
    .filter((x): x is NonNullable<typeof x> => Boolean(x));

  let upserts = 0;
  for (const e of entries) {
    await prisma.mmidEntry.upsert({
      where: { uuid: e.uuid },
      create: {
        uuid: e.uuid,
        username: e.username,
        guild: e.guild,
        status: e.status,
        rank: e.rank,
        typeOfCheating: e.typeOfCheating,
        reviewedBy: e.reviewedBy,
        confidenceScore: e.confidenceScore ?? null,
        redFlags: e.redFlags,
        notesEvidence: e.notesEvidence,
        lastUpdated: e.lastUpdated ?? null,
        nameMcLink: e.nameMcLink,
      },
      update: {
        username: e.username,
        guild: e.guild,
        status: e.status,
        rank: e.rank,
        typeOfCheating: e.typeOfCheating,
        reviewedBy: e.reviewedBy,
        confidenceScore: e.confidenceScore ?? null,
        redFlags: e.redFlags,
        notesEvidence: e.notesEvidence,
        lastUpdated: e.lastUpdated ?? null,
        nameMcLink: e.nameMcLink,
      },
    });
    upserts++;
  }

  revalidatePath("/directory");
  return { upserts, total: entries.length };
}

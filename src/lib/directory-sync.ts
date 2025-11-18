// src/lib/directory-sync.ts
import { prisma } from "./prisma";
import { readDirectorySheet, mapRowToEntry } from "./google-sheets";

export type DirectorySyncMode = "rebuild" | "upsert";

export type DirectorySyncResult = {
  mode: DirectorySyncMode;
  totalRows: number; // rows in sheet after header
  imported: number; // rows that mapped to valid DirectoryRow
  upserts: number; // prisma upserts performed
  deleted?: number; // number of rows deleted when in rebuild mode
};

export async function syncDirectoryFromSheet(
  mode: DirectorySyncMode = "upsert",
): Promise<DirectorySyncResult> {
  // Read all rows from the configured sheet/tab
  const rawRows = await readDirectorySheet();
  const entries = rawRows
    .map(mapRowToEntry)
    .filter((x): x is NonNullable<typeof x> => Boolean(x));

  let deleted: number | undefined;

  if (mode === "rebuild") {
    // Danger: destructive. Wipes the table before re-importing.
    const res = await prisma.mmidEntry.deleteMany();
    deleted = res.count;
  }

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

  return {
    mode,
    totalRows: rawRows.length,
    imported: entries.length,
    upserts,
    deleted,
  };
}

// src/app/directory/page.tsx
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";
import MMIDFullWidthCardList, { type MmidRow } from "./_components/MMIDFullWidthCardList";

export const dynamic = "force-dynamic";

function firstStr(v: string | string[] | undefined) {
  return Array.isArray(v) ? v[0] : v ?? "";
}

export default async function DirectoryPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const q = firstStr(sp.q).trim();
  const status = firstStr(sp.status ?? "any").trim().toLowerCase();

  // --- filters (same as before) ---
  const andFilters: Prisma.MmidEntryWhereInput[] = [];
  if (q) {
    andFilters.push({
      OR: [
        { username: { contains: q, mode: "insensitive" } },
        { uuid: { contains: q } },
        { guild: { contains: q, mode: "insensitive" } },
        { status: { contains: q, mode: "insensitive" } },
        { rank: { contains: q, mode: "insensitive" } },
        { notesEvidence: { contains: q, mode: "insensitive" } },
        { typeOfCheating: { has: q } as any }, // arrays
        { redFlags: { has: q } as any },       // arrays
      ],
    });
  }
  if (status !== "any") {
    andFilters.push({ status: { contains: status, mode: "insensitive" } });
  }
  const where: Prisma.MmidEntryWhereInput = andFilters.length ? { AND: andFilters } : {};

const orderBy = [{ username: "asc" as const }];


  // fetch all (1400 is fine with virtualization)
  const rows = await prisma.mmidEntry.findMany({ where, orderBy });

  // Map DB → UI (keep arrays as arrays; card component shows skin via uuid)
  const data: MmidRow[] = rows.map((r) => ({
    uuid: r.uuid,
    username: r.username,
    guild: r.guild ?? null,
    // if you ever store a hex: guildColor: r.guildColor ?? null,
    rank: r.rank ?? null,
    status: r.status ?? null,
    typeOfCheating: r.typeOfCheating ?? [],
    redFlags: r.redFlags ?? [],
    notesEvidence: r.notesEvidence ?? null,
    reviewedBy: r.reviewedBy ?? null,
    confidenceScore: r.confidenceScore ?? 0,
  }));

  return <MMIDFullWidthCardList rows={data} />;
}

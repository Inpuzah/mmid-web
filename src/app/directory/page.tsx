// src/app/directory/page.tsx
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";
import { getServerSession } from "next-auth";
import { authOptions } from "@/auth";
import MMIDFullWidthCardList, { type MmidRow } from "./_components/MMIDFullWidthCardList";
import FlashNotice from "@/components/flash-notice";

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
  const notice = firstStr(sp.notice);
  const q = firstStr(sp.q).trim();
  const status = firstStr(sp.status ?? "any").trim().toLowerCase();

  const session = await getServerSession(authOptions);
  const userId = (session?.user as any)?.id as string | undefined;

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
        { typeOfCheating: { has: q } as any },
        { redFlags: { has: q } as any },
      ],
    });
  }
  if (status !== "any") {
    andFilters.push({ status: { contains: status, mode: "insensitive" } });
  }
  const where: Prisma.MmidEntryWhereInput = andFilters.length ? { AND: andFilters } : {};
  const orderBy = [{ username: "asc" as const }];

  const [rows, voteAggregates, userVotes] = await Promise.all([
    prisma.mmidEntry.findMany({ where, orderBy }),
    prisma.mmidEntryVote.groupBy({
      by: ["entryUuid"],
      _sum: { value: true },
    }),
    userId
      ? prisma.mmidEntryVote.findMany({
          where: { userId },
          select: { entryUuid: true, value: true },
        })
      : Promise.resolve([]),
  ]);

  const scoreByEntry = new Map<string, number>();
  for (const v of voteAggregates) {
    scoreByEntry.set(v.entryUuid, v._sum.value ?? 0);
  }

  const userVoteByEntry = new Map<string, number>();
  for (const v of userVotes as { entryUuid: string; value: number }[]) {
    userVoteByEntry.set(v.entryUuid, v.value);
  }

  const data: MmidRow[] = rows.map((r) => ({
    uuid: r.uuid,
    username: r.username,
    guild: r.guild ?? null,
    rank: r.rank ?? null,
    status: r.status ?? null,
    typeOfCheating: r.typeOfCheating ?? [],
    redFlags: r.redFlags ?? [],
    notesEvidence: r.notesEvidence ?? null,
    reviewedBy: r.reviewedBy ?? null,
    confidenceScore: r.confidenceScore ?? 0,
    voteScore: scoreByEntry.get(r.uuid) ?? 0,
    userVote: userVoteByEntry.get(r.uuid) ?? 0,
  }));

  return (
    <div className="space-y-3">
      {notice && <FlashNotice notice={notice} />}
      <MMIDFullWidthCardList rows={data} />
    </div>
  );
}

// src/app/directory/page.tsx
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";
import { getServerSession } from "next-auth";
import { authOptions } from "@/auth";
import MMIDDirectoryMasterDetail, { type MmidRow } from "./_components/MMIDDirectoryMasterDetail";
import FlashNotice from "@/components/flash-notice";
import type { DirectoryMmStats } from "@/lib/hypixel-player-stats";

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
  const noticeOldUsername = firstStr(sp.oldUsername);
  const noticeNewUsername = firstStr(sp.newUsername);
  const noticeEntryUuid = firstStr(sp.entryUuid);
  const q = firstStr(sp.q).trim();
  const status = firstStr(sp.status ?? "any").trim().toLowerCase();
  const initialFocusUuid = noticeEntryUuid || "";
  const initialEditMode = Boolean(initialFocusUuid);

  const session = await getServerSession(authOptions);
  const userId = (session?.user as any)?.id as string | undefined;
  const role = (session?.user as any)?.role ?? "USER";
  const canEdit = role === "ADMIN" || role === "MAINTAINER";
  const currentUserName =
    (session?.user as any)?.name ??
    (session?.user as any)?.username ??
    (session?.user as any)?.email ??
    null;
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
    prisma.mmidEntry.findMany({
      where,
      orderBy,
      include: {
        usernameHistory: {
          orderBy: { changedAt: "desc" },
        },
      },
    }),
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

  // Attach any cached Hypixel MM stats we have for these entries.
  const uuidToNormalized = new Map<string, string>();
  const normalizedUuids: string[] = [];
  for (const r of rows) {
    const norm = r.uuid.replace(/-/g, "").toLowerCase();
    uuidToNormalized.set(r.uuid, norm);
    normalizedUuids.push(norm);
  }

  type SnapshotRow = {
    uuid: string;
    mmStatsJson: unknown | null;
    fetchedAt: Date;
  };

  const snapshotsRaw: SnapshotRow[] = normalizedUuids.length
    ? ((await prisma.hypixelPlayerSnapshot.findMany({
        where: { uuid: { in: normalizedUuids } },
        select: { uuid: true, mmStatsJson: true, fetchedAt: true },
      })) as SnapshotRow[])
    : [];

  const statsByUuid = new Map<string, { mmStats: DirectoryMmStats | null; fetchedAt: string }>();
  for (const s of snapshotsRaw) {
    const originalUuid = [...uuidToNormalized.entries()].find(([, norm]) => norm === s.uuid)?.[0];
    if (!originalUuid) continue;
    const mmStats = (s.mmStatsJson as DirectoryMmStats | null) ?? null;
    statsByUuid.set(originalUuid, {
      mmStats,
      fetchedAt: s.fetchedAt.toISOString(),
    });
  }

  type TextureSnapshotRow = {
    uuid: string;
    username: string;
    skinUrl: string | null;
    mojangCapeUrl: string | null;
    optifineCapeUrl: string | null;
    fetchedAt: Date;
  };

  const textureSnapshotsRaw: TextureSnapshotRow[] = normalizedUuids.length
    ? ((await prisma.minecraftProfileSnapshot.findMany({
        where: { uuid: { in: normalizedUuids } },
        select: {
          uuid: true,
          username: true,
          skinUrl: true,
          mojangCapeUrl: true,
          optifineCapeUrl: true,
          fetchedAt: true,
        },
        orderBy: { fetchedAt: "desc" },
      })) as TextureSnapshotRow[])
    : [];

  const texturesByUuid = new Map<
    string,
    {
      skinHistory: { url: string; fetchedAt: string }[];
      mojangCapeHistory: { url: string; fetchedAt: string }[];
      optifineCapeHistory: { url: string; fetchedAt: string }[];
    }
  >();

  const pushUnique = (
    list: { url: string; fetchedAt: string }[],
    url: string | null,
    fetchedAt: Date,
  ) => {
    if (!url) return;
    if (list.some((i) => i.url === url)) return;
    list.push({ url, fetchedAt: fetchedAt.toISOString() });
  };

  for (const row of textureSnapshotsRaw) {
    const originalUuid = [...uuidToNormalized.entries()].find(([, norm]) => norm === row.uuid)?.[0];
    if (!originalUuid) continue;

    let bucket = texturesByUuid.get(originalUuid);
    if (!bucket) {
      bucket = {
        skinHistory: [],
        mojangCapeHistory: [],
        optifineCapeHistory: [],
      };
      texturesByUuid.set(originalUuid, bucket);
    }

    pushUnique(bucket.skinHistory, row.skinUrl, row.fetchedAt);
    pushUnique(bucket.mojangCapeHistory, row.mojangCapeUrl, row.fetchedAt);
    pushUnique(bucket.optifineCapeHistory, row.optifineCapeUrl, row.fetchedAt);
  }

  const scoreByEntry = new Map<string, number>();
  for (const v of voteAggregates) {
    scoreByEntry.set(v.entryUuid, v._sum.value ?? 0);
  }

  const userVoteByEntry = new Map<string, number>();
  for (const v of userVotes as { entryUuid: string; value: number }[]) {
    userVoteByEntry.set(v.entryUuid, v.value);
  }

  const data: MmidRow[] = rows.map((r) => {
    const stats = statsByUuid.get(r.uuid) ?? null;
    const textures = texturesByUuid.get(r.uuid) ?? null;

    const skinHistory = textures?.skinHistory ?? [];
    const mojangCapeHistory = textures?.mojangCapeHistory ?? [];
    const optifineCapeHistory = textures?.optifineCapeHistory ?? [];

    const guildColor = stats?.mmStats?.guildColor ?? null;

    return {
      uuid: r.uuid,
      username: r.username,
      guild: r.guild ?? null,
      guildColor,
      rank: r.rank ?? null,
      status: r.status ?? null,
      typeOfCheating: r.typeOfCheating ?? [],
      redFlags: r.redFlags ?? [],
      notesEvidence: r.notesEvidence ?? null,
      reviewedBy: r.reviewedBy ?? null,
      confidenceScore: r.confidenceScore ?? 0,
      voteScore: scoreByEntry.get(r.uuid) ?? 0,
      userVote: userVoteByEntry.get(r.uuid) ?? 0,
      lastUpdated: r.lastUpdated ? r.lastUpdated.toISOString() : null,
      usernameHistory: (r.usernameHistory ?? []).map((h) => ({
        username: h.username,
        changedAt: h.changedAt.toISOString(),
      })),
      hypixelStats: stats
        ? {
            mmStats: stats.mmStats,
            fetchedAt: stats.fetchedAt,
          }
        : null,
      skinHistory,
      mojangCapeHistory,
      optifineCapeHistory,
    };
  });

  return (
    <div className="space-y-3">
      {notice && (
        <FlashNotice
          notice={notice}
          oldUsername={noticeOldUsername}
          newUsername={noticeNewUsername}
          entryUuid={noticeEntryUuid}
        />
      )}
      <MMIDDirectoryMasterDetail
        rows={data}
        canEdit={canEdit}
        currentUserName={currentUserName}
      />
    </div>
  );
}

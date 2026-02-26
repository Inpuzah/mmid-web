// src/app/directory/page.tsx
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";
import { getServerSession } from "next-auth";
import { authOptions } from "@/auth";
import MMIDDirectoryMasterDetail, { type MmidRow } from "./_components/MMIDDirectoryMasterDetail";
import MMIDLegacySpreadsheet from "./_components/MMIDLegacySpreadsheet";
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
  const requestedEntryUuid = firstStr(sp.entryUuid).trim();
  const reportId = firstStr(sp.reportId).trim();
  const view = (firstStr(sp.view) || "cards").toLowerCase() === "legacy" ? "legacy" : "cards";
  const q = firstStr(sp.q).trim();
  const status = firstStr(sp.status ?? "any").trim().toLowerCase();

  const session = await getServerSession(authOptions);
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
        ({ statusTags: { has: q } } as any),
        { rank: { contains: q, mode: "insensitive" } },
        { notesEvidence: { contains: q, mode: "insensitive" } },
        { typeOfCheating: { has: q } as any },
        { redFlags: { has: q } as any },
      ],
    });
  }
  if (status !== "any") {
    andFilters.push({
      OR: [
        { status: { contains: status, mode: "insensitive" } },
        ({ statusTags: { has: status } } as any),
      ],
    });
  }
  const where: Prisma.MmidEntryWhereInput = andFilters.length ? { AND: andFilters } : {};
  const orderBy = [{ username: "asc" as const }];

  const [rows, reportContextRaw] = await Promise.all([
    prisma.mmidEntry.findMany({
      where,
      orderBy,
      include: {
        usernameHistory: {
          orderBy: { changedAt: "desc" },
        },
      },
    }),
    reportId
      ? (prisma as any).report.findUnique({
          where: { id: reportId },
          include: {
            reviewedBy: { select: { name: true, email: true } },
            replayEvidence: true,
            videoEvidence: true,
            attachments: true,
          },
        })
      : null,
  ]);

  const reportContext = reportContextRaw
    ? {
        id: String(reportContextRaw.id),
        subjectUsername: String(reportContextRaw.subjectUsername ?? ""),
        subjectUuid: reportContextRaw.subjectUuid ? String(reportContextRaw.subjectUuid) : null,
        reviewedBy:
          reportContextRaw.reviewedBy?.name ?? reportContextRaw.reviewedBy?.email ?? null,
        replayEvidence: (reportContextRaw.replayEvidence ?? []).map((row: any) => ({
          id: String(row.id),
          replayId: String(row.replayId),
        })),
        videoEvidence: (reportContextRaw.videoEvidence ?? []).map((row: any) => ({
          id: String(row.id),
          url: String(row.url),
        })),
        attachments: (reportContextRaw.attachments ?? []).map((row: any) => ({
          id: String(row.id),
          originalName: String(row.originalName),
          storagePath: String(row.storagePath),
          hideFromDirectory: Boolean(row.hideFromDirectory),
          sizeBytes: Number(row.sizeBytes ?? 0),
        })),
      }
    : null;

  // Attach any cached Hypixel MM stats we have for these entries.
  const uuidToNormalized = new Map<string, string>();
  const normalizedToOriginal = new Map<string, string>();
  const normalizedUuids: string[] = [];

  for (const r of rows) {
    const norm = r.uuid.replace(/-/g, "").toLowerCase();
    uuidToNormalized.set(r.uuid, norm);
    // If we ever encounter duplicates, keep the first (stable).
    if (!normalizedToOriginal.has(norm)) normalizedToOriginal.set(norm, r.uuid);
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
    const originalUuid = normalizedToOriginal.get(s.uuid);
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
    const originalUuid = normalizedToOriginal.get(row.uuid);
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
      statusTags: (r as any).statusTags ?? [],
      typeOfCheating: r.typeOfCheating ?? [],
      redFlags: r.redFlags ?? [],
      notesEvidence: r.notesEvidence ?? null,
      reviewedBy: r.reviewedBy ?? null,
      confidenceScore: r.confidenceScore ?? 0,
      voteScore: 0,
      userVote: 0,
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

  const normalizeUuid = (value: string) => value.replace(/-/g, "").toLowerCase();
  const reportSubjectUuidNorm = reportContext?.subjectUuid ? normalizeUuid(reportContext.subjectUuid) : null;
  const hasSubjectRow = reportSubjectUuidNorm
    ? data.some((row) => normalizeUuid(row.uuid) === reportSubjectUuidNorm)
    : false;

  const mergedData: MmidRow[] =
    reportContext && reportSubjectUuidNorm && !hasSubjectRow
      ? [
          {
            uuid: reportContext.subjectUuid!,
            username: reportContext.subjectUsername,
            guild: null,
            guildColor: null,
            rank: null,
            status: null,
            statusTags: [],
            typeOfCheating: [],
            redFlags: [],
            notesEvidence: null,
            reviewedBy: reportContext.reviewedBy,
            confidenceScore: 0,
            voteScore: 0,
            userVote: 0,
            lastUpdated: null,
            usernameHistory: [],
            hypixelStats: null,
            skinHistory: [],
            mojangCapeHistory: [],
            optifineCapeHistory: [],
          },
          ...data,
        ]
      : data;

  const initialActiveUuid = requestedEntryUuid || reportContext?.subjectUuid || noticeEntryUuid || null;

  const cardsHref = `/directory?view=cards${noticeEntryUuid ? `&entryUuid=${encodeURIComponent(noticeEntryUuid)}` : ""}${reportId ? `&reportId=${encodeURIComponent(reportId)}` : ""}`;
  const legacyHref = `/directory?view=legacy${noticeEntryUuid ? `&entryUuid=${encodeURIComponent(noticeEntryUuid)}` : ""}${reportId ? `&reportId=${encodeURIComponent(reportId)}` : ""}`;

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

      <div className="flex flex-col gap-3 border-b border-white/10 pb-3 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-slate-100">MMID Directory</h1>
          <p className="mt-1 text-sm text-slate-400">
            Search and review players. Maintainer tools are available on selected profiles.
          </p>
          {reportId ? (
            <p className="mt-1 text-xs text-amber-300">Report-linked finalization mode is active.</p>
          ) : null}
        </div>

        <div className="inline-flex w-fit items-center rounded-lg border border-white/10 bg-slate-900/50 p-1">
          <a
            href={cardsHref}
            className={
              "rounded-md px-3 py-1.5 text-[12px] font-semibold transition " +
              (view === "cards"
                ? "bg-amber-500/90 text-slate-950"
                : "text-slate-300 hover:bg-white/5 hover:text-white")
            }
          >
            Cards
          </a>
          <a
            href={legacyHref}
            className={
              "rounded-md px-3 py-1.5 text-[12px] font-semibold transition " +
              (view === "legacy"
                ? "bg-amber-500/90 text-slate-950"
                : "text-slate-300 hover:bg-white/5 hover:text-white")
            }
          >
            Legacy
          </a>
        </div>
      </div>

      {view === "legacy" ? (
        <MMIDLegacySpreadsheet rows={data} canEdit={canEdit} reportId={reportId || null} />
      ) : (
        <MMIDDirectoryMasterDetail
          rows={mergedData}
          canEdit={canEdit}
          currentUserName={currentUserName}
          initialActiveUuid={initialActiveUuid}
          reportId={reportId || null}
          reportContext={reportContext}
        />
      )}
    </div>
  );
}

// src/app/directory/page.tsx
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";
import type { ReactNode } from "react";

export const dynamic = "force-dynamic";

// ---------- UI helpers ----------
function Pill({
  children,
  tone = "slate",
  title,
}: {
  children: ReactNode;
  tone?: "slate" | "green" | "red" | "yellow" | "blue" | "purple" | "orange" | "gray";
  title?: string;
}) {
  const tones: Record<string, string> = {
    slate: "bg-slate-700/60 text-slate-100 ring-1 ring-white/10",
    green: "bg-green-600/90 text-white",
    red: "bg-red-600/90 text-white",
    yellow: "bg-yellow-500/90 text-black",
    blue: "bg-blue-600/90 text-white",
    purple: "bg-purple-600/90 text-white",
    orange: "bg-orange-500/90 text-black",
    gray: "bg-gray-600/90 text-white",
  };
  return (
    <span
      title={title}
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ${tones[tone]} whitespace-nowrap`}
    >
      {children}
    </span>
  );
}

function StatusBadge({ s }: { s?: string | null }) {
  const val = (s ?? "").toLowerCase();
  let tone: Parameters<typeof Pill>[0]["tone"] = "gray";
  if (val.includes("confirmed")) tone = "red";
  else if (val.includes("legit") || val.includes("cleared")) tone = "green";
  else if (val.includes("needs") || val.includes("review")) tone = "yellow";
  else if (val.includes("unverified")) tone = "gray";
  return <Pill tone={tone}>{s ?? "—"}</Pill>;
}

function Stars({ n = 0 }: { n?: number | null }) {
  const v = Math.max(0, Math.min(5, Number(n ?? 0)));
  return (
    <span aria-label={`${v} out of 5`} title={`${v}/5`}>
      {"★".repeat(v)}
      {"☆".repeat(5 - v)}
    </span>
  );
}

function Chips({ items }: { items?: string[] | null }) {
  if (!items?.length) return <>—</>;
  return (
    <div className="flex flex-wrap gap-1.5">
      {items.map((t, i) => (
        <Pill key={i} tone="slate" title={t}>
          {t}
        </Pill>
      ))}
    </div>
  );
}

const fmtDate = new Intl.DateTimeFormat(undefined, {
  year: "numeric",
  month: "short",
  day: "2-digit",
});

// ---------- utils ----------
function toInt(v: string | undefined, d = 1) {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : d;
}
function firstStr(v: string | string[] | undefined) {
  return Array.isArray(v) ? v[0] : v ?? "";
}

// ---------- page ----------
export default async function DirectoryPage({
  searchParams,
}: {
  // Next 15: searchParams is a Promise
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;

  const q = firstStr(sp.q).trim();
  const status = firstStr(sp.status ?? "any").trim().toLowerCase();
  const page = toInt(firstStr(sp.page), 1);
  const take = 50;
  const skip = (page - 1) * take;

  // Build filters without empty objects
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
        { redFlags: { has: q } },
        { typeOfCheating: { has: q } },
      ],
    });
  }
  if (status !== "any") {
    andFilters.push({ status: { contains: status, mode: "insensitive" } });
  }
  const where: Prisma.MmidEntryWhereInput = andFilters.length ? { AND: andFilters } : {};

  // Prefer sheet's Last Updated; then fallback to Prisma's updatedAt; always then username
  const orderBy: Prisma.MmidEntryOrderByWithRelationInput[] = [
    { lastUpdated: "desc" },
    { updatedAt: "desc" },
    { username: "asc" },
  ];

  const [items, total] = await Promise.all([
    prisma.mmidEntry.findMany({ where, orderBy, skip, take }),
    prisma.mmidEntry.count({ where }),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / take));
  const makeUrl = (p: number) =>
    `/directory?` + new URLSearchParams({ q, status, page: String(p) }).toString();

  return (
    <main className="p-6 max-w-7xl mx-auto text-sm text-gray-100">
      <h1 className="text-2xl font-bold mb-4">MMID Directory</h1>

      {/* Controls */}
      <form
        className="mb-4 grid gap-3 md:grid-cols-3 p-3 rounded-xl bg-white/5 ring-1 ring-white/10"
        action="/directory"
        method="get"
      >
        <input
          name="q"
          defaultValue={q}
          placeholder="Search username, UUID, guild, notes, flags…"
          className="border rounded-lg p-2 bg-black/40 border-white/10 focus:outline-none focus:ring-2 focus:ring-white/20"
        />
        <select
          name="status"
          defaultValue={status}
          className="border rounded-lg p-2 bg-black/40 border-white/10 focus:outline-none focus:ring-2 focus:ring-white/20"
        >
          <option value="any">Any status</option>
          <option value="unverified">Unverified</option>
          <option value="confirmed">Confirmed</option>
          <option value="legit">Legit</option>
          <option value="cleared">Cleared</option>
          <option value="needs review">Needs review</option>
        </select>
        <button
          className="rounded-lg p-2 font-semibold bg-white/10 border border-white/10 hover:bg-white/20"
          type="submit"
        >
          Search
        </button>
      </form>

      <div className="text-xs opacity-70 mb-2">
        Showing {items.length} of {total} result{total === 1 ? "" : "s"}
        {q ? <> for “{q}”</> : null}
        {status !== "any" ? <> · status: {status}</> : null}
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-2xl shadow-xl ring-1 ring-white/10 bg-white/5 backdrop-blur supports-[backdrop-filter]:bg-white/5">
        <table className="min-w-full text-sm">
          <thead className="bg-white/10 sticky top-0 z-10 backdrop-blur supports-[backdrop-filter]:bg-white/10">
            <tr className="text-left">
              <th className="p-3 font-semibold">Username</th>
              <th className="p-3 font-semibold w-[290px]">UUID</th>
              <th className="p-3 font-semibold w-[160px]">Guild</th>
              <th className="p-3 font-semibold w-[140px]">Status</th>
              <th className="p-3 font-semibold w-[120px]">Rank</th>
              <th className="p-3 font-semibold w-[220px]">Type of cheating</th>
              <th className="p-3 font-semibold w-[140px]">Reviewed by</th>
              <th className="p-3 font-semibold w-[120px]">Confidence</th>
              <th className="p-3 font-semibold w-[220px]">Red Flags</th>
              <th className="p-3 font-semibold w-[360px]">Notes/Evidence</th>
              <th className="p-3 font-semibold w-[150px]">Last Updated</th>
              <th className="p-3 font-semibold w-[90px]">NameMC</th>
            </tr>
          </thead>

          <tbody className="[&>tr:nth-child(even)]:bg-white/5">
            {items.map((e) => (
              <tr key={e.uuid} className="border-t border-white/5 hover:bg-white/10 align-top">
                <td className="p-3 font-medium">{e.username}</td>

                <td className="p-3">
                  <span className="font-mono text-xs block max-w-[280px] truncate" title={e.uuid}>
                    {e.uuid}
                  </span>
                </td>

                <td className="p-3">
                  {e.guild ? (
                    <Pill tone="blue" title={e.guild}>
                      {e.guild}
                    </Pill>
                  ) : (
                    "—"
                  )}
                </td>

                <td className="p-3">
                  <StatusBadge s={e.status} />
                </td>

                <td className="p-3">{e.rank ? <Pill tone="purple">{e.rank}</Pill> : "—"}</td>

                <td className="p-3">
                  <Chips items={e.typeOfCheating} />
                </td>

                <td className="p-3">{e.reviewedBy ?? "—"}</td>

                <td className="p-3">
                  <Stars n={e.confidenceScore as number | null} />
                </td>

                <td className="p-3">
                  <Chips items={e.redFlags} />
                </td>

                <td className="p-3">
                  {e.notesEvidence ? (
                    // If you use tailwind line-clamp plugin, swap truncate for line-clamp-2
                    <span className="block max-w-[340px] truncate" title={e.notesEvidence}>
                      {e.notesEvidence}
                    </span>
                  ) : (
                    "—"
                  )}
                </td>

                <td className="p-3">
                  {e.lastUpdated
                    ? fmtDate.format(e.lastUpdated as unknown as Date)
                    : e.updatedAt
                    ? fmtDate.format(e.updatedAt as unknown as Date)
                    : "—"}
                </td>

                <td className="p-3">
                  {e.nameMcLink ? (
                    <a
                      href={e.nameMcLink}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 rounded-lg border border-white/10 px-2 py-1 text-xs hover:bg-white/10"
                      title="Open NameMC"
                    >
                      Link ↗
                    </a>
                  ) : (
                    "—"
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {items.length === 0 && <div className="p-6 text-center opacity-70">No matches found.</div>}
      </div>

      {/* Pagination */}
      <div className="flex items-center gap-2 mt-4">
        <a
          href={makeUrl(Math.max(1, page - 1))}
          className={`border rounded-lg px-3 py-1 border-gray-700 ${
            page <= 1 ? "pointer-events-none opacity-40" : ""
          }`}
        >
          ← Prev
        </a>
        <span className="text-xs opacity-70">
          Page {page} / {totalPages}
        </span>
        <a
          href={makeUrl(Math.min(totalPages, page + 1))}
          className={`border rounded-lg px-3 py-1 border-gray-700 ${
            page >= totalPages ? "pointer-events-none opacity-40" : ""
          }`}
        >
          Next →
        </a>
      </div>
    </main>
  );
}

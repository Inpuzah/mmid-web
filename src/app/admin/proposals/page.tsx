// src/app/admin/proposals/page.tsx
import { getServerSession } from "next-auth";
import { authOptions } from "@/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { approveAction, rejectAction } from "./page.actions";

export const dynamic = "force-dynamic";

function isManager(role?: string | null) {
  return !!role && ["ADMIN", "MAINTAINER"].includes(role);
}

function fmtDate(d?: Date | null) {
  if (!d) return "—";
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(d);
}

type EntryShape = {
  uuid?: string;
  username?: string;
  guild?: string | null;
  status?: string | null;
  rank?: string | null;
  typeOfCheating?: string[];
  reviewedBy?: string | null;
  confidenceScore?: number | null;
  redFlags?: string[];
  notesEvidence?: string | null;
  lastUpdated?: string | Date | null;
  nameMcLink?: string | null;
};

function toComparable(e: any): EntryShape {
  if (!e) return {};
  const last =
    typeof e.lastUpdated === "string"
      ? e.lastUpdated
      : e.lastUpdated instanceof Date
      ? e.lastUpdated.toISOString()
      : null;
  return {
    uuid: e.uuid,
    username: e.username,
    guild: e.guild ?? null,
    status: e.status ?? null,
    rank: e.rank ?? null,
    typeOfCheating: Array.isArray(e.typeOfCheating) ? e.typeOfCheating : [],
    reviewedBy: e.reviewedBy ?? null,
    confidenceScore:
      typeof e.confidenceScore === "number" ? e.confidenceScore : null,
    redFlags: Array.isArray(e.redFlags) ? e.redFlags : [],
    notesEvidence: e.notesEvidence ?? null,
    lastUpdated: last,
    nameMcLink: e.nameMcLink ?? null,
  };
}

function diffFields(current: EntryShape, proposed: EntryShape) {
  const keys = [
    "uuid",
    "username",
    "guild",
    "status",
    "rank",
    "typeOfCheating",
    "reviewedBy",
    "confidenceScore",
    "redFlags",
    "notesEvidence",
    "lastUpdated",
    "nameMcLink",
  ] as const;

  const changes: Array<{
    key: (typeof keys)[number];
    from: any;
    to: any;
    changed: boolean;
  }> = [];

  for (const k of keys) {
    const a = current[k];
    const b = proposed[k];
    const same =
      Array.isArray(a) && Array.isArray(b)
        ? JSON.stringify([...a].sort()) === JSON.stringify([...b].sort())
        : a === b;
    changes.push({ key: k, from: a ?? "—", to: b ?? "—", changed: !same });
  }
  return changes;
}

export default async function ProposalsPage() {
  const session = await getServerSession(authOptions);
  const role = (session?.user as any)?.role ?? null;
  if (!session || !isManager(role)) redirect("/");

  const proposals = await prisma.mmidEntryProposal.findMany({
    where: { status: "PENDING" },
    include: {
      proposer: true,
      target: true,
    },
    orderBy: { createdAt: "desc" },
  });

  return (
    <main className="min-h-[calc(100vh-4rem)] w-full px-4 sm:px-6 lg:px-8 py-6">
      <div className="mx-auto max-w-6xl space-y-6">
        <h1 className="text-xl font-extrabold tracking-[0.18em] uppercase text-yellow-200 drop-shadow-[0_0_6px_rgba(0,0,0,0.9)]">
          Pending Proposals
        </h1>

        {proposals.length === 0 ? (
          <div className="rounded-lg border border-white/10 p-6 bg-slate-900/40">
            <p className="text-slate-300">No pending proposals 🎉</p>
          </div>
        ) : (
          <ul className="space-y-4">
            {proposals.map((p) => {
              const proposed = toComparable(p.proposedData);
              const current = toComparable(p.target);
              const changes = diffFields(current, proposed);
              const title =
                p.action === "DELETE"
                  ? `Delete ${p.targetUuid}`
                  : `${p.action} ${proposed.username ?? p.target?.username ?? ""} (${proposed.uuid ?? p.targetUuid ?? ""})`;

              return (
                <li
                  key={p.id}
                  className="rounded-[4px] border-2 border-black/80 bg-slate-950/85 shadow-[0_0_0_1px_rgba(0,0,0,0.9),0_8px_0_0_rgba(0,0,0,0.9)]"
                >
                  <div className="p-4 sm:p-5">
                    <div className="flex flex-wrap items-center gap-2 justify-between">
                      <div className="min-w-0">
                        <div className="text-sm uppercase tracking-wide text-slate-400">
                          {p.action} • {fmtDate(p.createdAt)}
                        </div>
                        <div className="font-medium truncate">{title}</div>
                        <div className="text-sm text-slate-400 truncate">
                          Proposer: {p.proposer?.name ?? p.proposer?.email ?? "Unknown"}
                        </div>
                      </div>

                      <div className="flex gap-2">
                        {/* Approve */}
                        <form action={approveAction}>
                          <input type="hidden" name="proposalId" value={p.id} />
                          <button className="px-3 py-2 rounded-[3px] border-2 border-black/80 bg-emerald-500 hover:brightness-110 text-black text-sm shadow-[0_0_0_1px_rgba(0,0,0,0.9),0_4px_0_0_rgba(0,0,0,0.9)]">
                            Approve
                          </button>
                        </form>

                        {/* Reject */}
                        <form action={rejectAction} className="flex items-center gap-2">
                          <input type="hidden" name="proposalId" value={p.id} />
                          <input
                            name="reviewComment"
                            placeholder="Reason (optional)"
                            className="px-2 py-1 rounded-[3px] border-2 border-black/80 bg-slate-950/80 text-slate-100 text-sm shadow-[0_0_0_1px_rgba(0,0,0,0.85)]"
                          />
                          <button className="px-3 py-2 rounded-[3px] border-2 border-black/80 bg-rose-500 hover:brightness-110 text-black text-sm shadow-[0_0_0_1px_rgba(0,0,0,0.9),0_4px_0_0_rgba(0,0,0,0.9)]">
                            Reject
                          </button>
                        </form>
                      </div>
                    </div>

                    {/* Diff */}
                    {p.action !== "DELETE" && (
                      <div className="mt-4 overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="text-left text-slate-400">
                              <th className="py-2 pr-4">Field</th>
                              <th className="py-2 pr-4">Current</th>
                              <th className="py-2">Proposed</th>
                            </tr>
                          </thead>
                          <tbody>
                            {changes.map(({ key, from, to, changed }) => (
                              <tr
                                key={String(key)}
                                className={changed ? "bg-emerald-500/5" : ""}
                              >
                                <td className="py-2 pr-4 align-top font-medium">
                                  {String(key)}
                                </td>
                                <td className="py-2 pr-4 align-top text-slate-300 break-words">
                                  {Array.isArray(from) ? from.join(", ") : String(from)}
                                </td>
                                <td className="py-2 align-top text-slate-100 break-words">
                                  {Array.isArray(to) ? to.join(", ") : String(to)}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}

                    {p.action === "DELETE" && (
                      <p className="mt-3 text-sm text-amber-300">
                        This will remove the entry <code>{p.targetUuid}</code>.
                      </p>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </main>
  );
}

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/authz";

export async function GET(req: Request) {
  await requireAdmin();
  const { searchParams } = new URL(req.url);
  const q = (searchParams.get("q") || "").trim();
  const action = searchParams.get("action") || "";
  const from = searchParams.get("from") ? new Date(searchParams.get("from")!) : null;
  const to = searchParams.get("to") ? new Date(searchParams.get("to")!) : null;

  const where: any = {};
  if (action) where.action = action;
  if (from || to) where.createdAt = { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) };
  if (q) {
    where.OR = [
      { targetId: { contains: q, mode: "insensitive" } },
      { targetType: { contains: q, mode: "insensitive" } },
      { meta: { path: [], string_contains: q } },
    ];
  }

  const logs = await prisma.auditLog.findMany({
    where,
    include: { actor: { select: { name: true, email: true } } },
    orderBy: { createdAt: "desc" },
    take: 5000,
  });

  const headers = ["time","action","actor","targetType","targetId","meta"].join(",");
  const rows = logs.map(l => {
    const meta = JSON.stringify(l.meta ?? {});
    const actor = l.actor?.name ?? l.actor?.email ?? "";
    return [
      new Date(l.createdAt).toISOString(),
      l.action,
      actor.replace(/,/g, " "),
      l.targetType ?? "",
      l.targetId ?? "",
      meta.replace(/"/g, '""'),
    ].map((cell, i) => (i === 5 ? `"${cell}"` : cell)).join(",");
  });
  const csv = [headers, ...rows].join("\n");

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv",
      "Content-Disposition": `attachment; filename="audit-${Date.now()}.csv"`,
    },
  });
}

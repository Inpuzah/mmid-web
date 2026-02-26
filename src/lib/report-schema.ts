import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";

function isMissingReportTableError(err: unknown) {
  if (!(err instanceof Prisma.PrismaClientKnownRequestError)) return false;
  if (err.code !== "P2021") return false;

  const meta = err.meta as Record<string, unknown> | undefined;
  const table = typeof meta?.table === "string" ? meta.table : "";
  return table.includes("Report");
}

export async function isReportSchemaReady(): Promise<boolean> {
  try {
    await prisma.report.count({ where: { id: "__report_schema_probe__" } });
    return true;
  } catch (err) {
    if (isMissingReportTableError(err)) return false;

    try {
      const rows = await prisma.$queryRawUnsafe<Array<{ exists: boolean }>>(
        `SELECT EXISTS (
           SELECT 1
           FROM information_schema.tables
           WHERE table_schema = 'public' AND table_name = 'Report'
         ) AS "exists"`,
      );
      return Boolean(rows?.[0]?.exists);
    } catch {
      // If we cannot verify due to connectivity/permissions, avoid false-negative banner.
      return true;
    }
  }
}

export async function assertReportSchemaReady() {
  const ready = await isReportSchemaReady();
  if (!ready) {
    throw new Error("Report system is not initialized. Run `npx prisma migrate deploy`.");
  }
}

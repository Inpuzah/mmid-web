import { PrismaClient } from "@prisma/client";

const globalForPrisma = global as unknown as { prisma?: PrismaClient };

function createClient() {
  return new PrismaClient({
    log: ["error"],
  });
}

function isClientCompatible(p: PrismaClient | undefined): boolean {
  // In Next.js dev, PrismaClient is cached on global to avoid exhausting connections.
  // When we change the Prisma schema and regenerate, the dev server can keep an older
  // PrismaClient instance alive (with missing model delegates), causing runtime errors.
  const anyP = p as any;
  return Boolean(anyP?.minecraftCrawlRun && anyP?.apiRequestMetricBucket);
}

export const prisma = isClientCompatible(globalForPrisma.prisma)
  ? (globalForPrisma.prisma as PrismaClient)
  : createClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

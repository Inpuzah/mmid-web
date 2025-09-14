// src/lib/lock.ts
import { prisma } from "@/lib/prisma";

export async function withJobLock<T>(key: string, ttlMs: number, fn: () => Promise<T>) {
  const now = new Date();
  const until = new Date(now.getTime() + ttlMs);

  // Acquire (or extend) lock if expired
  const current = await prisma.jobLock.findUnique({ where: { key } });
  if (current && current.lockedUntil > now) {
    throw new Error("LOCKED");
  }
  await prisma.jobLock.upsert({
    where: { key },
    create: { key, lockedUntil: until },
    update: { lockedUntil: until },
  });

  try {
    return await fn();
  } finally {
    // Release
    await prisma.jobLock.update({
      where: { key },
      data: { lockedUntil: new Date(0) },
    });
  }
}

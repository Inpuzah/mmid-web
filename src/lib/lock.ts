// src/lib/lock.ts
//
// Cross-process mutex using Postgres advisory locks.
//
// This is useful in Next.js deployments where multiple server instances can
// race to run the same background refresh, causing rate limit spikes.

import { prisma } from "@/lib/prisma";

export type AdvisoryLockKey = {
  key1: number;
  key2: number;
};

async function tryAdvisoryLock(key: AdvisoryLockKey): Promise<boolean> {
  const rows = (await prisma.$queryRaw`
    SELECT pg_try_advisory_lock(${key.key1}::int, ${key.key2}::int) AS locked
  `) as Array<{ locked: boolean }>;

  return Boolean(rows?.[0]?.locked);
}

async function unlockAdvisoryLock(key: AdvisoryLockKey): Promise<void> {
  await prisma.$queryRaw`
    SELECT pg_advisory_unlock(${key.key1}::int, ${key.key2}::int)
  `;
}

/**
 * Attempt to run `fn` under a Postgres advisory lock.
 *
 * If the lock cannot be acquired, this returns `{ ran: false }` and does not
 * execute `fn`.
 */
export async function withPgAdvisoryLock<T>(
  key: AdvisoryLockKey,
  fn: () => Promise<T>,
): Promise<{ ran: boolean; value?: T }> {
  const locked = await tryAdvisoryLock(key);
  if (!locked) return { ran: false };

  try {
    const value = await fn();
    return { ran: true, value };
  } finally {
    try {
      await unlockAdvisoryLock(key);
    } catch (e) {
      // Best effort: if unlock fails due to connection issues, Postgres will
      // release advisory locks when the session closes.
      console.error("Failed to unlock advisory lock", key, e);
    }
  }
}
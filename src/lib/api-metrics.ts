// src/lib/api-metrics.ts

import { prisma } from "@/lib/prisma";

export type ApiRequestMetricInput = {
  api: string;
  ok: boolean;
  status?: number | null;
  latencyMs?: number | null;
};

function minuteBucketStartUtc(d: Date): Date {
  const bucket = new Date(d);
  bucket.setUTCSeconds(0, 0);
  return bucket;
}

/**
 * Best-effort increment of aggregated per-minute counters.
 *
 * This is intended for admin debugging / rate-limit visibility only.
 * It should never break the main request path if the DB is unavailable.
 */
export async function recordApiRequestMetric(input: ApiRequestMetricInput): Promise<void> {
  // Keep overhead minimal in CI/build contexts.
  if (process.env.NODE_ENV === "test") return;

  const api = input.api;
  if (!api) return;

  const now = new Date();
  const bucketStart = minuteBucketStartUtc(now);

  const latency = Math.max(0, Math.trunc(input.latencyMs ?? 0));
  const errorInc = input.ok ? 0 : 1;

  try {
    await prisma.apiRequestMetricBucket.upsert({
      where: {
        api_bucketStart: {
          api,
          bucketStart,
        },
      },
      create: {
        api,
        bucketStart,
        count: 1,
        errorCount: errorInc,
        latencyMsTotal: latency,
      },
      update: {
        count: { increment: 1 },
        errorCount: { increment: errorInc },
        latencyMsTotal: { increment: latency },
      },
    });
  } catch {
    // Swallow metrics errors. We do not want to impact user-facing requests.
  }
}

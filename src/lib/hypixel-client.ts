// src/lib/hypixel-client.ts

const HYPIXEL_API_BASE = "https://api.hypixel.net" as const;

const FIVE_MINUTES_MS = 5 * 60 * 1000;
// Stay under Hypixel's documented 300 / 5min rate limit with a margin.
const MAX_TOKENS = 200;

let windowResetAt = 0;
let remainingTokens = MAX_TOKENS;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function mustApiKey(): string {
  const key = process.env.HYPIXEL_API_KEY;
  if (!key) {
    throw new Error("HYPIXEL_API_KEY env var is required for Hypixel API calls");
  }
  return key;
}

async function respectRateLimit() {
  const now = Date.now();

  if (now >= windowResetAt) {
    // New window.
    windowResetAt = now + FIVE_MINUTES_MS;
    remainingTokens = MAX_TOKENS;
  }

  if (remainingTokens <= 0) {
    const waitMs = Math.max(0, windowResetAt - now + 500); // small safety margin
    if (waitMs > 0) {
      await sleep(waitMs);
    }
    // After waiting, reset the window and tokens.
    const later = Date.now();
    windowResetAt = later + FIVE_MINUTES_MS;
    remainingTokens = MAX_TOKENS - 1;
    return;
  }

  remainingTokens -= 1;
}

function updateRateLimitFromHeaders(res: Response) {
  const remainingHeader = res.headers.get("RateLimit-Remaining");
  const resetHeader = res.headers.get("RateLimit-Reset");

  const now = Date.now();

  if (remainingHeader != null) {
    const parsed = Number(remainingHeader);
    if (!Number.isNaN(parsed) && parsed >= 0) {
      // Keep our local counter in sync but never increase it above MAX_TOKENS.
      remainingTokens = Math.min(MAX_TOKENS, parsed);
    }
  }

  if (resetHeader != null) {
    const parsedSeconds = Number(resetHeader);
    if (!Number.isNaN(parsedSeconds) && parsedSeconds >= 0) {
      const headerResetAt = now + parsedSeconds * 1000;
      // Do not move the reset earlier than our current window, only later.
      if (headerResetAt > windowResetAt) {
        windowResetAt = headerResetAt;
      }
    }
  }
}

export async function hypixelFetchJson<T>(
  path: string,
  options?: { revalidateSeconds?: number }
): Promise<T> {
  await respectRateLimit();

  const key = mustApiKey();
  const url = `${HYPIXEL_API_BASE}${path}` as string;

  const res = await fetch(url, {
    headers: { "API-Key": key },
    // Default to ~4h cache; callers can override if they want shorter.
    next: { revalidate: options?.revalidateSeconds ?? 60 * 60 * 4 },
  });

  updateRateLimitFromHeaders(res);

  if (!res.ok) {
    throw new Error(`Hypixel API error ${res.status} for ${path}`);
  }

  return (await res.json()) as T;
}

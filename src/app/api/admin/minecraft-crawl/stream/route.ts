// src/app/api/admin/minecraft-crawl/stream/route.ts

import { requireMaintainer } from "@/lib/authz";
import { runMinecraftCrawlBatch, type MinecraftCrawlEvent } from "@/lib/minecraft-crawl";

export const dynamic = "force-dynamic";

function intParam(url: URL, key: string, fallback: number): number {
  const v = url.searchParams.get(key);
  const n = v == null ? NaN : Number(v);
  return Number.isFinite(n) ? Math.trunc(n) : fallback;
}

function sseLine(s: string) {
  return `${s}\n`;
}

function sseJson(evt: MinecraftCrawlEvent) {
  // Default event type is "message"; we include eventType inside the data.
  return sseLine(`data: ${JSON.stringify(evt)}`) + sseLine("");
}

export async function GET(req: Request) {
  await requireMaintainer();

  const url = new URL(req.url);
  const limit = intParam(url, "limit", 40);
  const minAgeMinutes = intParam(url, "minAgeMinutes", 60 * 24);
  const sleepMs = intParam(url, "sleepMs", 250);

  const stream = new TransformStream();
  const writer = stream.writable.getWriter();
  const enc = new TextEncoder();

  const write = async (chunk: string) => {
    await writer.write(enc.encode(chunk));
  };

  // Kick off the run asynchronously so we can return the streaming response immediately.
  void (async () => {
    try {
      await write(sseLine("event: open"));
      await write(sseLine("data: {}"));
      await write(sseLine(""));

      await runMinecraftCrawlBatch({
        limit,
        minAgeMinutes,
        sleepMs,
        logEvents: true,
        onEvent: async (evt) => {
          await write(sseJson(evt));
        },
      });
    } catch (err: any) {
      const evt: MinecraftCrawlEvent = {
        runId: "unknown",
        createdAt: new Date().toISOString(),
        level: "error",
        eventType: "run_finished",
        message: err?.message ?? "stream failed",
      };
      try {
        await write(sseJson(evt));
      } catch {
        // ignore
      }
    } finally {
      try {
        await writer.close();
      } catch {
        // ignore
      }
    }
  })();

  return new Response(stream.readable, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}

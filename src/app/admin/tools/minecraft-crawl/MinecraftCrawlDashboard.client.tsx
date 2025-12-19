"use client";

// src/app/admin/tools/minecraft-crawl/MinecraftCrawlDashboard.client.tsx

import * as React from "react";

type ApiBucketRow = {
  api: string;
  bucketStart: string;
  count: number;
  errorCount: number;
  latencyMsTotal: number;
};

type RunRow = {
  id: string;
  limit: number;
  minAgeMinutes: number;
  sleepMs: number;
  ran: boolean;
  candidates: number;
  processed: number;
  snapshotted: number;
  usernameChanged: number;
  errors: number;
  errorMessage: string | null;
  startedAt: string;
  finishedAt: string | null;
};

type StatusResponse = {
  ok: boolean;
  minutes: number;
  queue: { queue24h: number; queue60m: number; queue5m: number };
  runs: RunRow[];
  buckets: ApiBucketRow[];
};

type CrawlEvent = {
  level: "info" | "warn" | "error";
  eventType: string;
  runId: string;
  uuid?: string;
  usernameBefore?: string;
  usernameAfter?: string;
  message?: string;
  meta?: any;
  createdAt: string;
};

function fmt(n: number) {
  return new Intl.NumberFormat().format(n);
}

function minutesAgoBucketStartUtc(minutesAgo: number) {
  const d = new Date(Date.now() - minutesAgo * 60 * 1000);
  d.setUTCSeconds(0, 0);
  return d;
}

function buildSeries(buckets: ApiBucketRow[], api: string, minutes: number) {
  const byBucket = new Map<number, ApiBucketRow>();
  for (const b of buckets) {
    if (b.api !== api) continue;
    byBucket.set(new Date(b.bucketStart).getTime(), b);
  }

  const out: Array<{ bucketStart: Date; count: number; errorCount: number; avgLatencyMs: number }> = [];
  for (let i = minutes - 1; i >= 0; i--) {
    const start = minutesAgoBucketStartUtc(i);
    const row = byBucket.get(start.getTime());
    const count = row?.count ?? 0;
    const errorCount = row?.errorCount ?? 0;
    const avgLatencyMs = count > 0 ? Math.round((row?.latencyMsTotal ?? 0) / count) : 0;
    out.push({ bucketStart: start, count, errorCount, avgLatencyMs });
  }

  return out;
}

function Meter({ series }: { series: Array<{ bucketStart: Date; count: number; errorCount: number; avgLatencyMs: number }> }) {
  const max = Math.max(1, ...series.map((s) => s.count));
  return (
    <div className="h-12 flex items-end gap-[2px]">
      {series.map((s) => {
        const h = Math.max(2, Math.round((s.count / max) * 100));
        const hasErr = s.errorCount > 0;
        const title = `${s.bucketStart.toISOString()}\ncount=${s.count}, errors=${s.errorCount}, avg=${s.avgLatencyMs}ms`;
        return (
          <div
            key={s.bucketStart.getTime()}
            title={title}
            className={
              "w-[3px] rounded-t " +
              (hasErr ? "bg-red-400/80" : s.count > 0 ? "bg-sky-400/70" : "bg-slate-700/30")
            }
            style={{ height: `${h}%` }}
          />
        );
      })}
    </div>
  );
}

function formatLogLine(e: CrawlEvent) {
  const t = new Date(e.createdAt).toLocaleTimeString();
  const who = e.usernameAfter || e.usernameBefore || e.uuid || "";
  const prefix = `[${t}] [${e.level}]`;
  const main = e.message || e.eventType;
  return `${prefix} ${who ? who + " - " : ""}${main}`;
}

export default function MinecraftCrawlDashboard() {
  const [status, setStatus] = React.useState<StatusResponse | null>(null);
  const [statusError, setStatusError] = React.useState<string | null>(null);

  const [minutes] = React.useState<number>(60);

  const [limit, setLimit] = React.useState<number>(40);
  const [minAgeMinutes, setMinAgeMinutes] = React.useState<number>(60 * 24);
  const [sleepMs, setSleepMs] = React.useState<number>(250);

  const [running, setRunning] = React.useState(false);
  const [events, setEvents] = React.useState<CrawlEvent[]>([]);
  const [activeRunId, setActiveRunId] = React.useState<string | null>(null);

  const esRef = React.useRef<EventSource | null>(null);
  const logRef = React.useRef<HTMLDivElement | null>(null);

  const refreshStatus = React.useCallback(async () => {
    try {
      const res = await fetch(`/api/admin/minecraft-crawl/status?minutes=${minutes}`, { cache: "no-store" });
      const json = (await res.json()) as StatusResponse;
      if (!json.ok) throw new Error("status not ok");
      setStatus(json);
      setStatusError(null);
    } catch (e: any) {
      setStatusError(e?.message ?? "Failed to load status");
    }
  }, [minutes]);

  React.useEffect(() => {
    void refreshStatus();
    const t = setInterval(() => void refreshStatus(), 2000);
    return () => clearInterval(t);
  }, [refreshStatus]);

  React.useEffect(() => {
    // Auto-scroll log as events arrive.
    const el = logRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [events.length]);

  const stopStream = React.useCallback(() => {
    if (esRef.current) {
      esRef.current.close();
      esRef.current = null;
    }
    setRunning(false);
  }, []);

  const startStream = React.useCallback(() => {
    stopStream();

    setEvents([]);
    setActiveRunId(null);
    setRunning(true);

    const qs = new URLSearchParams({
      limit: String(limit),
      minAgeMinutes: String(minAgeMinutes),
      sleepMs: String(sleepMs),
    });

    const es = new EventSource(`/api/admin/minecraft-crawl/stream?${qs.toString()}`);
    esRef.current = es;

    es.onmessage = (msg) => {
      try {
        const evt = JSON.parse(msg.data) as CrawlEvent;
        setEvents((prev) => {
          // cap console buffer to keep UI snappy
          const next = prev.length > 2000 ? prev.slice(prev.length - 1500) : prev;
          return [...next, evt];
        });
        if (evt.runId && evt.runId !== "unknown") setActiveRunId(evt.runId);
        if (evt.eventType === "run_finished") {
          // Give the server a moment to flush run row; then refresh.
          setTimeout(() => void refreshStatus(), 250);
        }
      } catch {
        // ignore
      }
    };

    es.onerror = () => {
      stopStream();
      void refreshStatus();
    };
  }, [limit, minAgeMinutes, sleepMs, refreshStatus, stopStream]);

  const grouped = React.useMemo(() => {
    const byUuid = new Map<string, CrawlEvent[]>();
    for (const e of events) {
      if (!e.uuid) continue;
      const list = byUuid.get(e.uuid) ?? [];
      list.push(e);
      byUuid.set(e.uuid, list);
    }
    return byUuid;
  }, [events]);

  const apis = [
    { id: "mojang_sessionserver", label: "Mojang sessionserver" },
    { id: "mojang_textures", label: "textures.minecraft.net" },
    { id: "optifine", label: "OptiFine capes" },
  ] as const;

  const buckets = status?.buckets ?? [];

  return (
    <main className="mx-auto max-w-6xl px-5 py-6 space-y-6">
      <div className="space-y-2">
        <h1 className="text-xl font-extrabold tracking-[0.18em] uppercase text-yellow-200 drop-shadow-[0_0_6px_rgba(0,0,0,0.9)]">
          Minecraft Crawl Debug
        </h1>
        <p className="text-sm text-slate-300">
          This dashboard polls status every ~2s and can run an interactive crawl batch with live console output.
        </p>
        {statusError && <p className="text-xs text-red-300">Status error: {statusError}</p>}
      </div>

      <section className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-[4px] border-2 border-black/80 bg-slate-950/85 p-5 shadow-[0_0_0_1px_rgba(0,0,0,0.9),0_8px_0_0_rgba(0,0,0,0.9)]">
          <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-300/90">Queue (last 24h)</div>
          <div className="mt-3 text-2xl font-extrabold text-slate-50">{fmt(status?.queue.queue24h ?? 0)}</div>
        </div>
        <div className="rounded-[4px] border-2 border-black/80 bg-slate-950/85 p-5 shadow-[0_0_0_1px_rgba(0,0,0,0.9),0_8px_0_0_rgba(0,0,0,0.9)]">
          <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-300/90">Queue (last 60m)</div>
          <div className="mt-3 text-2xl font-extrabold text-slate-50">{fmt(status?.queue.queue60m ?? 0)}</div>
        </div>
        <div className="rounded-[4px] border-2 border-black/80 bg-slate-950/85 p-5 shadow-[0_0_0_1px_rgba(0,0,0,0.9),0_8px_0_0_rgba(0,0,0,0.9)]">
          <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-300/90">Queue (last 5m)</div>
          <div className="mt-3 text-2xl font-extrabold text-slate-50">{fmt(status?.queue.queue5m ?? 0)}</div>
        </div>
      </section>

      <section className="rounded-[4px] border-2 border-black/80 bg-slate-950/85 p-5 shadow-[0_0_0_1px_rgba(0,0,0,0.9),0_8px_0_0_rgba(0,0,0,0.9)] space-y-4">
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-200">Run interactive batch</h2>
          <p className="mt-1 text-xs text-slate-400">
            Starts a server-sent-events stream and shows the crawler output live. This also stores per-player events for this run.
          </p>
          {activeRunId && <p className="mt-1 text-[11px] text-slate-400">Active run: <span className="font-mono">{activeRunId}</span></p>}
        </div>

        <div className="flex flex-wrap items-end gap-4">
          <label className="grid gap-1 text-xs text-slate-200">
            <span className="font-semibold uppercase tracking-[0.18em] text-slate-300/90">Limit</span>
            <input
              type="number"
              value={limit}
              onChange={(e) => setLimit(Number(e.target.value))}
              className="w-full max-w-[220px] rounded-[3px] border border-slate-700 bg-slate-950/60 px-3 py-2 text-slate-100"
            />
          </label>
          <label className="grid gap-1 text-xs text-slate-200">
            <span className="font-semibold uppercase tracking-[0.18em] text-slate-300/90">Min age (minutes)</span>
            <input
              type="number"
              value={minAgeMinutes}
              onChange={(e) => setMinAgeMinutes(Number(e.target.value))}
              className="w-full max-w-[220px] rounded-[3px] border border-slate-700 bg-slate-950/60 px-3 py-2 text-slate-100"
            />
          </label>
          <label className="grid gap-1 text-xs text-slate-200">
            <span className="font-semibold uppercase tracking-[0.18em] text-slate-300/90">Sleep (ms)</span>
            <input
              type="number"
              value={sleepMs}
              onChange={(e) => setSleepMs(Number(e.target.value))}
              className="w-full max-w-[220px] rounded-[3px] border border-slate-700 bg-slate-950/60 px-3 py-2 text-slate-100"
            />
          </label>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={startStream}
              disabled={running}
              className="px-4 py-2 rounded-[3px] border-2 border-black/80 bg-emerald-500 hover:brightness-110 disabled:opacity-60 disabled:cursor-not-allowed text-black shadow-[0_0_0_1px_rgba(0,0,0,0.9),0_4px_0_0_rgba(0,0,0,0.9)]"
            >
              {running ? "Running…" : "Run batch (live)"}
            </button>
            <button
              type="button"
              onClick={stopStream}
              disabled={!running}
              className="px-4 py-2 rounded-[3px] border-2 border-black/80 bg-slate-700 hover:brightness-110 disabled:opacity-60 disabled:cursor-not-allowed text-slate-100 shadow-[0_0_0_1px_rgba(0,0,0,0.9),0_4px_0_0_rgba(0,0,0,0.9)]"
            >
              Stop
            </button>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-300/90">Console</div>
            <div
              ref={logRef}
              className="mt-2 h-[280px] overflow-auto rounded border border-slate-800 bg-black/40 p-2 font-mono text-[11px] text-slate-200"
            >
              {events.length === 0 ? (
                <div className="text-slate-500">(no output yet)</div>
              ) : (
                events.map((e, idx) => (
                  <div key={idx} className={e.level === "error" ? "text-red-300" : e.level === "warn" ? "text-yellow-200" : ""}>
                    {formatLogLine(e)}
                  </div>
                ))
              )}
            </div>
          </div>

          <div>
            <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-300/90">Per-player details</div>
            <div className="mt-2 h-[280px] overflow-auto rounded border border-slate-800 bg-slate-950/40 p-2 text-xs text-slate-200">
              {grouped.size === 0 ? (
                <div className="text-slate-500">(no players yet)</div>
              ) : (
                Array.from(grouped.entries()).map(([uuid, evts]) => {
                  const latestName = evts
                    .slice()
                    .reverse()
                    .find((x) => x.usernameAfter)?.usernameAfter;
                  const nameBefore = evts.find((x) => x.usernameBefore)?.usernameBefore;
                  const nameAfter = evts
                    .slice()
                    .reverse()
                    .find((x) => x.usernameAfter)?.usernameAfter;
                  const title = nameBefore && nameAfter && nameBefore !== nameAfter ? `${nameBefore} -> ${nameAfter}` : nameAfter || nameBefore || uuid;

                  const changeEvt = evts.find((x) => x.eventType === "username_changed");

                  return (
                    <details key={uuid} className="rounded border border-slate-800/60 bg-slate-950/30 p-2 mb-2">
                      <summary className="cursor-pointer select-none">
                        <span className="font-mono text-[11px] text-slate-400">{uuid}</span>
                        <span className="ml-2" title={title}>
                          {latestName || nameBefore || "(unknown)"}
                        </span>
                        {changeEvt?.usernameBefore && changeEvt?.usernameAfter && (
                          <span
                            className="ml-2 text-[11px] text-yellow-200/90"
                            title={`${changeEvt.usernameBefore} -> ${changeEvt.usernameAfter}`}
                          >
                            (renamed)
                          </span>
                        )}
                      </summary>
                      <div className="mt-2 space-y-1">
                        {evts.map((e, idx) => (
                          <div key={idx} className="text-[11px] text-slate-300">
                            <span className="font-mono text-slate-500">{new Date(e.createdAt).toLocaleTimeString()}</span>
                            <span className={"ml-2 " + (e.level === "error" ? "text-red-300" : e.level === "warn" ? "text-yellow-200" : "")}>{e.eventType}</span>
                            {e.message && <span className="ml-2">{e.message}</span>}
                            {e.eventType === "snapshot_saved" && e.meta && (
                              <div className="mt-1 ml-6 grid gap-1 text-[11px] text-slate-400">
                                {e.meta.skinUrl && (
                                  <a className="underline" href={e.meta.skinUrl} target="_blank" rel="noreferrer">
                                    skinUrl
                                  </a>
                                )}
                                {e.meta.mojangCapeUrl && (
                                  <a className="underline" href={e.meta.mojangCapeUrl} target="_blank" rel="noreferrer">
                                    mojangCapeUrl
                                  </a>
                                )}
                                {e.meta.optifineCapeUrl && (
                                  <a className="underline" href={e.meta.optifineCapeUrl} target="_blank" rel="noreferrer">
                                    optifineCapeUrl
                                  </a>
                                )}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </details>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </section>

      <section className="rounded-[4px] border-2 border-black/80 bg-slate-950/85 p-5 shadow-[0_0_0_1px_rgba(0,0,0,0.9),0_8px_0_0_rgba(0,0,0,0.9)]">
        <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-200">API meters (last 60 minutes)</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-3">
          {apis.map((a) => {
            const series = buildSeries(buckets, a.id, minutes);
            const total = series.reduce((acc, x) => acc + x.count, 0);
            const errors = series.reduce((acc, x) => acc + x.errorCount, 0);
            const avg = total > 0 ? Math.round(series.reduce((acc, x) => acc + x.avgLatencyMs * x.count, 0) / total) : 0;

            return (
              <div key={a.id} className="rounded border border-slate-800 bg-slate-950/40 p-3">
                <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-300/90">{a.label}</div>
                <div className="mt-1 text-[11px] text-slate-400">
                  Requests: <span className="font-mono">{fmt(total)}</span>, errors:
                  <span className="font-mono"> {fmt(errors)}</span>, avg latency:
                  <span className="font-mono"> {fmt(avg)}ms</span>
                </div>
                <div className="mt-3">
                  <Meter series={series} />
                </div>
              </div>
            );
          })}
        </div>
        <p className="mt-3 text-[11px] text-slate-500">
          Bars are per-minute request counts; red bars indicate minutes where at least one request failed.
        </p>
      </section>

      <section className="rounded-[4px] border-2 border-black/80 bg-slate-950/85 p-5 shadow-[0_0_0_1px_rgba(0,0,0,0.9),0_8px_0_0_rgba(0,0,0,0.9)]">
        <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-200">Recent crawl runs</h2>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="text-slate-400">
              <tr className="text-left">
                <th className="py-2 pr-3">Started</th>
                <th className="py-2 pr-3">Ran</th>
                <th className="py-2 pr-3">Processed</th>
                <th className="py-2 pr-3">Snapshotted</th>
                <th className="py-2 pr-3">Username Δ</th>
                <th className="py-2 pr-3">Errors</th>
                <th className="py-2 pr-3">Params</th>
                <th className="py-2 pr-3">Run ID</th>
              </tr>
            </thead>
            <tbody className="text-slate-200">
              {(status?.runs ?? []).map((r) => (
                <tr key={r.id} className="border-t border-slate-900/60">
                  <td className="py-2 pr-3 whitespace-nowrap">{new Date(r.startedAt).toLocaleString()}</td>
                  <td className="py-2 pr-3">{r.ran ? "yes" : "no"}</td>
                  <td className="py-2 pr-3 font-mono">{r.processed}</td>
                  <td className="py-2 pr-3 font-mono">{r.snapshotted}</td>
                  <td className="py-2 pr-3 font-mono">{r.usernameChanged}</td>
                  <td className={"py-2 pr-3 font-mono " + (r.errors > 0 ? "text-red-300" : "")}>{r.errors}</td>
                  <td className="py-2 pr-3 text-[11px] text-slate-400 whitespace-nowrap">
                    limit={r.limit}, minAge={r.minAgeMinutes}m, sleep={r.sleepMs}ms
                  </td>
                  <td className="py-2 pr-3 font-mono text-[11px] text-slate-400 whitespace-nowrap">{r.id}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}

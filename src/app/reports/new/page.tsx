import { getServerSession } from "next-auth";
import { authOptions } from "@/auth";
import { redirect } from "next/navigation";
import { submitReport } from "@/app/entries/new/actions";
import HcaptchaField from "@/app/entries/new/HcaptchaField";
import ReportEvidenceFields from "@/app/entries/new/ReportEvidenceFields";
import { hypixelFetchJson } from "@/lib/hypixel-client";

type Prefill = {
  uuid: string;
  username: string;
  guild: string | null;
  rank: string | null;
  skinUrl: string;
  headUrl: string;
  nameMcLink: string;
} | null;

const isUuidLike = (v: string) => /^[0-9a-fA-F-]{32,36}$/.test(v);
const stripDashes = (v: string) => v.replace(/-/g, "");
const addDashes = (v: string) =>
  v.length === 32 ? `${v.slice(0, 8)}-${v.slice(8, 12)}-${v.slice(12, 16)}-${v.slice(16, 20)}-${v.slice(20)}` : v;

async function fetchJson<T>(url: string, init?: RequestInit) {
  const res = await fetch(url, { ...init, next: { revalidate: 60 } });
  if (!res.ok) throw new Error(`HTTP ${res.status} ${url}`);
  return (await res.json()) as T;
}

function hypixelRank(p: any): string | null {
  if (!p) return null;
  if (p.rank && p.rank !== "NORMAL") return p.rank;
  if (p.monthlyPackageRank === "SUPERSTAR") return "MVP++";
  if (p.newPackageRank) return String(p.newPackageRank).replace(/_/g, " ");
  return null;
}

async function serverLookup(queryRaw: string): Promise<Prefill> {
  const q = queryRaw.trim();
  if (!q) return null;

  try {
    let uuidNoDash = "";
    let username = "";

    if (isUuidLike(q)) {
      uuidNoDash = stripDashes(q);
      const profile = await fetchJson<{ name: string }>(`https://sessionserver.mojang.com/session/minecraft/profile/${uuidNoDash}`);
      username = profile?.name ?? "";
    } else {
      const profile = await fetchJson<{ id: string; name: string }>(`https://api.mojang.com/users/profiles/minecraft/${encodeURIComponent(q)}`);
      uuidNoDash = profile?.id ?? "";
      username = profile?.name ?? q;
      if (!uuidNoDash) throw new Error("Username not found");
    }

    if (!uuidNoDash) throw new Error("Could not resolve UUID");

    const uuid = addDashes(uuidNoDash);
    let rank: string | null = null;
    let guild: string | null = null;

    if (process.env.HYPIXEL_API_KEY) {
      try {
        const player = await hypixelFetchJson<any>(`/player?uuid=${uuidNoDash}`, { revalidateSeconds: 60 });
        rank = hypixelRank(player?.player) ?? null;
      } catch {}

      try {
        const guildRes = await hypixelFetchJson<any>(`/guild?player=${uuidNoDash}`, { revalidateSeconds: 60 });
        guild = guildRes?.guild?.name ?? null;
      } catch {}
    }

    return {
      uuid,
      username,
      guild,
      rank,
      skinUrl: `https://visage.surgeplay.com/bust/256/${encodeURIComponent(username)}.png`,
      headUrl: `https://mc-heads.net/avatar/${encodeURIComponent(username)}/80`,
      nameMcLink: `https://namemc.com/profile/${encodeURIComponent(uuid)}`,
    };
  } catch {
    return null;
  }
}

function firstStr(v: string | string[] | undefined) {
  return Array.isArray(v) ? v[0] : v ?? "";
}

export default async function NewReportPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await getServerSession(authOptions);
  const devBypass = !session && process.env.NEXT_PUBLIC_DEV_AUTH_BYPASS === "1";
  if (!session && !devBypass) redirect("/");

  const resolved = (await searchParams) ?? {};
  const query = firstStr(resolved.query);
  const notice = firstStr(resolved.notice);
  const prefill = query ? await serverLookup(query) : null;

  return (
    <main className="mx-auto max-w-7xl px-4 py-5">
      <div className="w-full space-y-5">
        <header className="rounded-2xl border border-blue-900/50 bg-gradient-to-b from-slate-950/95 to-slate-950/85 p-4 shadow-[0_10px_30px_rgba(0,0,0,0.35)]">
          <h1 className="text-2xl font-extrabold text-slate-100">Submit Report</h1>
          <p className="mt-2 text-sm text-slate-400">
            Report a player with evidence. Use lookup to prefill details when possible.
          </p>
        </header>

        {notice === "report-submitted" ? (
          <div className="rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">
            Report submitted successfully.
          </div>
        ) : null}

        <div className="grid items-start gap-4 lg:grid-cols-[320px_minmax(0,1fr)] xl:grid-cols-[360px_minmax(0,1fr)]">
          <aside className="rounded-2xl border border-blue-900/50 bg-gradient-to-b from-slate-950/95 to-slate-950/85 px-4 py-4 shadow-[0_10px_30px_rgba(0,0,0,0.35)]">
            <h2 className="text-sm font-semibold uppercase tracking-[0.16em] text-slate-300">Target Lookup (Auto-Fill)</h2>
            <p className="mt-2 text-xs text-slate-400">
              This panel only looks up a player and auto-fills the report form on the right.
            </p>
            <form method="GET" className="mt-3 grid gap-3">
              <label className="grid gap-1">
                <span className="text-sm text-slate-300">Username or UUID</span>
                <input
                  name="query"
                  placeholder="Type username or paste UUID"
                  defaultValue={query}
                  className="px-3 py-2 rounded-md border border-blue-900/60 bg-slate-950/80 text-slate-100"
                />
              </label>
              <div className="flex flex-wrap gap-2">
                <button className="rounded-md border border-blue-800/60 bg-blue-950/40 px-4 py-2 text-sm font-semibold text-slate-100 hover:bg-blue-900/50" type="submit">
                  Lookup
                </button>
                {query ? (
                  <a href="/reports/new" className="rounded-md border border-slate-700/80 bg-slate-900/70 px-4 py-2 text-sm font-semibold text-slate-200 hover:bg-slate-800">
                    Reset
                  </a>
                ) : null}
              </div>
            </form>

            <p className="mt-2 text-xs text-slate-500">
              Use Lookup, then review and edit any pre-filled values before submitting.
            </p>

            <div className="mt-4 rounded-xl border border-blue-900/50 bg-slate-950/60 p-3">
              <div className="flex items-start justify-center">
                {prefill?.skinUrl ? (
                  <img
                    src={prefill.skinUrl}
                    alt="Skin preview"
                    className="rounded-xl border border-blue-900/60 bg-slate-950"
                    width={180}
                    height={220}
                  />
                ) : (
                  <div className="h-[220px] w-[180px] rounded-xl border border-blue-900/60 bg-slate-900" />
                )}
              </div>

              <div className="mt-3 space-y-1 text-xs text-slate-400">
                <p><span className="font-semibold text-slate-200">Username:</span> {prefill?.username ?? "—"}</p>
                <p className="break-all"><span className="font-semibold text-slate-200">UUID:</span> {prefill?.uuid ?? "—"}</p>
                {prefill?.guild ? <p><span className="font-semibold text-slate-200">Guild:</span> {prefill.guild}</p> : null}
                {prefill?.rank ? <p><span className="font-semibold text-slate-200">Rank:</span> {prefill.rank}</p> : null}
                {prefill?.nameMcLink ? (
                  <p className="pt-1">
                    <a href={prefill.nameMcLink} target="_blank" rel="noreferrer" className="text-amber-300 underline">
                      View on NameMC
                    </a>
                  </p>
                ) : null}
              </div>
            </div>
          </aside>

          <form
            action={submitReport}
            encType="multipart/form-data"
            className="grid grid-cols-1 gap-4 rounded-2xl border border-blue-900/50 bg-gradient-to-b from-slate-950/95 to-slate-950/85 px-4 py-4 shadow-[0_10px_30px_rgba(0,0,0,0.35)]"
          >
            <section className="grid gap-5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-sm font-semibold uppercase tracking-[0.16em] text-slate-300">Report Details</h2>
                <span className="rounded-md border border-blue-800/50 bg-blue-950/30 px-2 py-1 text-xs text-blue-200">
                  {prefill ? "Auto-filled from lookup" : "Enter details manually or use lookup"}
                </span>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <label className="grid gap-1">
                  <span className="text-sm text-slate-300">Username *</span>
                  <input
                    name="subjectUsername"
                    required
                    defaultValue={prefill?.username ?? query}
                    className="px-3 py-2 rounded-md border border-blue-900/60 bg-slate-950/80 text-slate-100"
                  />
                </label>

                <label className="grid gap-1">
                  <span className="text-sm text-slate-300">UUID (optional)</span>
                  <input
                    name="subjectUuid"
                    defaultValue={prefill?.uuid ?? ""}
                    className="px-3 py-2 rounded-md border border-blue-900/60 bg-slate-950/80 text-slate-100"
                  />
                </label>
              </div>

              <div className="grid gap-4 md:grid-cols-3">
                <label className="grid gap-1">
                  <span className="text-sm text-slate-300">Severity *</span>
                  <select
                    name="severity"
                    defaultValue="medium"
                    className="px-3 py-2 rounded-md border border-blue-900/60 bg-slate-950/80 text-slate-100"
                  >
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                  </select>
                </label>

                <label className="grid gap-1 md:col-span-2">
                  <span className="text-sm text-slate-300">Reason *</span>
                  <input
                    name="reason"
                    required
                    placeholder="Short reason for this report"
                    className="px-3 py-2 rounded-md border border-blue-900/60 bg-slate-950/80 text-slate-100"
                  />
                </label>
              </div>

              <input type="hidden" name="subjectRank" value={prefill?.rank ?? ""} />
              <input type="hidden" name="subjectGuild" value={prefill?.guild ?? ""} />

              <label className="grid gap-1">
                <span className="text-sm text-slate-300">Evidence description *</span>
                <textarea
                  name="evidenceDescription"
                  required
                  rows={6}
                  placeholder="Describe your evidence and timeline"
                  className="px-3 py-2 rounded-md border border-blue-900/60 bg-slate-950/80 text-slate-100"
                />
              </label>
            </section>

          <section className="rounded-2xl border border-blue-900/50 bg-slate-950/55 p-3">
            <h2 className="text-sm font-semibold uppercase tracking-[0.16em] text-amber-200">Evidence (Required)</h2>
            <p className="mt-1 text-xs text-amber-100/80">Add at least one replay ID, video link, or attachment.</p>
            <div className="mt-3">
              <ReportEvidenceFields />
            </div>
          </section>

          {process.env.HCAPTCHA_SITE_KEY ? (
            <div className="mt-2 rounded-xl border border-blue-900/50 bg-slate-950/60 px-3 py-3">
              <HcaptchaField siteKey={process.env.HCAPTCHA_SITE_KEY} />
              <p className="text-xs text-slate-400 mt-2">
                Protected by hCaptcha. The service’s <a href="https://www.hcaptcha.com/privacy" className="underline" target="_blank" rel="noreferrer">Privacy Policy</a> and <a href="https://www.hcaptcha.com/terms" className="underline" target="_blank" rel="noreferrer">Terms of Service</a> apply.
              </p>
            </div>
          ) : null}

          <section className="rounded-xl border border-blue-900/50 bg-slate-900/30 p-3">
            <h2 className="text-sm font-semibold uppercase tracking-[0.16em] text-slate-200">Submit</h2>
            <div className="mt-2 flex gap-2">
              <button className="rounded-md border border-blue-800/60 bg-blue-950/50 px-4 py-2 text-sm font-semibold text-slate-100 hover:bg-blue-900/60">
                Submit Report
              </button>
              <a href="/directory" className="rounded-md border border-slate-700/80 bg-slate-900/70 px-4 py-2 text-sm font-semibold text-slate-200 hover:bg-slate-800">
                Cancel
              </a>
            </div>
          </section>
          </form>
        </div>
      </div>
    </main>
  );
}

import { getServerSession } from "next-auth";
import { authOptions } from "@/auth";
import { redirect } from "next/navigation";
import { upsertEntry } from "./actions";
import MultiSelectDropdown from "./MultiSelectDropdown";
import HcaptchaField from "./HcaptchaField";

/** Options (exact labels) */
const STATUS_OPTIONS = ["Alt","Needs Reviewed","Legit ✅","History","Confirmed Cheater","Teaming"];
const CHEAT_OPTIONS = ["N/A","General Hack Client","ESP / X-Ray","Blinking","Murderer Finder/Callout","Consistent Teaming","Exploiter (Bug Abuse)","Resource Pack/Large Knives Abuse","Other"];
const REDFLAG_OPTIONS = ["Inconclusive","Generally Nice Person","Previously Banned","Doxxer","Catfish","Harasses Others","Pedophile"];

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
      const prof = await fetchJson<{ name: string }>(`https://sessionserver.mojang.com/session/minecraft/profile/${uuidNoDash}`);
      username = prof?.name ?? "";
    } else {
      const prof = await fetchJson<{ id: string; name: string }>(`https://api.mojang.com/users/profiles/minecraft/${encodeURIComponent(q)}`);
      uuidNoDash = prof?.id ?? "";
      username = prof?.name ?? q;
      if (!uuidNoDash) throw new Error("Username not found");
    }
    if (!uuidNoDash) throw new Error("Could not resolve UUID");
    const uuid = addDashes(uuidNoDash);

    let rank: string | null = null;
    let guild: string | null = null;
    const key = process.env.HYPIXEL_API_KEY;
    const headers = key ? { "API-Key": key } : undefined;

    try {
      const player = await fetchJson<any>(`https://api.hypixel.net/player?uuid=${uuidNoDash}`, { headers });
      rank = hypixelRank(player?.player) ?? null;
    } catch {}
    try {
      const guildRes = await fetchJson<any>(`https://api.hypixel.net/guild?player=${uuidNoDash}`, { headers });
      guild = guildRes?.guild?.name ?? null;
    } catch {}

    const skinUrl = `https://mc-heads.net/body/${encodeURIComponent(username)}/200`;
    const headUrl = `https://mc-heads.net/avatar/${encodeURIComponent(username)}/80`;
    const nameMcLink = `https://namemc.com/profile/${encodeURIComponent(uuid)}`;
    return { uuid, username, guild, rank, skinUrl, headUrl, nameMcLink };
  } catch {
    return null;
  }
}
function firstStr(v: string | string[] | undefined) {
  return Array.isArray(v) ? v[0] : v ?? "";
}

export default async function NewEntryPage({
  searchParams,
}: {
  // Next 15.5 types PageProps.searchParams as a Promise<Record<string, string | string[] | undefined>>
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/"); // any logged-in user may submit

  const resolved = (await searchParams) ?? {};
  const query = firstStr(resolved.query);

  const reviewerDefault = session?.user?.name ?? session?.user?.email ?? "";
  const prefill = query ? await serverLookup(query) : null;

  return (
    <main className="min-h-[calc(100vh-3.5rem)] w-full px-4 sm:px-6 lg:px-8 py-6 flex justify-center">
      <div className="w-full max-w-4xl space-y-6">
        <h1 className="text-2xl font-semibold">New / Edit Entry</h1>

        {/* Lookup */}
        <form method="GET" className="rounded-xl border border-white/10 p-4 bg-slate-900/40 flex flex-wrap items-end gap-3">
          <label className="grid gap-1 flex-1 min-w-[260px]">
            <span className="text-sm text-slate-300">UUID or Username</span>
            <input
              name="query"
              placeholder="Paste UUID or type username"
              defaultValue={query}
              className="px-3 py-2 rounded-md bg-slate-800 text-slate-100 border border-white/10"
            />
          </label>
          <button className="px-4 py-2 rounded-md bg-indigo-600 hover:bg-indigo-500 text-white" type="submit">Lookup</button>
          {query && <a href="/entries/new" className="px-4 py-2 rounded-md bg-slate-700 hover:bg-slate-600 text-white">Reset</a>}
          {prefill?.headUrl && <img src={prefill.headUrl} alt="Head" className="w-8 h-8 rounded-md border border-white/10 ml-auto" />}
        </form>

        {/* Save form */}
        <form action={upsertEntry} className="grid grid-cols-1 gap-4 rounded-xl border border-white/10 p-4 bg-slate-900/40">
          <div className="grid sm:grid-cols-[200px,1fr] gap-4">
            <div className="flex items-start justify-center">
              {prefill?.skinUrl ? (
                <img src={prefill.skinUrl} alt="Skin preview" className="rounded-lg border border-white/10" width={160} height={200} />
              ) : (
                <div className="w-[160px] h-[200px] rounded-lg bg-slate-800 border border-white/10" />
              )}
            </div>

            <div className="grid gap-4">
              <label className="grid gap-1">
                <span className="text-sm text-slate-300">UUID *</span>
                <input
                  name="uuid"
                  required
                  defaultValue={prefill?.uuid ?? ""}
                  className="px-3 py-2 rounded-md bg-slate-800 text-slate-100 border border-white/10"
                />
              </label>

              {/* carry the original uuid for edit-mode targeting */}
              <input type="hidden" name="targetUuid" value={prefill?.uuid ?? ""} />

              <label className="grid gap-1">
                <span className="text-sm text-slate-300">Username *</span>
                <input
                  name="username"
                  required
                  defaultValue={prefill?.username ?? ""}
                  className="px-3 py-2 rounded-md bg-slate-800 text-slate-100 border border-white/10"
                />
              </label>

              <div className="grid sm:grid-cols-3 gap-4">
                <label className="grid gap-1">
                  <span className="text-sm text-slate-300">Guild</span>
                  <input name="guild" defaultValue={prefill?.guild ?? ""} className="px-3 py-2 rounded-md bg-slate-800 text-slate-100 border border-white/10" />
                </label>

                <label className="grid gap-1">
                  <span className="text-sm text-slate-300">Status</span>
                  <select name="status" defaultValue="" className="px-3 py-2 rounded-md bg-slate-800 text-slate-100 border border-white/10">
                    <option value="">—</option>
                    {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                </label>

                <label className="grid gap-1">
                  <span className="text-sm text-slate-300">Rank</span>
                  <select name="rank" defaultValue={prefill?.rank ?? ""} className="px-3 py-2 rounded-md bg-slate-800 text-slate-100 border border-white/10">
                    <option value="">—</option>
                    {["MVP++","MVP+","MVP","VIP+","VIP","YOUTUBER","ADMIN","HELPER","Default"].map((r) => <option key={r} value={r}>{r}</option>)}
                  </select>
                </label>
              </div>

              <label className="grid gap-1">
                <span className="text-sm text-slate-300">Reviewer</span>
                <input name="reviewedBy" defaultValue={reviewerDefault} className="px-3 py-2 rounded-md bg-slate-800 text-slate-100 border border-white/10" />
              </label>

              <label className="grid gap-1">
                <span className="text-sm text-slate-300">Notes / Evidence</span>
                <textarea name="notesEvidence" rows={5} className="px-3 py-2 rounded-md bg-slate-800 text-slate-100 border border-white/10" />
              </label>
            </div>
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <MultiSelectDropdown name="typeOfCheating" label="Cheats" options={CHEAT_OPTIONS} />
            <MultiSelectDropdown name="redFlags" label="Red Flags" options={REDFLAG_OPTIONS} />
          </div>

          <div className="grid sm:grid-cols-3 gap-4">
            <label className="grid gap-1">
              <span className="text-sm text-slate-300">Confidence Score (0–5)</span>
              <input name="confidenceScore" type="number" min={0} max={5} className="px-3 py-2 rounded-md bg-slate-800 text-slate-100 border border-white/10" />
            </label>
            <label className="grid gap-1">
              <span className="text-sm text-slate-300">Last Updated (YYYY-MM-DD)</span>
              <input name="lastUpdated" placeholder="2025-09-13" className="px-3 py-2 rounded-md bg-slate-800 text-slate-100 border border-white/10" />
            </label>
            <label className="grid gap-1">
              <span className="text-sm text-slate-300">NameMC Link</span>
              <input name="nameMcLink" defaultValue={prefill?.nameMcLink ?? ""} className="px-3 py-2 rounded-md bg-slate-800 text-slate-100 border border-white/10" />
            </label>
          </div>

          {/* hCaptcha (required for USERs) */}
          {process.env.HCAPTCHA_SITE_KEY ? (
            <div className="mt-2">
              <HcaptchaField siteKey={process.env.HCAPTCHA_SITE_KEY} />
              <p className="text-xs text-slate-400 mt-1">
                Protected by hCaptcha. The service’s{" "}
                <a href="https://www.hcaptcha.com/privacy" className="underline" target="_blank" rel="noreferrer">Privacy Policy</a>{" "}
                and{" "}
                <a href="https://www.hcaptcha.com/terms" className="underline" target="_blank" rel="noreferrer">Terms of Service</a>{" "}
                apply.
              </p>
            </div>
          ) : (
            <div className="text-amber-400 text-sm">Missing <code>HCAPTCHA_SITE_KEY</code> in .env</div>
          )}

          <div className="flex gap-2">
            <button className="px-4 py-2 rounded-md bg-emerald-600 hover:bg-emerald-500 text-white">Save</button>
            <a href="/directory" className="px-4 py-2 rounded-md bg-slate-700 hover:bg-slate-600 text-white">Cancel</a>
          </div>
        </form>
      </div>
    </main>
  );
}

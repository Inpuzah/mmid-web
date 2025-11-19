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

    // Use a 3D bust for the main preview and a head avatar for small icon
    const skinUrl = `https://visage.surgeplay.com/bust/256/${encodeURIComponent(username)}.png`;
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

  // Local dev helper: allow viewing the page without Discord sign-in
  const devBypass = !session && process.env.NEXT_PUBLIC_DEV_AUTH_BYPASS === "1";
  if (!session && !devBypass) redirect("/"); // any logged-in user may submit

  const resolved = (await searchParams) ?? {};
  const query = firstStr(resolved.query);

  const reviewerDefault =
    session?.user?.name ??
    session?.user?.email ??
    (devBypass ? "Local Dev" : "");
  const prefill = query ? await serverLookup(query) : null;

  return (
    <main className="min-h-[calc(100vh-4rem)] w-full px-4 sm:px-6 lg:px-8 py-6 flex justify-center">
      <div className="w-full max-w-5xl space-y-5">
        <h1 className="text-xl font-extrabold tracking-[0.18em] uppercase text-yellow-200 drop-shadow-[0_0_6px_rgba(0,0,0,0.9)]">
          New / Edit Entry
        </h1>

        {/* Lookup */}
        <form method="GET" className="rounded-[4px] border-2 border-black/80 bg-slate-950/85 px-4 py-4 flex flex-wrap items-end gap-3 shadow-[0_0_0_1px_rgba(0,0,0,0.9),0_6px_0_0_rgba(0,0,0,0.9)]">
          <label className="grid gap-1 flex-1 min-w-[260px]">
            <span className="text-sm text-slate-300">UUID or Username</span>
            <input
              name="query"
              placeholder="Paste UUID or type username"
              defaultValue={query}
              className="px-3 py-2 rounded-[3px] border-2 border-black/80 bg-slate-950/80 text-slate-100 shadow-[0_0_0_1px_rgba(0,0,0,0.85)]"
            />
          </label>
          <button className="px-4 py-2 rounded-[3px] border-2 border-black/80 bg-emerald-500 hover:brightness-110 text-black shadow-[0_0_0_1px_rgba(0,0,0,0.9),0_4px_0_0_rgba(0,0,0,0.9)]" type="submit">Lookup</button>
          {query && <a href="/entries/new" className="px-4 py-2 rounded-[3px] border-2 border-black/80 bg-slate-800 hover:bg-slate-700 text-slate-100 shadow-[0_0_0_1px_rgba(0,0,0,0.9),0_4px_0_0_rgba(0,0,0,0.9)]">Reset</a>}
          {prefill?.headUrl && <img src={prefill.headUrl} alt="Head" className="w-8 h-8 rounded-[3px] border-2 border-black/80 bg-slate-950 ml-auto" />}
        </form>

        {/* Save form */}
        <form
          action={upsertEntry}
          className="grid grid-cols-1 gap-4 rounded-[4px] border-2 border-black/80 px-4 py-4 bg-slate-950/85 shadow-[0_0_0_1px_rgba(0,0,0,0.9),0_10px_0_0_rgba(0,0,0,0.9)]"
        >
          {/* Main layout: skinny left rail for the render, wide right rail for all inputs */}
          <div className="grid gap-6 md:grid-cols-[220px,minmax(0,1fr)] lg:grid-cols-[260px,minmax(0,1fr)] items-start">
            {/* Left: skin render + quick identity summary */}
            <div className="space-y-4">
              <div className="flex items-start justify-center">
                {prefill?.skinUrl ? (
                  <img
                    src={prefill.skinUrl}
                    alt="Skin preview"
                    className="rounded-[3px] border-2 border-black/80 bg-slate-950 shadow-[0_0_0_1px_rgba(0,0,0,0.9)]"
                    width={180}
                    height={220}
                  />
                ) : (
                  <div className="w-[180px] h-[220px] rounded-[3px] bg-slate-900 border-2 border-black/80 shadow-[0_0_0_1px_rgba(0,0,0,0.9)]" />
                )}
              </div>

              <div className="space-y-1 text-xs text-slate-400">
                {prefill?.username && (
                  <p>
                    <span className="font-semibold text-slate-200">Username:</span> {prefill.username}
                  </p>
                )}
                {prefill?.uuid && (
                  <p className="break-all">
                    <span className="font-semibold text-slate-200">UUID:</span> {prefill.uuid}
                  </p>
                )}
                {prefill?.guild && (
                  <p>
                    <span className="font-semibold text-slate-200">Guild:</span> {prefill.guild}
                  </p>
                )}
                {prefill?.rank && (
                  <p>
                    <span className="font-semibold text-slate-200">Rank:</span> {prefill.rank}
                  </p>
                )}
                {prefill?.nameMcLink && (
                  <p className="pt-1">
                    <a
                      href={prefill.nameMcLink}
                      target="_blank"
                      rel="noreferrer"
                      className="text-amber-300 underline"
                    >
                      View on NameMC
                    </a>
                  </p>
                )}
              </div>
            </div>

            {/* Right: all editable fields */}
            <div className="grid gap-5">
              {/* Core identity */}
              <div className="grid gap-4 md:grid-cols-2">
                <label className="grid gap-1">
                  <span className="text-sm text-slate-300">UUID *</span>
                  <input
                    name="uuid"
                    required
                    defaultValue={prefill?.uuid ?? ""}
                    className="px-3 py-2 rounded-[3px] border-2 border-black/80 bg-slate-950/80 text-slate-100 shadow-[0_0_0_1px_rgba(0,0,0,0.85)]"
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
                    className="px-3 py-2 rounded-[3px] border-2 border-black/80 bg-slate-950/80 text-slate-100 shadow-[0_0_0_1px_rgba(0,0,0,0.85)]"
                  />
                </label>
              </div>

              {/* Guild / status / rank */}
              <div className="grid gap-4 md:grid-cols-3">
                <label className="grid gap-1">
                  <span className="text-sm text-slate-300">Guild</span>
                  <input
                    name="guild"
                    defaultValue={prefill?.guild ?? ""}
                    className="px-3 py-2 rounded-[3px] border-2 border-black/80 bg-slate-950/80 text-slate-100 shadow-[0_0_0_1px_rgba(0,0,0,0.85)]"
                  />
                </label>

                <label className="grid gap-1">
                  <span className="text-sm text-slate-300">Status</span>
                  <select
                    name="status"
                    defaultValue=""
                    className="px-3 py-2 rounded-[3px] border-2 border-black/80 bg-slate-950/80 text-slate-100 shadow-[0_0_0_1px_rgba(0,0,0,0.85)]"
                  >
                    <option value="">—</option>
                    {STATUS_OPTIONS.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="grid gap-1">
                  <span className="text-sm text-slate-300">Rank</span>
                  <select
                    name="rank"
                    defaultValue={prefill?.rank ?? ""}
                    className="px-3 py-2 rounded-[3px] border-2 border-black/80 bg-slate-950/80 text-slate-100 shadow-[0_0_0_1px_rgba(0,0,0,0.85)]"
                  >
                    <option value="">—</option>
                    {["MVP++", "MVP+", "MVP", "VIP+", "VIP", "YOUTUBER", "ADMIN", "HELPER", "Default"].map((r) => (
                      <option key={r} value={r}>
                        {r}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              {/* Reviewer + meta */}
              <div className="grid gap-4 md:grid-cols-3">
                <label className="grid gap-1 md:col-span-1">
                  <span className="text-sm text-slate-300">Reviewer</span>
                  <input
                    name="reviewedBy"
                    defaultValue={reviewerDefault}
                    className="px-3 py-2 rounded-[3px] border-2 border-black/80 bg-slate-950/80 text-slate-100 shadow-[0_0_0_1px_rgba(0,0,0,0.85)]"
                  />
                </label>

                <label className="grid gap-1">
                  <span className="text-sm text-slate-300">Confidence Score (0–5)</span>
                  <input
                    name="confidenceScore"
                    type="number"
                    min={0}
                    max={5}
                    className="px-3 py-2 rounded-[3px] border-2 border-black/80 bg-slate-950/80 text-slate-100 shadow-[0_0_0_1px_rgba(0,0,0,0.85)]"
                  />
                </label>

                <label className="grid gap-1">
                  <span className="text-sm text-slate-300">Last Updated (YYYY-MM-DD)</span>
                  <input
                    name="lastUpdated"
                    placeholder="2025-09-13"
                    className="px-3 py-2 rounded-[3px] border-2 border-black/80 bg-slate-950/80 text-slate-100 shadow-[0_0_0_1px_rgba(0,0,0,0.85)]"
                  />
                </label>
              </div>

              <label className="grid gap-1">
                <span className="text-sm text-slate-300">NameMC Link</span>
                <input
                  name="nameMcLink"
                  defaultValue={prefill?.nameMcLink ?? ""}
                  className="px-3 py-2 rounded-[3px] border-2 border-black/80 bg-slate-950/80 text-slate-100 shadow-[0_0_0_1px_rgba(0,0,0,0.85)]"
                />
              </label>

              {/* Cheats / red flags */}
              <div className="grid gap-4 md:grid-cols-2">
                <MultiSelectDropdown name="typeOfCheating" label="Cheats" options={CHEAT_OPTIONS} />
                <MultiSelectDropdown name="redFlags" label="Red Flags" options={REDFLAG_OPTIONS} />
              </div>
            </div>
          </div>

          {/* Full-width evidence box under both columns */}
          <label className="grid gap-1">
            <span className="text-sm text-slate-300">Notes / Evidence</span>
            <textarea
              name="notesEvidence"
              rows={7}
              className="px-3 py-2 rounded-[3px] border-2 border-black/80 bg-slate-950/80 text-slate-100 shadow-[0_0_0_1px_rgba(0,0,0,0.85)]"
            />
          </label>

          {/* hCaptcha (required for USERs) */}
          {process.env.HCAPTCHA_SITE_KEY ? (
            <div className="mt-2 rounded-[3px] border border-slate-700/70 bg-slate-950/70 px-3 py-3">
              <HcaptchaField siteKey={process.env.HCAPTCHA_SITE_KEY} />
              <p className="text-xs text-slate-400 mt-2">
                Protected by hCaptcha. The service’s{" "}
                <a href="https://www.hcaptcha.com/privacy" className="underline" target="_blank" rel="noreferrer">Privacy Policy</a>{" "}
                and{" "}
                <a href="https://www.hcaptcha.com/terms" className="underline" target="_blank" rel="noreferrer">Terms of Service</a>{" "}
                apply.
              </p>
            </div>
          ) : (
            <div className="rounded-[3px] border border-amber-500/70 bg-amber-950/60 px-3 py-2 text-amber-200 text-sm">
              Missing <code>HCAPTCHA_SITE_KEY</code> in .env
            </div>
          )}

          <div className="flex gap-2">
            <button className="px-4 py-2 rounded-[3px] border-2 border-black/80 bg-emerald-500 hover:brightness-110 text-black shadow-[0_0_0_1px_rgba(0,0,0,0.9),0_4px_0_0_rgba(0,0,0,0.9)]">Save</button>
            <a href="/directory" className="px-4 py-2 rounded-[3px] border-2 border-black/80 bg-slate-800 hover:bg-slate-700 text-slate-100 shadow-[0_0_0_1px_rgba(0,0,0,0.9),0_4px_0_0_rgba(0,0,0,0.9)]">Cancel</a>
          </div>
        </form>
      </div>
    </main>
  );
}

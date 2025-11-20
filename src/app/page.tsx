import MinecraftSkin from "@/components/MinecraftSkin";
import { prisma } from "@/lib/prisma";
import HomeSearch from "./_components/HomeSearch";

export default async function Page() {
  // All colors lean into dark purple + orange accents to match the logo.
  const STAFF = [
    { name: "Inpuzah", id: "Inpuzah", role: "Founder of MMID & Directory Developer", render: "archer" },
    { name: "Dreqd", id: "58115bf5f86f4b2bbc27585eee04c923", role: "Maintainer", render: "marching" },
    { name: "Nolant", id: "1652dea3008a46b1afbcaa94790762a5", role: "Maintainer", render: "pointing" },
    { name: "MayIAxe", id: "9d0be08bddc64c6da5efefc33175b953", role: "Maintainer", render: "kicking" },
    { name: "MayILag", id: "f7b61e3709704dabb57b24c779894ca9", role: "Maintainer", render: "reading" },
    { name: "twistlight", id: "dff44685335d4afaaea703ed715f2225", role: "Maintainer", render: "crossed" },
  ];

  // Contributors (replay officers, tooling, Discord integrations)
  const CONTRIBUTORS = [
    { name: "moorax", id: "fe95330659b141339d2998d9ad732737", role: "Replay Officer", render: "idle" },
    { name: "Aiim", id: "e8c6f2817616449c9626a6700f0fd032", role: "Replay Officer", render: "idle" },
    { name: "NotKaan", id: "28860dad975c4d0594dff6b2674f9a43", role: "Replay Officer", render: "idle" },
    { name: "_Merrit", id: "1a6049b9e1c44ab1a866e3e24d38e6a4", role: "Replay Officer", render: "idle" },
    { name: "odeloten", id: "odeloten", role: "Discord bot integrations", render: "idle" },
  ];

  const entriesCount = await prisma.mmidEntry.count();
  const entriesLabel = new Intl.NumberFormat("en-US").format(entriesCount);

  return (
    <main className="relative min-h-screen w-full overflow-hidden text-foreground">
      {/* HERO (no extra header here — the layout already renders SiteHeader) */}
      <section className="relative mx-auto w-full max-w-6xl px-5 py-12 sm:py-16 md:py-24">
        <div className="rounded border-2 border-border bg-[radial-gradient(circle_at_top,#1e1030_0%,#050208_72%)] px-6 py-6 shadow-[0_0_0_1px_rgba(0,0,0,0.9),0_10px_0_0_rgba(0,0,0,0.9)]">
          <div className="mb-4 inline-flex items-center gap-2 rounded border border-white/10 bg-white/5 px-3 py-1 text-[11px] text-slate-100/80 tracking-[0.16em] uppercase backdrop-blur">
            <span className="inline-block h-2 w-2 rounded bg-[#ff7a1a]" />
            Skyza · MMID
            <span className="rounded bg-[#b0144f]/20 px-2 py-0.5 text-[10px] text-[#ffb15a]">Community Beta</span>
            <span className="rounded bg-[#b0144f]/20 px-2 py-0.5 text-[10px] text-[#ffb15a]">b2.0.10</span>
          </div>

          <div className="mb-3">
            <h1 className="text-2xl font-semibold text-slate-50">MMID · Skyza Murder Mystery Integrity Directory</h1>
            <p className="mt-1 text-sm text-slate-300">
              MMID began as a Skyza guild project focused on catching and documenting cheaters in
              Hypixel Murder Mystery, linked to one of the largest guild networks on the server.
            </p>
          </div>

          <h1 className="text-balance text-4xl font-extrabold leading-[1.05] tracking-tight text-slate-50 sm:text-6xl">
            <span className="block">Holding Murder Mystery Accountable</span>
            <span className="mt-1 block bg-gradient-to-r from-yellow-400 via-amber-300 to-orange-400 bg-clip-text text-transparent">
              Because Hypixel won't.
            </span>
          </h1>

          <p className="mt-5 max-w-2xl text-pretty text-base leading-relaxed text-slate-200 sm:text-lg">
            MMID started as a way for Skyza players to keep track of cheaters and patterns in Murder Mystery
            and has grown into a shared integrity directory for the wider community.
            Browse entries, share context, and help keep lobbies honest across guilds and parties.
          </p>

          <HomeSearch />

          <div className="mt-6 flex flex-wrap items-center gap-3">
            <a
              href="/directory"
              className="inline-flex items-center gap-2 rounded border-2 border-black/80 bg-[#ff7a1a] px-4 py-2 font-semibold text-black shadow-[0_0_0_1px_rgba(0,0,0,0.9),0_6px_0_0_rgba(0,0,0,0.9)] transition hover:brightness-110"
            >
              Open the Directory
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" className="opacity-90"><path d="M13 5l7 7-7 7" stroke="currentColor" strokeWidth="2"/><path d="M20 12H4" stroke="currentColor" strokeWidth="2"/></svg>
            </a>
            <a
              href="#team"
              className="inline-flex items-center gap-2 rounded border-2 border-black/80 bg-[#b0144f] px-4 py-2 text-sm font-semibold text-white shadow-[0_0_0_1px_rgba(0,0,0,0.9),0_6px_0_0_rgba(0,0,0,0.9)] transition hover:brightness-110"
            >
              Meet the Team
            </a>
            <a
              href="https://discord.gg/Qf6k296bQ9"
              target="_blank"
              className="inline-flex items-center gap-2 rounded border-2 border-black/80 bg-[#4f46e5] px-4 py-2 text-sm font-semibold text-white shadow-[0_0_0_1px_rgba(0,0,0,0.9),0_6px_0_0_rgba(0,0,0,0.9)] transition hover:brightness-110"
            >
              Join Discord
            </a>
          </div>

        {/* Stats */}
        <div className="mt-10 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            { k: entriesLabel, s: "players in the directory" },
            { k: "Community", s: "reviewed by players and staff" },
            { k: "API", s: "in development" },
            { k: "Live", s: "syncs and manual reviews" },
          ].map((t) => (
            <div
              key={t.k + t.s}
              className="rounded border-2 border-border bg-[#090316] p-4 text-center shadow-[0_0_0_1px_rgba(0,0,0,0.9),0_6px_0_0_rgba(0,0,0,0.9)]"
            >
              <div className="text-xl font-semibold text-slate-50">{t.k}</div>
              <div className="text-xs uppercase tracking-[0.18em] text-slate-400">{t.s}</div>
            </div>
          ))}
        </div>
      </div>
      </section>

      {/* TEAM */}
      <section id="team" className="relative mx-auto w-full max-w-6xl px-5 pb-24">
        <div className="mb-6 flex items-center gap-2">
          <div className="h-6 w-1 bg-[#ff7a1a]" />
          <h2 className="text-2xl font-semibold">Maintainers & Staff</h2>
        </div>

        {STAFF.length > 0 && (
          <div className="mb-10 grid grid-cols-1 gap-6 sm:grid-cols-2 md:grid-cols-3">
            {STAFF.map((m) => (
              <article
                key={m.name}
                className="group overflow-hidden rounded border-2 border-border bg-[#090316] shadow-[0_0_0_1px_rgba(0,0,0,0.9),0_8px_0_0_rgba(0,0,0,0.9)]"
              >
                <div className="relative aspect-[3/4] w-full">
                  <MinecraftSkin id={m.id} name={m.name} pose={m.render} className="absolute inset-0 h-full w-full" />
                  <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 to-transparent p-4">
                    <div className="text-base font-semibold">{m.name}</div>
                    <div className="text-xs text-white/75">{m.role}</div>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}

        {/* Contributors */}
        <div className="mb-6 mt-2 flex items-center gap-2">
          <div className="h-6 w-1 bg-[#b0144f]" />
          <h3 className="text-xl font-semibold">Contributors</h3>
        </div>
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 md:grid-cols-4">
          {CONTRIBUTORS.map((c) => (
            <article
              key={c.id}
              className="group overflow-hidden rounded border-2 border-border bg-[#090316] shadow-[0_0_0_1px_rgba(0,0,0,0.9),0_8px_0_0_rgba(0,0,0,0.9)]"
            >
              <div className="relative aspect-[3/4] w-full">
                <MinecraftSkin id={c.id} name={c.name} pose={c.render} className="absolute inset-0 h-full w-full" />
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 to-transparent p-4">
                  <div className="text-base font-semibold">{c.name}</div>
                  <div className="text-xs text-white/75">{c.role}</div>
                </div>
              </div>
            </article>
          ))}
        </div>

        {/* CTA */}
        <div className="mt-4 flex flex-wrap items-center justify-between gap-4 rounded border-2 border-border bg-gradient-to-r from-[#1e1030] via-[#090316] to-[#050208] p-5 shadow-[0_0_0_1px_rgba(0,0,0,0.9),0_8px_0_0_rgba(0,0,0,0.9)]">
          <div>
            <div className="text-lg font-semibold">Help maintain the directory</div>
            <div className="text-sm text-white/60">
              Sign in with Discord to share evidence, context, and corrections so MMID can stay accurate.
            </div>
          </div>
          <a
            href="/directory"
            className="inline-flex items-center gap-2 rounded border-2 border-black/80 bg-[#ff7a1a]/90 px-4 py-2 font-semibold text-black shadow-[0_0_0_1px_rgba(0,0,0,0.9),0_6px_0_0_rgba(0,0,0,0.9)] hover:brightness-110"
          >
            Go to Directory
          </a>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="relative mx-auto w-full max-w-5xl px-5 pb-24">
        <h2 className="mb-6 text-2xl font-semibold">FAQ</h2>
        <div className="space-y-3">
          <details className="group rounded border-2 border-border bg-[#090316] p-4 shadow-[0_0_0_1px_rgba(0,0,0,0.9),0_6px_0_0_rgba(0,0,0,0.9)] [&_summary]:cursor-pointer">
            <summary className="flex items-center justify-between text-base font-medium text-white/90">Is MMID official or affiliated with Hypixel?<span className="text-white/40">▾</span></summary>
            <p className="mt-2 text-sm text-white/70">No. MMID is a community-run resource with an independent review process.</p>
          </details>
          <details className="group rounded border-2 border-border bg-[#090316] p-4 shadow-[0_0_0_1px_rgba(0,0,0,0.9),0_6px_0_0_rgba(0,0,0,0.9)] [&_summary]:cursor-pointer">
            <summary className="flex items-center justify-between text-base font-medium text-white/90">How do I request a correction?<span className="text-white/40">▾</span></summary>
            <p className="mt-2 text-sm text-white/70">Use the submission link inside an entry or contact a maintainer with your evidence and context.</p>
          </details>
          <details className="group rounded border-2 border-border bg-[#090316] p-4 shadow-[0_0_0_1px_rgba(0,0,0,0.9),0_6px_0_0_rgba(0,0,0,0.9)] [&_summary]:cursor-pointer">
            <summary className="flex items-center justify-between text-base font-medium text-white/90">Does listing equal punishment?<span className="text-white/40">▾</span></summary>
            <p className="mt-2 text-sm text-white/70">No. The directory is informational; it helps communities self‑moderate with transparent context.</p>
          </details>
          <details className="group rounded border-2 border-border bg-[#090316] p-4 shadow-[0_0_0_1px_rgba(0,0,0,0.9),0_6px_0_0_rgba(0,0,0,0.9)] [&_summary]:cursor-pointer">
            <summary className="flex items-center justify-between text-base font-medium text-white/90">Can I contribute?<span className="text-white/40">▾</span></summary>
            <p className="mt-2 text-sm text-white/70">Yes — evidence helps. Join our Discord to learn how reports are evaluated and how to help review. <a className="underline decoration-[#ff7a1a]/60 underline-offset-2" href="https://discord.gg/Qf6k296bQ9" target="_blank">Join Skyza Discord</a>.</p>
          </details>
        </div>
      </section>
    </main>
  );
}

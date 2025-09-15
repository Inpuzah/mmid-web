import MinecraftSkin from "@/components/MinecraftSkin";

export default function Page() {
  // All colors lean into dark purple + orange accents to match the logo.
  const STAFF = [
    { name: "Inpuzah", id: "Inpuzah", role: "Founder of MMID & Directory Developer", render: "archer" },
    { name: "Dreqd", id: "58115bf5f86f4b2bbc27585eee04c923", role: "Maintainer", render: "marching" },
    { name: "Nolant", id: "1652dea3008a46b1afbcaa94790762a5", role: "Maintainer", render: "pointing" },
    { name: "MayIAxe", id: "9d0be08bddc64c6da5efefc33175b953", role: "Maintainer", render: "kicking" },
    { name: "MayILag", id: "f7b61e3709704dabb57b24c779894ca9", role: "Maintainer", render: "reading" },
    { name: "twistlight", id: "dff44685335d4afaaea703ed715f2225", role: "Maintainer", render: "crossed" },
  ];

  // Contributors (replay officers)
  const CONTRIBUTORS = [
    { name: "moorax", id: "fe95330659b141339d2998d9ad732737", role: "Replay Officer", render: "idle" },
    { name: "Aiim", id: "e8c6f2817616449c9626a6700f0fd032", role: "Replay Officer", render: "idle" },
    { name: "NotKaan", id: "28860dad975c4d0594dff6b2674f9a43", role: "Replay Officer", render: "idle" },
    { name: "_Merrit", id: "1a6049b9e1c44ab1a866e3e24d38e6a4", role: "Replay Officer", render: "idle" },
  ];

  return (
    <main className="relative min-h-screen w-full overflow-hidden bg-[#0b0710] text-slate-100">
      {/* BACKDROP: deep purple -> black with orange glow accents */}
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute inset-0 bg-[radial-gradient(1200px_600px_at_10%_-10%,#7b2cbf15,transparent_60%),radial-gradient(900px_500px_at_90%_10%,#ff7a1a20,transparent_60%),radial-gradient(900px_500px_at_50%_110%,#b0144f20,transparent_60%)]" />
        <div className="absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-black/40 to-transparent"/>
      </div>

      {/* HERO (no extra header here — the layout already renders SiteHeader) */}
      <section className="relative mx-auto w-full max-w-6xl px-5 py-12 sm:py-16 md:py-24">
        <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-white/80 backdrop-blur">
          <span className="inline-block h-2 w-2 rounded-full bg-[#ff7a1a]" />
          Skyza · MMID
          <span className="rounded-full bg-[#b0144f]/20 px-2 py-0.5 text-[10px] text-[#ffb15a]">Community Beta</span>
          <span className="rounded-full bg-[#b0144f]/20 px-2 py-0.5 text-[10px] text-[#ffb15a]">b2.0.10</span>
        </div>
        <div className="mb-3">
          <h1 className="text-2xl font-semibold text-white/95">Murder Mystery Integrity Directory</h1>
          <p className="mt-1 text-sm text-white/70">developed by Inpuzah. Maintained with love by the <a className="underline decoration-[#ff7a1a]/60 underline-offset-2 hover:text-white" href="https://discord.gg/bddeG7HyAx" target="_blank">Murder Mystery Oasis guild</a>.</p>
        </div>

        <h1 className="text-balance text-4xl font-extrabold leading-[1.05] tracking-tight sm:text-6xl">
          <span className="text-white/95">Fair Play. Transparent Records.</span>
          <br />
          <span className="bg-gradient-to-r from-[#ff7a1a] via-[#ff9e42] to-[#b0144f] bg-clip-text text-transparent">
            Community‑Driven.
          </span>
        </h1>

        <p className="mt-5 max-w-2xl text-pretty text-base leading-relaxed text-white/70 sm:text-lg">
          MMID is a community effort to document behavior patterns in Hypixel Murder Mystery.
          Browse the directory, submit proposals, and help keep games fun and fair.
        </p>

        <div className="mt-8 flex flex-wrap items-center gap-3">
          <a
            href="/directory"
            className="inline-flex items-center gap-2 rounded-xl border border-[#ff7a1a]/50 bg-[#ff7a1a] px-4 py-2 font-medium text-black shadow-[0_8px_30px_rgba(255,122,26,.25)] transition hover:brightness-110"
          >
            Open the Directory
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" className="opacity-90"><path d="M13 5l7 7-7 7" stroke="currentColor" strokeWidth="2"/><path d="M20 12H4" stroke="currentColor" strokeWidth="2"/></svg>
          </a>
          <a
            href="#team"
            className="inline-flex items-center gap-2 rounded-xl border border-white/15 bg-white/5 px-4 py-2 font-medium text-white/90 hover:bg-white/10"
          >
            Meet the Team
          </a>
          <a
            href="https://discord.gg/Qf6k296bQ9"
            target="_blank"
            className="inline-flex items-center gap-2 rounded-xl border border-white/15 bg-white/5 px-4 py-2 font-medium text-white/90 hover:bg-white/10"
          >
            Join Discord
          </a>
        </div>

        {/* Stats */}
        <div className="mt-10 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            { k: "> 1,300", s: "entries" },
            { k: "Most", s: "accurate directory" },
            { k: "API", s: "support" },
            { k: "Live", s: "sync & reviews" },
          ].map((t) => (
            <div
              key={t.k + t.s}
              className="rounded-2xl border border-white/10 bg-black/20 p-4 text-center backdrop-blur"
            >
              <div className="text-xl font-semibold text-white/90">{t.k}</div>
              <div className="text-xs uppercase tracking-wide text-white/50">{t.s}</div>
            </div>
          ))}
        </div>
      </section>

      {/* TEAM */}
      <section id="team" className="relative mx-auto w-full max-w-6xl px-5 pb-24">
        <div className="mb-6 flex items-center gap-2">
          <div className="h-6 w-1 rounded-full bg-[#ff7a1a]" />
          <h2 className="text-2xl font-semibold">Maintainers & Staff</h2>
        </div>

        {STAFF.length > 0 && (
          <>
            {/* Featured row (full width) */}
            <article className="relative mb-10 overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-r from-[#130718] via-[#0b0710] to-[#130718] shadow-[inset_0_1px_0_rgba(255,255,255,.05)]">
              {/* decorative soft glows behind the content */}
              <div className="pointer-events-none absolute inset-0 -z-10">
                <div className="absolute -inset-20 bg-[radial-gradient(700px_350px_at_15%_60%,#ff7a1a22,transparent_60%),radial-gradient(700px_350px_at_85%_35%,#b0144f26,transparent_65%)]" />
              </div>

              <div className="grid grid-cols-1 items-stretch gap-0 sm:grid-cols-2">
                {/* render area */}
                <div className="relative h-[320px] sm:h-[380px] md:h-[460px]">
                  <MinecraftSkin
                    id={STAFF[0].id}
                    name={STAFF[0].name}
                    pose={STAFF[0].render}
                    className="absolute inset-0 h-full w-full"
                  />
                  <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent"/>
                </div>
                {/* text area */}
                <div className="flex flex-col justify-center gap-3 p-6">
                  <div className="inline-flex w-fit items-center gap-2 rounded-full border border-[#ff7a1a]/30 bg-[#ff7a1a]/10 px-3 py-1 text-xs text-[#ffb15a]">
                    Developer
                  </div>
                  <h3 className="text-2xl font-semibold leading-tight">{STAFF[0].name}</h3>
                  <p className="text-sm text-white/80">{STAFF[0].role}</p>
                </div>
              </div>
            </article>

            {/* Everyone else in a separate grid row */}
            <div className="mb-10 grid grid-cols-1 gap-6 sm:grid-cols-2 md:grid-cols-3">
              {STAFF.slice(1).map((m) => (
                <article
                  key={m.name}
                  className="group overflow-hidden rounded-2xl border border-white/10 bg-white/5 shadow-[inset_0_1px_0_rgba(255,255,255,.05)]"
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
          </>
        )}

        {/* Contributors */}
        <div className="mb-6 mt-2 flex items-center gap-2">
          <div className="h-6 w-1 rounded-full bg-[#b0144f]" />
          <h3 className="text-xl font-semibold">Contributors</h3>
        </div>
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 md:grid-cols-4">
          {CONTRIBUTORS.map((c) => (
            <article
              key={c.id}
              className="group overflow-hidden rounded-2xl border border-white/10 bg-white/5 shadow-[inset_0_1px_0_rgba(255,255,255,.05)]"
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
        <div className="mt-4 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-white/10 bg-gradient-to-r from-[#130718] to-[#0b0710] p-5">
          <div>
            <div className="text-lg font-semibold">Help maintain the directory</div>
            <div className="text-sm text-white/60">Sign in with Discord to submit proposals and improvements.</div>
          </div>
          <a
            href="/directory"
            className="inline-flex items-center gap-2 rounded-xl border border-[#ff7a1a]/40 bg-[#ff7a1a]/90 px-4 py-2 font-medium text-black shadow-[0_8px_30px_rgba(255,122,26,.25)] hover:brightness-110"
          >
            Go to Directory
          </a>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="relative mx-auto w-full max-w-5xl px-5 pb-24">
        <h2 className="mb-6 text-2xl font-semibold">FAQ</h2>
        <div className="space-y-3">
          <details className="group rounded-2xl border border-white/10 bg-white/5 p-4 [&_summary]:cursor-pointer">
            <summary className="flex items-center justify-between text-base font-medium text-white/90">Is MMID official or affiliated with Hypixel?<span className="text-white/40">▾</span></summary>
            <p className="mt-2 text-sm text-white/70">No. MMID is a community-run resource with an independent review process.</p>
          </details>
          <details className="group rounded-2xl border border-white/10 bg-white/5 p-4 [&_summary]:cursor-pointer">
            <summary className="flex items-center justify-between text-base font-medium text-white/90">How do I request a correction?<span className="text-white/40">▾</span></summary>
            <p className="mt-2 text-sm text-white/70">Use the submission link inside an entry or contact a maintainer with your evidence and context.</p>
          </details>
          <details className="group rounded-2xl border border-white/10 bg-white/5 p-4 [&_summary]:cursor-pointer">
            <summary className="flex items-center justify-between text-base font-medium text-white/90">Does listing equal punishment?<span className="text-white/40">▾</span></summary>
            <p className="mt-2 text-sm text-white/70">No. The directory is informational; it helps communities self‑moderate with transparent context.</p>
          </details>
          <details className="group rounded-2xl border border-white/10 bg-white/5 p-4 [&_summary]:cursor-pointer">
            <summary className="flex items-center justify-between text-base font-medium text-white/90">Can I contribute?<span className="text-white/40">▾</span></summary>
            <p className="mt-2 text-sm text-white/70">Yes — evidence helps. Join our Discord to learn how reports are evaluated and how to help review. <a className="underline decoration-[#ff7a1a]/60 underline-offset-2" href="https://discord.gg/Qf6k296bQ9" target="_blank">Join Skyza Discord</a>.</p>
          </details>
        </div>
      </section>
    </main>
  );
}

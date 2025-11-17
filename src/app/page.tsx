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
            <h1 className="text-2xl font-semibold text-slate-50">Murder Mystery Integrity Directory</h1>
            <p className="mt-1 text-sm text-slate-300">
              developed by Inpuzah. Maintained with love by the{" "}
              <a
                className="underline decoration-yellow-400/70 underline-offset-2 hover:text-yellow-300"
                href="https://discord.gg/bddeG7HyAx"
                target="_blank"
              >
                Murder Mystery Oasis guild
              </a>
              .
            </p>
          </div>

          <h1 className="text-balance text-4xl font-extrabold leading-[1.05] tracking-tight text-slate-50 sm:text-6xl">
            <span className="block">Fair Play. Transparent Records.</span>
            <span className="mt-1 block bg-gradient-to-r from-yellow-400 via-amber-300 to-orange-400 bg-clip-text text-transparent">
              Community‑Driven.
            </span>
          </h1>

          <p className="mt-5 max-w-2xl text-pretty text-base leading-relaxed text-slate-200 sm:text-lg">
            MMID is a community effort to document behavior patterns in Hypixel Murder Mystery.
            Browse the directory, submit proposals, and help keep games fun and fair.
          </p>

          <div className="mt-8 flex flex-wrap items-center gap-3">
          <a
            href="/directory"
            className="inline-flex items-center gap-2 rounded border-2 border-black/80 bg-[#ff7a1a] px-4 py-2 font-semibold text-black shadow-[0_0_0_1px_rgba(0,0,0,0.9),0_6px_0_0_rgba(0,0,0,0.9)] transition hover:brightness-110"
          >
            Open the Directory
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" className="opacity-90"><path d="M13 5l7 7-7 7" stroke="currentColor" strokeWidth="2"/><path d="M20 12H4" stroke="currentColor" strokeWidth="2"/></svg>
          </a>
          <a
            href="#team"
            className="inline-flex items-center gap-2 rounded border-2 border-black/80 bg-white/5 px-4 py-2 text-sm font-semibold text-white/90 shadow-[0_0_0_1px_rgba(0,0,0,0.9),0_6px_0_0_rgba(0,0,0,0.9)] hover:bg-white/10"
          >
            Meet the Team
          </a>
          <a
            href="https://discord.gg/Qf6k296bQ9"
            target="_blank"
            className="inline-flex items-center gap-2 rounded border-2 border-black/80 bg-white/5 px-4 py-2 text-sm font-semibold text-white/90 shadow-[0_0_0_1px_rgba(0,0,0,0.9),0_6px_0_0_rgba(0,0,0,0.9)] hover:bg-white/10"
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
          <>
            {/* Featured row (full width) */}
            <article className="relative mb-10 overflow-hidden rounded border-2 border-border bg-gradient-to-r from-[#1e1030] via-[#090316] to-[#050208] shadow-[0_0_0_1px_rgba(0,0,0,0.9),0_10px_0_0_rgba(0,0,0,0.9)]">
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
          </>
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
            <div className="text-sm text-white/60">Sign in with Discord to submit proposals and improvements.</div>
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

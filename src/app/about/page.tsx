import MinecraftSkin from "@/components/MinecraftSkin";
import Image from "next/image";

export default function AboutPage() {
  const STAFF = [
    { name: "Inpuzah", id: "Inpuzah", role: "Founder of MMID & Directory Developer", render: "archer" },
    { name: "odeloten", id: "odeloten", role: "Developer & Contributor", render: "idle" },
    { name: "Dreqd", id: "58115bf5f86f4b2bbc27585eee04c923", role: "Maintainer", render: "marching" },
    { name: "Nolant", id: "1652dea3008a46b1afbcaa94790762a5", role: "Maintainer", render: "pointing" },
    { name: "twistlight", id: "dff44685335d4afaaea703ed715f2225", role: "Maintainer", render: "crossed" },
  ];

  const CONTRIBUTORS = [
    { name: "moorax", id: "fe95330659b141339d2998d9ad732737", role: "Replay Officer", render: "idle" },
    { name: "Aiim", id: "e8c6f2817616449c9626a6700f0fd032", role: "Replay Officer", render: "idle" },
    { name: "NotKaan", id: "28860dad975c4d0594dff6b2674f9a43", role: "Replay Officer", render: "idle" },
    { name: "_Merrit", id: "1a6049b9e1c44ab1a866e3e24d38e6a4", role: "Replay Officer", render: "idle" },
    { name: "MayIAxe", id: "9d0be08bddc64c6da5efefc33175b953", role: "Contributor", render: "kicking" },
    { name: "MayILag", id: "f7b61e3709704dabb57b24c779894ca9", role: "Contributor", render: "reading" },
  ];

  return (
    <main className="relative min-h-screen w-full text-foreground">
      {/* Header */}
      <section className="mx-auto mt-6 w-full max-w-5xl px-5">
        <div className="mmid-panel mmid-panel--highlight mmid-gradient-animated mmid-fade-up px-5 py-8">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-amber-300">
            About MMID
          </p>
          <h1 className="mt-2 text-2xl font-extrabold text-white">Skyza Murder Mystery Integrity Directory</h1>
          <p className="mt-2 max-w-2xl text-sm text-slate-200/90">
            MMID is a community-run project started in Skyza to document integrity concerns, cheating
            patterns, and behavioral red flags across Hypixel Murder Mystery players and guilds. It exists
            to help communities queue smarter and keep games fair & fun.
          </p>
        </div>
      </section>

      {/* Maintainers */}
      <section className="relative mx-auto mt-8 w-full max-w-5xl px-5 pb-10 mmid-fade-up">
        <div className="mb-4 flex items-center gap-2">
          <div className="h-6 w-1 bg-[#ff7a1a]" />
          <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-200">
            Maintainers
          </h2>
        </div>

        <article className="mb-6 overflow-hidden rounded-xl border border-white/15 bg-[#050716] shadow-[0_8px_30px_rgba(0,0,0,0.35)]">
          <div className="relative h-52 w-full sm:h-64">
            <Image
              src="/images/mmhq.webp"
              alt="Murder Mystery Headquarters community"
              fill
              className="object-cover"
              priority
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/35 to-transparent" />
            <div className="absolute inset-x-0 bottom-0 p-4 sm:p-5">
              <div className="text-[11px] uppercase tracking-[0.2em] text-amber-200/90">Community</div>
              <div className="mt-1 text-xl font-bold text-white sm:text-2xl">Murder Mystery Headquarters (MMHQ)</div>
              <p className="mt-1 text-sm text-slate-200/90">Home community supporting MMID maintainers, staff, and contributors.</p>
            </div>
          </div>
        </article>

        <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {STAFF.map((m) => (
            <article key={m.name} className="group overflow-hidden mmid-panel bg-[#050716]">
              <div className="relative aspect-[3/4] w-full mmid-frame">
                <MinecraftSkin
                  id={m.id}
                  name={m.name}
                  pose={m.render}
                  className="absolute inset-0 h-full w-full"
                />
                <div className="absolute inset-x-0 bottom-0 border-t-4 border-black bg-[#050608] p-4">
                  <div className="text-base font-semibold">{m.name}</div>
                  <div className="text-xs text-white/75">{m.role}</div>
                </div>
              </div>
            </article>
          ))}
        </div>

        <div className="mb-4 mt-6 flex items-center gap-2">
          <div className="h-6 w-1 bg-[#b0144f]" />
          <h3 className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-200">
            Contributors
          </h3>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {CONTRIBUTORS.map((c) => (
            <article key={c.id} className="group overflow-hidden mmid-panel bg-[#050716]">
              <div className="relative aspect-[3/4] w-full mmid-frame">
                <MinecraftSkin
                  id={c.id}
                  name={c.name}
                  pose={c.render}
                  className="absolute inset-0 h-full w-full"
                />
                <div className="absolute inset-x-0 bottom-0 border-t-4 border-black bg-[#050608] p-4">
                  <div className="text-base font-semibold">{c.name}</div>
                  <div className="text-xs text-white/75">{c.role}</div>
                </div>
              </div>
            </article>
          ))}
        </div>

        {/* Help out CTA */}
        <div className="mt-8 flex flex-wrap items-center justify-between gap-4 mmid-panel border border-border/80 bg-[#10131b] p-5">
          <div>
            <div className="text-lg font-semibold">Help maintain the directory</div>
            <div className="text-sm text-white/70">
              Join the Skyza Discord to learn how to submit evidence, context, and corrections so MMID can
              stay accurate and fair.
            </div>
          </div>
          <a href="https://discord.gg/Qf6k296bQ9" target="_blank" className="mmid-btn mmid-btn-primary">
            Join Discord
          </a>
        </div>
      </section>

      {/* FAQ & Policy */}
      <section className="relative mx-auto mt-2 w-full max-w-5xl px-5 pb-20 mmid-fade-up">
        <div className="mmid-panel p-5">
          <h2 className="text-2xl font-semibold">FAQ</h2>
          <div className="mt-4 space-y-3 text-sm">
            <details className="group mmid-panel bg-[#050716] p-4 [&_summary]:cursor-pointer">
              <summary className="flex items-center justify-between text-base font-medium text-white/90">
                Is MMID official or affiliated with Hypixel?
                <span className="text-white/40">▾</span>
              </summary>
              <p className="mt-2 text-sm text-white/75">
                No. MMID is a community-run resource with an independent review process. It is not
                affiliated with or endorsed by Mojang, Microsoft, Hypixel Inc., or any of their partners.
              </p>
            </details>
            <details className="group mmid-panel bg-[#050716] p-4 [&_summary]:cursor-pointer">
              <summary className="flex items-center justify-between text-base font-medium text-white/90">
                How do I request a correction or removal?
                <span className="text-white/40">▾</span>
              </summary>
              <p className="mt-2 text-sm text-white/75">
                Use the submission link inside an entry or contact a maintainer with your evidence and
                context. Corrections are reviewed by staff before changes are made.
              </p>
            </details>
            <details className="group mmid-panel bg-[#050716] p-4 [&_summary]:cursor-pointer">
              <summary className="flex items-center justify-between text-base font-medium text-white/90">
                Does being listed equal a ban or punishment?
                <span className="text-white/40">▾</span>
              </summary>
              <p className="mt-2 text-sm text-white/75">
                No. The directory is informational. It exists to help communities make their own moderation
                choices with transparent context, not to enforce bans or harassment.
              </p>
            </details>
            <details className="group mmid-panel bg-[#050716] p-4 [&_summary]:cursor-pointer">
              <summary className="flex items-center justify-between text-base font-medium text-white/90">
                Can I contribute?
                <span className="text-white/40">▾</span>
              </summary>
              <p className="mt-2 text-sm text-white/75">
                Yes. Evidence and careful context are always helpful. Join the Skyza Discord to learn how
                reports are evaluated and how to help with review work.
              </p>
            </details>
          </div>

          {/* Policy & disclaimer card */}
          <div className="mt-6 grid gap-4 md:grid-cols-[minmax(0,1.6fr)_minmax(0,1.4fr)]">
            <div className="mmid-panel bg-[#050716] p-4 text-sm text-slate-200/90">
              <h3 className="text-base font-semibold">Policy &amp; Disclaimer</h3>
              <p className="mt-2 text-sm text-slate-200/90">
                MMID is a community-maintained reference and does not represent official findings by Mojang,
                Microsoft, Hypixel Inc., or any other entity. Data may be incomplete, outdated, or under
                active review. Entries should be treated as community-sourced allegations and context, not as
                proof on their own.
              </p>
              <p className="mt-2 text-xs text-slate-400">
                Minecraft is a trademark of Mojang AB. Hypixel is a trademark of Hypixel Inc. All trademarks
                and game assets belong to their respective owners.
              </p>
            </div>

            <div className="mmid-panel bg-[#050716] p-4 text-sm text-slate-200/90">
              <h3 className="text-base font-semibold">Usage rules / expectations</h3>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-200/90">
                <li>Do not harass, witch-hunt, or dox any player listed in the directory.</li>
                <li>
                  Use MMID as one signal among many when deciding who to queue or invite, not as the only
                  source of truth.
                </li>
                <li>
                  Share evidence responsibly and keep sensitive material in appropriate private channels,
                  not public chats.
                </li>
                <li>
                  Assume good faith from reviewers and staff; if you disagree with a listing, follow the
                  appeal / correction process.
                </li>
                <li>
                  By using this site you agree to follow your community's rules and to avoid targeted
                  harassment of any individuals or groups.
                </li>
              </ul>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}

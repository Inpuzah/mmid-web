import MinecraftSkin from "@/components/MinecraftSkin";
import { prisma } from "@/lib/prisma";
import Image from "next/image";
import HomeSearch from "./_components/HomeSearch";

export default async function Page() {
  // All colors lean into dark purple + orange accents to match the logo.
  const STAFF = [
    { name: "Inpuzah", id: "Inpuzah", role: "Founder of MMID & Directory Developer", render: "archer" },
    { name: "odeloten", id: "odeloten", role: "Developer & Contributor", render: "idle" },
    { name: "Dreqd", id: "58115bf5f86f4b2bbc27585eee04c923", role: "Maintainer", render: "marching" },
    { name: "Nolant", id: "1652dea3008a46b1afbcaa94790762a5", role: "Maintainer", render: "pointing" },
    { name: "twistlight", id: "dff44685335d4afaaea703ed715f2225", role: "Maintainer", render: "crossed" },
  ];

  // Contributors (replay officers, tooling, Discord integrations)
  const CONTRIBUTORS = [
    { name: "moorax", id: "fe95330659b141339d2998d9ad732737", role: "Replay Officer", render: "idle" },
    { name: "Aiim", id: "e8c6f2817616449c9626a6700f0fd032", role: "Replay Officer", render: "idle" },
    { name: "NotKaan", id: "28860dad975c4d0594dff6b2674f9a43", role: "Replay Officer", render: "idle" },
    { name: "_Merrit", id: "1a6049b9e1c44ab1a866e3e24d38e6a4", role: "Replay Officer", render: "idle" },
    { name: "MayIAxe", id: "9d0be08bddc64c6da5efefc33175b953", role: "Contributor", render: "kicking" },
    { name: "MayILag", id: "f7b61e3709704dabb57b24c779894ca9", role: "Contributor", render: "reading" },
  ];

  const entriesCount = await prisma.mmidEntry.count();
  const entriesLabel = new Intl.NumberFormat("en-US").format(entriesCount);

  return (
    <main className="relative min-h-screen w-full overflow-hidden text-foreground">
      {/* Landing display: centered SKYZA + search */}
      <section id="overview" className="relative w-full">
        <div className="relative mt-8 w-full mmid-panel mmid-panel--highlight mmid-fade-up px-6 py-24 text-center sm:px-10 lg:px-12">
          <h1 className="mmid-text-fade text-4xl font-extrabold tracking-[0.35em] sm:text-5xl md:text-6xl">
            SKYZA
          </h1>
          <p className="mmid-text-fade mt-4 text-sm text-slate-100 sm:text-base">
            Search for a player's documented history
          </p>
          <div className="mmid-fade-up mt-8 mx-auto w-full max-w-md">
            <HomeSearch />
          </div>
        </div>
      </section>

      {/* TEAM */}
      <section id="team" className="relative mx-auto mt-12 w-full max-w-5xl px-5 pb-24 pt-12 mmid-panel mmid-fade-up">
        <div className="mb-6 flex items-center gap-2">
          <div className="h-6 w-1 bg-[#ff7a1a]" />
          <h2 className="text-2xl font-semibold">Maintainers & Staff</h2>
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

        {STAFF.length > 0 && (
          <div className="mb-10 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {STAFF.map((m) => (
              <article key={m.name} className="group overflow-hidden mmid-panel bg-[#050716]">
                <div className="relative aspect-[3/4] w-full mmid-frame">
                  <MinecraftSkin id={m.id} name={m.name} pose={m.render} className="absolute inset-0 h-full w-full" />
                  <div className="absolute inset-x-0 bottom-0 bg-[#050608] p-4 border-t-4 border-black">
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
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {CONTRIBUTORS.map((c) => (
            <article key={c.id} className="group overflow-hidden mmid-panel bg-[#050716]">
              <div className="relative aspect-[3/4] w-full mmid-frame">
                <MinecraftSkin id={c.id} name={c.name} pose={c.render} className="absolute inset-0 h-full w-full" />
                <div className="absolute inset-x-0 bottom-0 bg-[#050608] p-4 border-t-4 border-black">
                  <div className="text-base font-semibold">{c.name}</div>
                  <div className="text-xs text-white/75">{c.role}</div>
                </div>
              </div>
            </article>
          ))}
        </div>

        {/* CTA */}
          <div className="mt-6 flex flex-wrap items-center justify-between gap-4 border border-border/80 bg-[#10131b] p-5 mmid-panel mmid-fade-up">
          <div>
            <div className="text-lg font-semibold">Help maintain the directory</div>
            <div className="text-sm text-white/70">
              Sign in with Discord to submit evidence, context, and corrections so MMID can stay accurate.
            </div>
          </div>
          <a href="/directory" className="mmid-btn mmid-btn-primary">
            Go to Directory
          </a>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="relative mx-auto mt-10 w-full max-w-5xl px-5 pb-24 mmid-panel mmid-fade-up">
        <h2 className="mb-6 text-2xl font-semibold">FAQ</h2>
        <div className="space-y-3 mt-4">
          <details className="group mmid-panel bg-[#050716] p-4 text-sm [&_summary]:cursor-pointer">
            <summary className="flex items-center justify-between text-base font-medium text-white/90">Is MMID official or affiliated with Hypixel?<span className="text-white/40">▾</span></summary>
            <p className="mt-2 text-sm text-white/75">No. MMID is a community-run resource with an independent review process.</p>
          </details>
          <details className="group mmid-panel bg-[#050716] p-4 text-sm [&_summary]:cursor-pointer">
            <summary className="flex items-center justify-between text-base font-medium text-white/90">How do I request a correction?<span className="text-white/40">▾</span></summary>
            <p className="mt-2 text-sm text-white/75">Use the submission link inside an entry or contact a maintainer with your evidence and context.</p>
          </details>
          <details className="group mmid-panel bg-[#050716] p-4 text-sm [&_summary]:cursor-pointer">
            <summary className="flex items-center justify-between text-base font-medium text-white/90">Does listing equal punishment?<span className="text-white/40">▾</span></summary>
            <p className="mt-2 text-sm text-white/75">No. The directory is informational; it helps communities self‑moderate with transparent context.</p>
          </details>
          <details className="group mmid-panel bg-[#050716] p-4 text-sm [&_summary]:cursor-pointer">
            <summary className="flex items-center justify-between text-base font-medium text-white/90">Can I contribute?<span className="text-white/40">▾</span></summary>
            <p className="mt-2 text-sm text-white/75">Yes — evidence helps. Join our Discord to learn how reports are evaluated and how to help review. <a className="underline decoration-[#ff7a1a]/60 underline-offset-2" href="https://discord.gg/Qf6k296bQ9" target="_blank">Join Skyza Discord</a>.</p>
          </details>
        </div>
      </section>
    </main>
  );
}

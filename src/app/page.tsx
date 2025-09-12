import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowRight, ShieldCheck, Users, Search, Database, Sparkles } from "lucide-react";

// If you're using the Next.js App Router, save this as src/app/page.tsx
// Tailwind, shadcn/ui, and lucide-react are assumed available in your project.
// Adjust copy as needed in the marked sections below.

export default function HomePage() {
  return (
    <main className="min-h-screen bg-slate-950 text-slate-100">
      {/* Decorative BG */}
      <div aria-hidden className="pointer-events-none fixed inset-0 -z-10">
        <div className="absolute inset-0 bg-[radial-gradient(60rem_40rem_at_50%_-10%,#0ea5e9_0%,transparent_40%),radial-gradient(40rem_30rem_at_80%_20%,#22d3ee_0%,transparent_35%),radial-gradient(50rem_30rem_at_20%_10%,#6366f1_0%,transparent_35%)] opacity-20" />
        <div className="absolute inset-0 bg-[url('/noise.png')] opacity-20 mix-blend-overlay" />
      </div>

      {/* Top nav (minimal) */}
      <header className="sticky top-0 z-20 w-full backdrop-blur supports-[backdrop-filter]:bg-slate-900/50 border-b border-white/10">
        <div className="mx-auto max-w-6xl px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-xl bg-gradient-to-tr from-cyan-400 to-indigo-500 shadow-lg" />
            <span className="font-semibold tracking-tight">Skyza • MMID</span>
            <Badge variant="secondary" className="bg-white/10 text-white border-white/10">Community Beta</Badge>
          </div>
          <nav className="hidden md:flex items-center gap-3 text-sm">
            <Link href="#about" className="hover:text-white/90 text-white/70">About</Link>
            <Link href="#how" className="hover:text-white/90 text-white/70">How it Works</Link>
            <Link href="#faq" className="hover:text-white/90 text-white/70">FAQ</Link>
            <Link href="/directory" className="hover:text-white/90 text-white">Directory</Link>
          </nav>
        </div>
      </header>

      {/* Hero */}
      <section className="relative">
        <div className="mx-auto max-w-6xl px-4 py-24 sm:py-28">
          <div className="text-center">
            {/* Credit line */}
            <div className="mb-2 text-xs text-white/60">
              Developed by <span className="font-semibold text-white/80">Inpuzah</span> • Maintained by <span className="font-semibold text-white/80">Murder Mystery Oasis</span>
            </div>
            <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-white/80">
              <Sparkles className="h-3.5 w-3.5" />
              The Murder Mystery Integrity Directory
            </div>
            <h1 className="mt-6 text-4xl sm:text-5xl md:text-6xl font-extrabold tracking-tight leading-[1.1]">
              Fair Play. Transparent Records. <span className="bg-clip-text text-transparent bg-gradient-to-r from-cyan-400 to-indigo-400">Community‑Driven.</span>
            </h1>
            <p className="mx-auto mt-5 max-w-2xl text-lg text-white/80">
              MMID is a community effort to document behavior patterns in Hypixel Murder Mystery. 
              Browse the directory, review evidence, and help keep games fun and fair.
            </p>

            <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
              <Button asChild size="lg" className="h-12 px-8 text-base font-semibold rounded-2xl">
                <Link href="/directory" className="flex items-center gap-2">
                  Open the Directory <ArrowRight className="h-5 w-5" />
                </Link>
              </Button>
              <Link href="#about" className="text-white/80 hover:text-white">Learn more</Link>
            </div>

            {/* Quick stats (replace with live data later) */}
            <div className="mt-12 grid grid-cols-2 sm:grid-cols-4 gap-4 max-w-3xl mx-auto">
              <Stat label="Entries" value="1,300+" />
              <Stat label="Directory" value="Most accurate" />
              <Stat label="Support" value="API" />
              <Stat label="Last Update (placeholder)" value="Live" />
            </div>
          </div>
        </div>
      </section>

      {/* About / Copy area */}
      <section id="about" className="mx-auto max-w-6xl px-4 py-16">
        <div className="grid md:grid-cols-2 gap-10 items-start">
          <div className="space-y-6">
            <h2 className="text-2xl sm:text-3xl font-bold">What is the MMID?</h2>
            <p className="text-white/80">
              The Murder Mystery Integrity Directory (MMID) aggregates reports from trusted community sources to help
              players evaluate matchmaking integrity and repeated disruptive behavior. The goal is to promote
              accountability without harassment, with an emphasis on clear evidence and transparent review.
            </p>
            <ul className="space-y-3 text-white/80">
              <li className="flex items-start gap-3"><ShieldCheck className="mt-1 h-5 w-5 text-cyan-300" /> Evidence‑first approach with reviewer notes.</li>
              <li className="flex items-start gap-3"><Search className="mt-1 h-5 w-5 text-cyan-300" /> Fast search and filters for ranks, guilds, and flags.</li>
              <li className="flex items-start gap-3"><Database className="mt-1 h-5 w-5 text-cyan-300" /> Backed by a consistent schema; exportable history.</li>
              <li className="flex items-start gap-3"><Users className="mt-1 h-5 w-5 text-cyan-300" /> Maintainer workflows for submissions and audits.</li>
            </ul>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/5 p-6 shadow-xl">
            <h3 className="text-lg font-semibold">Directory Principles</h3>
            <ol className="mt-4 list-decimal pl-6 space-y-2 text-white/80">
              <li>Focus on behavior patterns over isolated incidents.</li>
              <li>Require verifiable evidence (video, replay, logs) where possible.</li>
              <li>Use clear status labels (e.g., Legit, Confirmed Cheater, etc.).</li>
              <li>Discourage harassment; promote responsible reporting.</li>
            </ol>
            <div className="mt-6">
              <Button asChild variant="secondary" className="rounded-xl">
                <Link href="/directory">Browse the Directory</Link>
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section id="how" className="mx-auto max-w-6xl px-4 py-16">
        <h2 className="text-2xl sm:text-3xl font-bold">How it Works</h2>
        <div className="mt-8 grid md:grid-cols-3 gap-6">
          <FeatureCard
            icon={<Search className="h-6 w-6" />}
            title="Search & Review"
            desc="Look up players by username, UUID, rank, or guild. Scan flags and status with reviewer notes."
          />
          <FeatureCard
            icon={<ShieldCheck className="h-6 w-6" />}
            title="Evidence‑Backed"
            desc="Entries emphasize linked evidence stored in our Discord for now: screen recordings, replays, logs, and corroboration from trusted sources."
          />
          <FeatureCard
            icon={<Users className="h-6 w-6" />}
            title="Maintainer Workflow"
            desc="Authorized maintainers can propose edits, mark statuses, and resolve disputes with a clear audit trail."
          />
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="mx-auto max-w-6xl px-4 py-16">
        <h2 className="text-2xl sm:text-3xl font-bold">FAQ</h2>
        <div className="mt-6 divide-y divide-white/10 rounded-2xl border border-white/10 bg-white/5">
          <FAQItem q="Is MMID official or affiliated with Hypixel?" a="No. MMID is a community‑run resource with an independent review process." />
          <FAQItem q="How do I request a correction?" a="Use the submission link inside an entry or contact a maintainer with your evidence and context." />
          <FAQItem q="Does listing equal punishment?" a="No. The directory is informational; it helps communities self‑moderate with transparent context." />
          <FAQItem q="Can I contribute?" a="Yes—evidence helps. Join our Discord to learn how reports are evaluated and how to help review." />
        </div>
      </section>

      {/* Big CTA */}
      <section className="mx-auto max-w-6xl px-4 pb-24">
        <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-slate-900 to-slate-800 p-8 md:p-12 shadow-2xl">
          <div className="relative z-10 max-w-2xl">
            <h3 className="text-2xl md:text-3xl font-bold">Jump into the directory</h3>
            <p className="mt-2 text-white/80">Search, filter, and review entries. Help promote fair play across the MM community.</p>
            <div className="mt-6">
              <Button asChild size="lg" className="rounded-2xl h-12 px-8 font-semibold">
                <Link href="/directory" className="flex items-center gap-2">Open the Directory <ArrowRight className="h-5 w-5" /></Link>
              </Button>
            </div>
          </div>
          <div aria-hidden className="absolute -right-10 -top-10 h-56 w-56 rounded-full bg-cyan-500/20 blur-3xl" />
          <div aria-hidden className="absolute -bottom-12 -left-12 h-72 w-72 rounded-full bg-indigo-500/20 blur-3xl" />
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/10 py-10">
        <div className="mx-auto max-w-6xl px-4 flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-white/60">
          <p>© {new Date().getFullYear()} Skyza • MMID. Community‑run project.</p>
          <div className="flex items-center gap-4">
            <Link href="/directory" className="hover:text-white">Directory</Link>
            <Link href="#about" className="hover:text-white">About</Link>
            <Link href="#faq" className="hover:text-white">FAQ</Link>
          </div>
        </div>
      </footer>
    </main>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-5 text-center">
      <div className="text-2xl font-bold tracking-tight">{value}</div>
      <div className="mt-1 text-xs uppercase tracking-wider text-white/70">{label}</div>
    </div>
  );
}

function FeatureCard({ icon, title, desc }: { icon: React.ReactNode; title: string; desc: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-6 shadow-lg">
      <div className="flex items-center justify-center h-12 w-12 rounded-xl bg-white/10 mb-4">{icon}</div>
      <h3 className="text-lg font-semibold">{title}</h3>
      <p className="mt-2 text-white/80">{desc}</p>
    </div>
  );
}

function FAQItem({ q, a }: { q: string; a: string }) {
  return (
    <details className="group p-5">
      <summary className="cursor-pointer list-none select-none font-medium text-white/90 flex items-center justify-between">
        <span>{q}</span>
        <ArrowRight className="h-4 w-4 transition-transform group-open:rotate-90" />
      </summary>
      <p className="mt-3 text-white/80">{a}</p>
    </details>
  );
}

// Metadata for App Router (server component; keep this file without "use client")
export const metadata = {
  title: "Skyza • MMID — Murder Mystery Integrity Directory",
  description:
    "Community‑run Murder Mystery Integrity Directory (MMID). Learn how it works and jump into the directory.",
  openGraph: {
    title: "Skyza • MMID — Murder Mystery Integrity Directory",
    description:
      "Community‑run Murder Mystery Integrity Directory (MMID). Learn how it works and jump into the directory.",
    url: "https://skyza.app/",
    siteName: "Skyza • MMID",
    images: [
      { url: "/og-mmid.png", width: 1200, height: 630, alt: "Skyza MMID" },
    ],
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Skyza • MMID — Murder Mystery Integrity Directory",
    description:
      "Community‑run Murder Mystery Integrity Directory (MMID). Learn how it works and jump into the directory.",
    images: ["/og-mmid.png"],
  },
};

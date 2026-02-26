import { Lock } from "lucide-react";
import type { ReactNode } from "react";

export default function ImmutableSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-[4px] border border-slate-700/80 bg-slate-950/70 p-3">
      <div className="mb-2 flex items-center gap-2 text-xs uppercase tracking-[0.16em] text-slate-300">
        <Lock className="h-3.5 w-3.5" />
        <span>{title}</span>
      </div>
      {children}
    </section>
  );
}

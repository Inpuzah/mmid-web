"use client";
import { useEffect, useState } from "react";
import Link from "next/link";

export default function FlashNotice({ notice }: { notice: string }) {
  const [open, setOpen] = useState(true);

  useEffect(() => {
    const t = setTimeout(() => setOpen(false), 5000);
    return () => clearTimeout(t);
  }, [notice]);

  if (!open) return null;

  const variants: Record<string, { text: string; cls: string }> = {
    "proposal-submitted": {
      text: "Your proposal was submitted for review.",
      cls: "bg-amber-500/10 text-amber-200 border-amber-400/30",
    },
    "entry-saved": {
      text: "Entry saved.",
      cls: "bg-emerald-500/10 text-emerald-200 border-emerald-400/30",
    },
  };

  const v = variants[notice] ?? {
    text: "Done.",
    cls: "bg-slate-700 text-slate-200 border-white/10",
  };

  return (
    <div className={`rounded-md border px-4 py-2 ${v.cls} flex items-center justify-between`}>
      <span>{v.text}</span>
      <Link href="/directory" className="text-xs underline opacity-70">
        Dismiss
      </Link>
    </div>
  );
}

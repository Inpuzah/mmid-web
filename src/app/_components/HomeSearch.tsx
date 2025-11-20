"use client";

import { useState, FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search } from "lucide-react";

export default function HomeSearch() {
  const router = useRouter();
  const [value, setValue] = useState("");

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    const q = value.trim();
    if (!q) return;
    // Send users straight into the directory focused on their query.
    router.push(`/directory?q=${encodeURIComponent(q)}`);
  };

  return (
    <form
      onSubmit={onSubmit}
      className="mt-6 flex w-full flex-col gap-3 sm:flex-row sm:items-center"
      aria-label="Search MMID directory from homepage"
    >
      <div className="relative flex-1">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-300/70" />
        <Input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="Search by username, UUID, guild, or status…"
          className="h-10 w-full border-white/15 bg-black/40 pl-9 text-sm text-slate-50 placeholder:text-slate-400/80"
        />
      </div>
      <Button
        type="submit"
        className="h-10 w-full rounded border-2 border-black/80 bg-[#ff7a1a] px-4 text-sm font-semibold text-black shadow-[0_0_0_1px_rgba(0,0,0,0.9),0_4px_0_0_rgba(0,0,0,0.9)] transition hover:brightness-110 sm:w-auto"
      >
        Search directory
      </Button>
    </form>
  );
}

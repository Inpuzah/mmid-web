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
          className="mmid-input h-10 w-full pl-9 text-sm"
        />
      </div>
      <Button
        type="submit"
        className="mmid-btn mmid-gradient-animated h-10 w-full sm:w-auto text-black"
      >
        Search directory
      </Button>
    </form>
  );
}

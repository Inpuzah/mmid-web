"use client";

import { useState } from "react";

export default function CopyValueButton({
  value,
  label = "Copy",
}: {
  value: string;
  label?: string;
}) {
  const [copied, setCopied] = useState(false);

  async function onCopy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } catch {
      setCopied(false);
    }
  }

  return (
    <button
      type="button"
      onClick={() => void onCopy()}
      className="rounded-md border border-slate-700 bg-slate-900/70 px-2 py-1 text-[11px] font-semibold text-slate-200 hover:bg-slate-800"
      title={value}
    >
      {copied ? "Copied" : label}
    </button>
  );
}

"use client";
import { useEffect, useState } from "react";
import Link from "next/link";

export default function FlashNotice({
  notice,
  oldUsername,
  newUsername,
  entryUuid,
}: {
  notice: string;
  oldUsername?: string;
  newUsername?: string;
  entryUuid?: string;
}) {
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
    "directory-username-updated": {
      text: "Username refreshed from Mojang.",
      cls: "bg-emerald-500/10 text-emerald-200 border-emerald-400/30",
    },
    "directory-username-unchanged": {
      text: "No username change detected.",
      cls: "bg-slate-700 text-slate-200 border-white/10",
    },
    "directory-hypixel-updated": {
      text: "Hypixel rank / guild refreshed.",
      cls: "bg-emerald-500/10 text-emerald-200 border-emerald-400/30",
    },
    "directory-hypixel-error": {
      text: "Could not reach Hypixel API. Try again later.",
      cls: "bg-amber-500/10 text-amber-200 border-amber-400/30",
    },
    "directory-marked-needs-review": {
      text: "Entry marked as Needs Reviewed.",
      cls: "bg-sky-500/10 text-sky-100 border-sky-400/40",
    },
    "directory-entry-deleted": {
      text: "Entry permanently deleted.",
      cls: "bg-rose-600/10 text-rose-100 border-rose-500/40",
    },
  };

  const v = variants[notice] ?? {
    text: "Done.",
    cls: "bg-slate-700 text-slate-200 border-white/10",
  };

  const isUsernameUpdated = notice === "directory-username-updated" && newUsername;

  const nameMcTarget = entryUuid || newUsername || "";
  const nameMcUrl = nameMcTarget
    ? `https://namemc.com/profile/${encodeURIComponent(nameMcTarget)}`
    : undefined;
  const playerDbUrl = newUsername
    ? `https://playerdb.co/search?q=${encodeURIComponent(newUsername)}`
    : undefined;

  const viewHref = entryUuid
    ? `/directory?${new URLSearchParams({
        entryUuid,
        q: newUsername || oldUsername || "",
        edit: "1",
      }).toString()}`
    : "/directory";

  return (
    <div className={`rounded-md border px-4 py-2 ${v.cls} flex items-center justify-between gap-4`}>
      <div className="flex flex-col text-sm">
        {isUsernameUpdated ? (
          <>
            <span>
              Username changed from
              {" "}
              <span className="font-semibold">{oldUsername || "(unknown)"}</span>
              {" "}
              to
              {" "}
              <span className="font-semibold">{newUsername}</span>.
            </span>
            <span className="mt-1 text-xs opacity-80">
              Verify on
              {" "}
              {playerDbUrl && (
                <a
                  href={playerDbUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="underline"
                >
                  PlayerDB
                </a>
              )}
              {playerDbUrl && nameMcUrl && " · "}
              {nameMcUrl && (
                <a
                  href={nameMcUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="underline"
                >
                  NameMC
                </a>
              )}
            </span>
          </>
        ) : (
          <span>{v.text}</span>
        )}
      </div>
      <div className="flex items-center gap-2">
        {entryUuid && (
          <Link href={viewHref} className="text-xs underline opacity-80">
            View entry
          </Link>
        )}
        <Link href="/directory" className="text-xs underline opacity-70">
          Dismiss
        </Link>
      </div>
    </div>
  );
}

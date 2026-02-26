"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";

type ShellNavItem = {
  id: "overview" | "reports" | "intake" | "stale" | "audit" | "directory" | "analytics";
  label: string;
  href: string;
  count?: number;
};

export default function MaintainerShellNav({ items }: { items: ShellNavItem[] }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const tab = searchParams.get("tab") ?? "overview";

  function isActive(item: ShellNavItem): boolean {
    if (pathname.startsWith("/maintainer/reports")) return item.id === "reports";
    if (pathname.startsWith("/maintainer/queue")) return item.id === "intake";
    if (pathname === "/maintainer") {
      if (["overview", "intake", "directory", "stale", "analytics"].includes(item.id)) {
        return item.id === tab;
      }
      return item.id === "overview" && tab === "overview";
    }
    return false;
  }

  return (
    <div className="space-y-1.5">
      {items.map((item) => {
        const active = isActive(item);
        return (
          <Link
            key={item.id}
            href={item.href}
            className={`flex items-center justify-between rounded-[10px] border px-3 py-2.5 text-sm transition ${
              active
                ? "border-blue-700/80 bg-blue-950/40 text-slate-100"
                : "border-transparent bg-transparent text-slate-300 hover:border-blue-900/50 hover:bg-slate-900/80"
            }`}
          >
            <span>{item.label}</span>
            {typeof item.count === "number" ? (
              <span
                className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${
                  item.id === "stale" && item.count > 0
                    ? "border-amber-500/50 bg-amber-950/40 text-amber-200"
                    : "border-blue-900/70 bg-slate-900 text-slate-200"
                }`}
              >
                {item.count}
              </span>
            ) : null}
          </Link>
        );
      })}
    </div>
  );
}

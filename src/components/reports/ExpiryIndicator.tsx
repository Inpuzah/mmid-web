export type ExpiryLevel = "critical" | "warning" | "normal";

export function getExpiryLevel(expiresAt: Date): ExpiryLevel {
  const ms = expiresAt.getTime() - Date.now();
  if (ms <= 2 * 60 * 60 * 1000) return "critical";
  if (ms <= 12 * 60 * 60 * 1000) return "warning";
  return "normal";
}

export default function ExpiryIndicator({ expiresAt }: { expiresAt: Date }) {
  const level = getExpiryLevel(expiresAt);
  const tone =
    level === "critical"
      ? "border-rose-500/70 bg-rose-600/15 text-rose-100"
      : level === "warning"
      ? "border-amber-400/70 bg-amber-500/15 text-amber-100"
      : "border-slate-500/70 bg-slate-700/35 text-slate-200";

  const label = level === "critical" ? "Expiring Soon" : level === "warning" ? "Expiring <12h" : "Stable";

  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.16em] ${tone}`}>
      {label}
    </span>
  );
}

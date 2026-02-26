type Severity = "LOW" | "MED" | "HI" | string;

export default function SeverityBadge({ severity }: { severity: Severity }) {
  const normalized = String(severity).toUpperCase();
  const tone =
    normalized === "HI"
      ? "border-rose-500/70 bg-rose-600/15 text-rose-100"
      : normalized === "MED"
      ? "border-amber-400/70 bg-amber-500/15 text-amber-100"
      : "border-sky-400/70 bg-sky-500/15 text-sky-100";

  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.16em] ${tone}`}>
      {normalized}
    </span>
  );
}

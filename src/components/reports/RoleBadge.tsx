type Role = "USER" | "REPLAY_OFFICER" | "MAINTAINER" | "ADMIN" | string;

export default function RoleBadge({ role }: { role: Role }) {
  const normalized = String(role).toUpperCase();
  const tone =
    normalized === "ADMIN"
      ? "border-fuchsia-400/70 bg-fuchsia-500/15 text-fuchsia-100"
      : normalized === "MAINTAINER"
      ? "border-emerald-400/70 bg-emerald-500/15 text-emerald-100"
      : normalized === "REPLAY_OFFICER"
      ? "border-sky-400/70 bg-sky-500/15 text-sky-100"
      : "border-slate-500/70 bg-slate-700/35 text-slate-100";

  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.16em] ${tone}`}>
      {normalized.replace(/_/g, " ")}
    </span>
  );
}

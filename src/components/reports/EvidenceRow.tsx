import { X } from "lucide-react";

type EvidenceRowProps = {
  label: string;
  value: string;
  onRemove: () => void;
};

export default function EvidenceRow({ label, value, onRemove }: EvidenceRowProps) {
  return (
    <div className="flex items-center justify-between gap-2 rounded-[3px] border border-slate-700/80 bg-slate-900/60 px-2.5 py-2 text-sm">
      <div className="min-w-0">
        <p className="text-[10px] uppercase tracking-[0.14em] text-slate-400">{label}</p>
        <p className="truncate text-slate-100">{value}</p>
      </div>
      <button
        type="button"
        onClick={onRemove}
        className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-slate-600 bg-slate-950/70 text-slate-200 hover:border-rose-400/70 hover:text-rose-200"
        aria-label={`Remove ${label}`}
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

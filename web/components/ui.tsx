// Small shared UI primitives used across the tabs.

export function Spinner({ className = "" }: { className?: string }) {
  return (
    <svg
      className={`animate-spin ${className}`}
      viewBox="0 0 24 24"
      fill="none"
      width="16"
      height="16"
      aria-hidden="true"
    >
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-90" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.4 0 0 5.4 0 12h4z" />
    </svg>
  );
}

const STATUS_META: Record<string, { dot: string; pill: string; label: string }> = {
  Open: { dot: "bg-green-500", pill: "bg-green-50 text-green-700 ring-green-600/20", label: "Open" },
  Waitlist: { dot: "bg-amber-500", pill: "bg-amber-50 text-amber-700 ring-amber-600/20", label: "Waitlist" },
  Full: { dot: "bg-red-500", pill: "bg-red-50 text-red-700 ring-red-600/20", label: "Full" },
  Unknown: { dot: "bg-slate-400", pill: "bg-slate-100 text-slate-600 ring-slate-500/20", label: "Unknown" },
};

export function StatusBadge({ status, seats }: { status: string; seats?: number | null }) {
  const m = STATUS_META[status] ?? STATUS_META.Unknown;
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${m.pill}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${m.dot} ${status === "Open" ? "animate-pulse" : ""}`} />
      {m.label}
      {seats != null ? ` · ${seats}` : ""}
    </span>
  );
}

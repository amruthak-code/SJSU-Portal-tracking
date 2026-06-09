"use client";

import { useState } from "react";
import { Spinner } from "@/components/ui";

type Req = {
  name: string;
  status: "satisfied" | "in-progress" | "not-started";
  unitsRequired: number;
  unitsCompleted: number;
  satisfiedBy: string[];
  suggestions: string[];
};

type Audit = {
  requirements: Req[];
  totalUnitsCompleted: number;
  totalUnitsRemaining: number;
  recommendedThisSemester: string[];
  disclaimer: string;
};

const STATUS_META: Record<string, { pill: string; icon: string }> = {
  satisfied: { pill: "bg-green-50 text-green-700 ring-green-600/20", icon: "✓" },
  "in-progress": { pill: "bg-amber-50 text-amber-700 ring-amber-600/20", icon: "◐" },
  "not-started": { pill: "bg-slate-100 text-slate-600 ring-slate-500/20", icon: "○" },
};

export default function DegreeAudit() {
  const [completed, setCompleted] = useState("");
  const [major, setMajor] = useState("MS Computer Science");
  const [audit, setAudit] = useState<Audit | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function runAudit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    setAudit(null);
    try {
      const res = await fetch("/api/audit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ completed, major }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Audit failed");
      setAudit(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Audit failed");
    } finally {
      setLoading(false);
    }
  }

  const total = audit ? audit.totalUnitsCompleted + audit.totalUnitsRemaining : 0;
  const pct = total ? Math.round((audit!.totalUnitsCompleted / total) * 100) : 0;

  return (
    <section>
      <h2 className="mb-1 text-lg font-semibold">Degree Audit</h2>
      <p className="mb-4 text-sm text-slate-600">
        Paste the courses you&apos;ve completed — Gemini matches them against the MS CS
        requirements and shows what&apos;s left.
      </p>

      <form onSubmit={runAudit} className="mb-5 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <label className="block text-xs font-medium text-slate-600">Major</label>
        <select
          value={major}
          onChange={(e) => setMajor(e.target.value)}
          className="mt-1 mb-3 w-64 rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-sjsu-blue focus:outline-none focus:ring-2 focus:ring-sjsu-blue/20"
        >
          <option>MS Computer Science</option>
        </select>

        <label className="block text-xs font-medium text-slate-600">
          Completed courses (one per line)
        </label>
        <textarea
          value={completed}
          onChange={(e) => setCompleted(e.target.value)}
          rows={6}
          placeholder={"CS 200W\nCS 218\nCS 249\nCS 271"}
          className="mt-1 w-full resize-none rounded-lg border border-slate-300 px-3 py-2 font-mono text-sm focus:border-sjsu-blue focus:outline-none focus:ring-2 focus:ring-sjsu-blue/20"
        />
        <button
          type="submit"
          disabled={loading || !completed.trim()}
          className="mt-3 inline-flex items-center gap-2 rounded-lg bg-sjsu-blue px-5 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-blue-800 disabled:opacity-50"
        >
          {loading && <Spinner />}
          {loading ? "Analyzing…" : "Run audit"}
        </button>
      </form>

      {error && <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}

      {audit && (
        <div className="animate-fade-in space-y-4">
          {/* Progress */}
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="mb-2 flex items-baseline justify-between text-sm">
              <span className="font-medium text-slate-700">Progress</span>
              <span className="text-slate-500">
                <span className="font-semibold text-green-600">{audit.totalUnitsCompleted}</span> done ·{" "}
                <span className="font-semibold text-sjsu-blue">{audit.totalUnitsRemaining}</span> left
                {total ? ` · ${total} total` : ""}
              </span>
            </div>
            <div className="h-3 w-full overflow-hidden rounded-full bg-slate-100">
              <div
                className="h-full rounded-full bg-gradient-to-r from-sjsu-blue to-green-500 transition-all duration-700"
                style={{ width: `${pct}%` }}
              />
            </div>
            <p className="mt-1 text-right text-xs text-slate-400">{pct}% complete</p>
          </div>

          {/* Requirement buckets */}
          <ul className="space-y-2">
            {audit.requirements.map((r) => {
              const m = STATUS_META[r.status] ?? STATUS_META["not-started"];
              return (
                <li key={r.name} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                  <div className="flex items-baseline justify-between gap-2">
                    <h3 className="font-medium text-slate-800">{r.name}</h3>
                    <span
                      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${m.pill}`}
                    >
                      {m.icon} {r.status}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-slate-500">
                    {r.unitsCompleted}/{r.unitsRequired} units
                    {r.satisfiedBy.length > 0 && ` · satisfied by: ${r.satisfiedBy.join(", ")}`}
                  </p>
                  {r.suggestions.length > 0 && (
                    <p className="mt-2 text-sm text-slate-700">
                      <span className="text-slate-400">Suggested:</span> {r.suggestions.join(", ")}
                    </p>
                  )}
                </li>
              );
            })}
          </ul>

          {audit.recommendedThisSemester.length > 0 && (
            <div className="rounded-xl border border-blue-100 bg-blue-50 p-4">
              <h3 className="text-sm font-semibold text-sjsu-blue">📅 Recommended this semester</h3>
              <div className="mt-2 flex flex-wrap gap-2">
                {audit.recommendedThisSemester.map((c) => (
                  <span
                    key={c}
                    className="rounded-full bg-white px-3 py-1 text-xs text-slate-700 shadow-sm ring-1 ring-slate-200"
                  >
                    {c}
                  </span>
                ))}
              </div>
            </div>
          )}

          <p className="text-xs italic text-slate-400">{audit.disclaimer}</p>
        </div>
      )}
    </section>
  );
}

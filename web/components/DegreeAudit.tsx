"use client";

import { useState } from "react";

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

const STATUS_STYLES: Record<string, string> = {
  satisfied: "bg-green-100 text-green-800",
  "in-progress": "bg-amber-100 text-amber-800",
  "not-started": "bg-slate-100 text-slate-600",
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

  return (
    <section>
      <h2 className="mb-1 text-xl font-semibold">Degree Audit</h2>
      <p className="mb-4 text-sm text-slate-600">
        Paste the courses you&apos;ve completed. Claude matches them against the MS CS
        requirements and suggests what&apos;s left.
      </p>

      <form onSubmit={runAudit} className="mb-4">
        <label className="block text-xs font-medium text-slate-600">Major</label>
        <select
          value={major}
          onChange={(e) => setMajor(e.target.value)}
          className="mt-1 mb-3 w-64 rounded border border-slate-300 px-3 py-2 text-sm focus:border-sjsu-blue focus:outline-none"
        >
          <option>MS Computer Science</option>
        </select>

        <label className="block text-xs font-medium text-slate-600">
          Completed courses (one per line, e.g. &quot;CS 200W&quot;, &quot;CS 235&quot;)
        </label>
        <textarea
          value={completed}
          onChange={(e) => setCompleted(e.target.value)}
          rows={6}
          placeholder={"CS 200W\nCS 218\nCS 249\nCS 271"}
          className="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm focus:border-sjsu-blue focus:outline-none"
        />
        <button
          type="submit"
          disabled={loading || !completed.trim()}
          className="mt-2 rounded bg-sjsu-blue px-4 py-2 text-sm font-medium text-white hover:bg-blue-800 disabled:opacity-50"
        >
          {loading ? "Analyzing…" : "Run audit"}
        </button>
      </form>

      {error && <p className="mb-4 text-sm text-red-600">{error}</p>}

      {audit && (
        <div className="space-y-4">
          <div className="flex gap-4">
            <div className="flex-1 rounded border border-slate-200 bg-white p-4 text-center">
              <p className="text-2xl font-bold text-green-700">{audit.totalUnitsCompleted}</p>
              <p className="text-xs text-slate-500">units completed</p>
            </div>
            <div className="flex-1 rounded border border-slate-200 bg-white p-4 text-center">
              <p className="text-2xl font-bold text-sjsu-blue">{audit.totalUnitsRemaining}</p>
              <p className="text-xs text-slate-500">units remaining</p>
            </div>
          </div>

          <ul className="space-y-2">
            {audit.requirements.map((r) => (
              <li key={r.name} className="rounded border border-slate-200 bg-white p-4">
                <div className="flex items-baseline justify-between">
                  <h3 className="font-medium">{r.name}</h3>
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_STYLES[r.status]}`}
                  >
                    {r.status}
                  </span>
                </div>
                <p className="mt-1 text-xs text-slate-500">
                  {r.unitsCompleted}/{r.unitsRequired} units
                  {r.satisfiedBy.length > 0 && ` · satisfied by: ${r.satisfiedBy.join(", ")}`}
                </p>
                {r.suggestions.length > 0 && (
                  <p className="mt-2 text-sm text-slate-700">
                    Suggested: {r.suggestions.join(", ")}
                  </p>
                )}
              </li>
            ))}
          </ul>

          {audit.recommendedThisSemester.length > 0 && (
            <div className="rounded bg-blue-50 p-4">
              <h3 className="text-sm font-semibold text-sjsu-blue">
                Recommended this semester
              </h3>
              <p className="mt-1 text-sm text-slate-700">
                {audit.recommendedThisSemester.join(", ")}
              </p>
            </div>
          )}

          <p className="text-xs italic text-slate-400">{audit.disclaimer}</p>
        </div>
      )}
    </section>
  );
}

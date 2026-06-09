"use client";

import { useState } from "react";

type Rec = {
  code: string;
  title: string;
  days: string;
  time: string;
  instructor: string;
  reason: string;
  cautions: string;
};

const EXAMPLES = [
  "Find a graduate AI/ML elective on Tuesdays after 2pm",
  "I want an evening graduate course that doesn't conflict with CS 218",
  "Suggest a security or databases course taught by an experienced professor",
];

export default function SmartSearch() {
  const [query, setQuery] = useState("");
  const [recs, setRecs] = useState<Rec[]>([]);
  const [summary, setSummary] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function search(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    setRecs([]);
    setSummary("");
    try {
      const res = await fetch("/api/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Search failed");
      setRecs(data.recommendations || []);
      setSummary(data.summary || "");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Search failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section>
      <h2 className="mb-1 text-xl font-semibold">Smart Course Search</h2>
      <p className="mb-4 text-sm text-slate-600">
        Describe what you want in plain English. Claude recommends from the SJSU CS
        course list.
      </p>

      <form onSubmit={search} className="mb-3">
        <textarea
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          rows={3}
          placeholder="e.g. Find a CS elective on Tuesdays after 2pm that doesn't conflict with CS 218"
          className="w-full rounded border border-slate-300 px-3 py-2 text-sm focus:border-sjsu-blue focus:outline-none"
        />
        <div className="mt-2 flex items-center justify-between">
          <div className="flex flex-wrap gap-2">
            {EXAMPLES.map((ex) => (
              <button
                key={ex}
                type="button"
                onClick={() => setQuery(ex)}
                className="rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-600 hover:bg-slate-200"
              >
                {ex}
              </button>
            ))}
          </div>
          <button
            type="submit"
            disabled={loading || !query.trim()}
            className="rounded bg-sjsu-blue px-4 py-2 text-sm font-medium text-white hover:bg-blue-800 disabled:opacity-50"
          >
            {loading ? "Thinking…" : "Search"}
          </button>
        </div>
      </form>

      {error && <p className="mb-4 text-sm text-red-600">{error}</p>}
      {summary && <p className="mb-4 rounded bg-blue-50 p-3 text-sm text-slate-700">{summary}</p>}

      <div className="space-y-3">
        {recs.map((r) => (
          <div key={r.code} className="rounded border border-slate-200 bg-white p-4">
            <div className="flex items-baseline justify-between">
              <h3 className="font-semibold text-sjsu-blue">
                {r.code} — {r.title}
              </h3>
              <span className="text-xs text-slate-500">
                {r.days} · {r.time}
              </span>
            </div>
            <p className="mt-1 text-xs text-slate-500">{r.instructor}</p>
            <p className="mt-2 text-sm text-slate-700">{r.reason}</p>
            {r.cautions && (
              <p className="mt-2 text-sm text-amber-700">⚠ {r.cautions}</p>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}

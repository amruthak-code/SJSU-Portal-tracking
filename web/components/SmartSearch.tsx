"use client";

import { useState } from "react";

type Rec = {
  code: string;
  title: string;
  days: string;
  time: string;
  instructor: string;
  status: string;
  reason: string;
  cautions: string;
};

const EXAMPLES = [
  "an OPEN graduate AI/ML elective in the evening",
  "a graduate course on Tuesdays that doesn't conflict with CS 249",
  "open electives taught in person, afternoons only",
];

const STATUS_STYLES: Record<string, string> = {
  Open: "bg-green-100 text-green-800",
  Waitlist: "bg-amber-100 text-amber-800",
  Full: "bg-red-100 text-red-800",
  Unknown: "bg-slate-100 text-slate-600",
};

export default function SmartSearch() {
  const [query, setQuery] = useState("");
  const [recs, setRecs] = useState<Rec[]>([]);
  const [summary, setSummary] = useState("");
  const [live, setLive] = useState<boolean | null>(null);
  const [generatedAt, setGeneratedAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  async function search(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setNotice("");
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
      setLive(data.live ?? null);
      setGeneratedAt(data.generatedAt ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Search failed");
    } finally {
      setLoading(false);
    }
  }

  async function refreshCatalog() {
    setRefreshing(true);
    setError("");
    setNotice("");
    try {
      const res = await fetch("/api/refresh-catalog?subject=CS", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Refresh failed");
      setNotice(`Live catalog refreshed: ${data.count} sections.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Refresh failed");
    } finally {
      setRefreshing(false);
    }
  }

  return (
    <section>
      <div className="mb-1 flex items-center justify-between">
        <h2 className="text-xl font-semibold">Smart Course Search</h2>
        <button
          onClick={refreshCatalog}
          disabled={refreshing}
          className="rounded border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100 disabled:opacity-50"
        >
          {refreshing ? "Refreshing live data…" : "🔄 Refresh live courses"}
        </button>
      </div>
      <p className="mb-4 text-sm text-slate-600">
        Describe what you want in plain English. Recommendations are drawn from the{" "}
        <strong>real SJSU CS schedule</strong> with live Open/Full status.
      </p>

      <form onSubmit={search} className="mb-3">
        <textarea
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          rows={3}
          placeholder="e.g. an open graduate ML elective in the evening that doesn't conflict with CS 249"
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

      {notice && <p className="mb-3 text-sm text-green-700">{notice}</p>}
      {error && <p className="mb-4 text-sm text-red-600">{error}</p>}

      {live === false && (
        <p className="mb-3 rounded bg-amber-50 p-2 text-xs text-amber-800">
          ⚠ Live catalog not found — showing results from a sample list. Click
          &quot;Refresh live courses&quot; to pull the real schedule.
        </p>
      )}
      {live && generatedAt && (
        <p className="mb-3 text-xs text-slate-400">
          Live SJSU data as of {new Date(generatedAt).toLocaleString()}
        </p>
      )}

      {summary && <p className="mb-4 rounded bg-blue-50 p-3 text-sm text-slate-700">{summary}</p>}

      <div className="space-y-3">
        {recs.map((r, i) => (
          <div key={`${r.code}-${i}`} className="rounded border border-slate-200 bg-white p-4">
            <div className="flex items-baseline justify-between gap-2">
              <h3 className="font-semibold text-sjsu-blue">
                {r.code} — {r.title}
              </h3>
              <span className="flex items-center gap-2 whitespace-nowrap text-xs text-slate-500">
                {r.status && (
                  <span
                    className={`rounded-full px-2 py-0.5 font-medium ${
                      STATUS_STYLES[r.status] || STATUS_STYLES.Unknown
                    }`}
                  >
                    {r.status}
                  </span>
                )}
                {[r.days, r.time].filter(Boolean).join(" · ")}
              </span>
            </div>
            <p className="mt-1 text-xs text-slate-500">{r.instructor}</p>
            <p className="mt-2 text-sm text-slate-700">{r.reason}</p>
            {r.cautions && r.cautions !== "None" && (
              <p className="mt-2 text-sm text-amber-700">⚠ {r.cautions}</p>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}

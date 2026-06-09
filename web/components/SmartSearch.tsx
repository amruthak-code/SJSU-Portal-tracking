"use client";

import { useState } from "react";
import { Spinner, StatusBadge } from "@/components/ui";

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
      setNotice(`✓ Live catalog refreshed — ${data.count} sections.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Refresh failed");
    } finally {
      setRefreshing(false);
    }
  }

  return (
    <section>
      <div className="mb-1 flex items-center justify-between">
        <h2 className="text-lg font-semibold">Smart Course Search</h2>
        <button
          onClick={refreshCatalog}
          disabled={refreshing}
          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 shadow-sm transition hover:bg-slate-50 disabled:opacity-50"
        >
          {refreshing ? <Spinner /> : "🔄"}
          {refreshing ? "Refreshing…" : "Refresh live courses"}
        </button>
      </div>
      <p className="mb-4 text-sm text-slate-600">
        Describe what you want in plain English — recommendations come from the{" "}
        <strong>real SJSU CS schedule</strong> with live Open/Full status.
      </p>

      <form onSubmit={search} className="mb-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <textarea
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          rows={3}
          placeholder="e.g. an open graduate ML elective in the evening that doesn't conflict with CS 249"
          className="w-full resize-none rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-sjsu-blue focus:outline-none focus:ring-2 focus:ring-sjsu-blue/20"
        />
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap gap-2">
            {EXAMPLES.map((ex) => (
              <button
                key={ex}
                type="button"
                onClick={() => setQuery(ex)}
                className="rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-600 transition hover:bg-slate-200"
              >
                {ex}
              </button>
            ))}
          </div>
          <button
            type="submit"
            disabled={loading || !query.trim()}
            className="inline-flex items-center gap-2 rounded-lg bg-sjsu-blue px-5 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-blue-800 disabled:opacity-50"
          >
            {loading && <Spinner />}
            {loading ? "Thinking…" : "Search"}
          </button>
        </div>
      </form>

      {notice && <p className="mb-3 text-sm text-green-700">{notice}</p>}
      {error && <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}

      {live === false && (
        <p className="mb-3 rounded-lg bg-amber-50 p-2 text-xs text-amber-800">
          ⚠ Live catalog not found — showing sample data. Click &quot;Refresh live courses.&quot;
        </p>
      )}
      {live && generatedAt && (
        <p className="mb-3 flex items-center gap-1.5 text-xs text-slate-400">
          <span className="h-1.5 w-1.5 rounded-full bg-green-500" />
          Live SJSU data as of {new Date(generatedAt).toLocaleString()}
        </p>
      )}

      {summary && (
        <p className="mb-4 rounded-xl border border-blue-100 bg-blue-50 p-3 text-sm text-slate-700">
          {summary}
        </p>
      )}

      <div className="space-y-3">
        {recs.map((r, i) => (
          <div
            key={`${r.code}-${i}`}
            className="animate-fade-in rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition hover:shadow"
          >
            <div className="flex items-start justify-between gap-2">
              <h3 className="font-semibold text-sjsu-blue">
                {r.code} — {r.title}
              </h3>
              {r.status && <StatusBadge status={r.status} />}
            </div>
            <p className="mt-1 text-xs text-slate-500">
              {[r.days, r.time].filter(Boolean).join(" · ")}
              {r.instructor ? ` · ${r.instructor}` : ""}
            </p>
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

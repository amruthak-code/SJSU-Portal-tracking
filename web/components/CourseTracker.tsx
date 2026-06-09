"use client";

import { useEffect, useState } from "react";

type TrackedCourse = { classNumber: string; label: string; addedAt: string };
type StatusResult = {
  status: "Open" | "Full" | "Waitlist" | "Unknown";
  seats: number | null;
  checkedAt: string;
};

const STATUS_STYLES: Record<string, string> = {
  Open: "bg-green-100 text-green-800",
  Waitlist: "bg-amber-100 text-amber-800",
  Full: "bg-red-100 text-red-800",
  Unknown: "bg-slate-100 text-slate-600",
};

export default function CourseTracker() {
  const [term, setTerm] = useState("");
  const [courses, setCourses] = useState<TrackedCourse[]>([]);
  const [results, setResults] = useState<Record<string, StatusResult>>({});
  const [lastRun, setLastRun] = useState<string | null>(null);
  const [classNumber, setClassNumber] = useState("");
  const [label, setLabel] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    const [c, s] = await Promise.all([
      fetch("/api/courses").then((r) => r.json()),
      fetch("/api/status").then((r) => r.json()),
    ]);
    setTerm(c.term || "");
    setCourses(c.courses || []);
    setResults(s.results || {});
    setLastRun(s.lastRun || null);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function addCourse(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    const res = await fetch("/api/courses", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ classNumber, label }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error || "Failed to add course");
      return;
    }
    setCourses(data.courses);
    setClassNumber("");
    setLabel("");
  }

  async function removeCourse(cn: string) {
    const res = await fetch(`/api/courses?classNumber=${cn}`, { method: "DELETE" });
    const data = await res.json();
    setCourses(data.courses);
  }

  return (
    <section>
      <div className="mb-4 flex items-baseline justify-between">
        <h2 className="text-xl font-semibold">Tracked courses — {term}</h2>
        <span className="text-xs text-slate-500">
          {lastRun ? `Last checked ${new Date(lastRun).toLocaleString()}` : "Not checked yet"}
        </span>
      </div>

      <form onSubmit={addCourse} className="mb-6 flex flex-wrap items-end gap-3">
        <div>
          <label className="block text-xs font-medium text-slate-600">
            Class number (5-digit)
          </label>
          <input
            value={classNumber}
            onChange={(e) => setClassNumber(e.target.value)}
            placeholder="47158"
            className="mt-1 w-32 rounded border border-slate-300 px-3 py-2 text-sm focus:border-sjsu-blue focus:outline-none"
          />
        </div>
        <div className="flex-1">
          <label className="block text-xs font-medium text-slate-600">
            Label (optional)
          </label>
          <input
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="CS 218 - Sec 01"
            className="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm focus:border-sjsu-blue focus:outline-none"
          />
        </div>
        <button
          type="submit"
          className="rounded bg-sjsu-blue px-4 py-2 text-sm font-medium text-white hover:bg-blue-800"
        >
          Add
        </button>
      </form>

      {error && <p className="mb-4 text-sm text-red-600">{error}</p>}

      {loading ? (
        <p className="text-sm text-slate-500">Loading…</p>
      ) : courses.length === 0 ? (
        <p className="text-sm text-slate-500">
          No courses tracked yet. Add a class number above.
        </p>
      ) : (
        <ul className="divide-y divide-slate-200 rounded border border-slate-200 bg-white">
          {courses.map((c) => {
            const r = results[c.classNumber];
            const status = r?.status || "Unknown";
            return (
              <li key={c.classNumber} className="flex items-center justify-between px-4 py-3">
                <div>
                  <p className="font-medium">{c.label}</p>
                  <p className="text-xs text-slate-500">Class #{c.classNumber}</p>
                </div>
                <div className="flex items-center gap-3">
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_STYLES[status]}`}
                  >
                    {status}
                    {r?.seats != null ? ` · ${r.seats} seats` : ""}
                  </span>
                  <button
                    onClick={() => removeCourse(c.classNumber)}
                    className="text-xs text-slate-400 hover:text-red-600"
                    aria-label="Remove"
                  >
                    ✕
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <p className="mt-4 text-xs text-slate-400">
        Status is updated by the scraper (GitHub Action) every ~5 minutes and committed
        to <code>status_log.json</code>. After adding/removing courses locally, commit &amp;
        push <code>courses.json</code> so the cloud scraper picks up your changes.
      </p>
    </section>
  );
}

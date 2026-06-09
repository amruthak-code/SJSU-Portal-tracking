"use client";

import { useEffect, useState } from "react";
import { Spinner, StatusBadge } from "@/components/ui";

type TrackedCourse = { classNumber: string; label: string; addedAt: string };
type StatusResult = {
  status: "Open" | "Full" | "Waitlist" | "Unknown";
  seats: number | null;
  checkedAt: string;
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
  const [adding, setAdding] = useState(false);

  async function load() {
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
    setAdding(true);
    try {
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
    } finally {
      setAdding(false);
    }
  }

  async function removeCourse(cn: string) {
    const res = await fetch(`/api/courses?classNumber=${cn}`, { method: "DELETE" });
    const data = await res.json();
    setCourses(data.courses);
  }

  const counts = courses.reduce(
    (acc, c) => {
      const st = results[c.classNumber]?.status || "Unknown";
      acc[st] = (acc[st] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>
  );

  return (
    <section>
      {/* Summary stat chips */}
      <div className="mb-5 grid grid-cols-4 gap-3">
        {[
          { label: "Tracked", value: courses.length, color: "text-slate-900" },
          { label: "Open", value: counts.Open || 0, color: "text-green-600" },
          { label: "Waitlist", value: counts.Waitlist || 0, color: "text-amber-600" },
          { label: "Full", value: counts.Full || 0, color: "text-red-600" },
        ].map((s) => (
          <div
            key={s.label}
            className="rounded-xl border border-slate-200 bg-white p-3 text-center shadow-sm"
          >
            <div className={`text-2xl font-bold ${s.color}`}>{s.value}</div>
            <div className="text-xs text-slate-500">{s.label}</div>
          </div>
        ))}
      </div>

      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-lg font-semibold">
          Tracked courses <span className="font-normal text-slate-400">· {term}</span>
        </h2>
        <button
          onClick={load}
          className="text-xs text-slate-500 transition hover:text-sjsu-blue"
          title="Reload statuses"
        >
          ↻ Refresh
        </button>
      </div>

      {/* Add form */}
      <form
        onSubmit={addCourse}
        className="mb-5 flex flex-wrap items-end gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
      >
        <div>
          <label className="block text-xs font-medium text-slate-600">Class number</label>
          <input
            value={classNumber}
            onChange={(e) => setClassNumber(e.target.value)}
            placeholder="47158"
            className="mt-1 w-32 rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-sjsu-blue focus:outline-none focus:ring-2 focus:ring-sjsu-blue/20"
          />
        </div>
        <div className="flex-1">
          <label className="block text-xs font-medium text-slate-600">Label (optional)</label>
          <input
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="CS 218 - Sec 01"
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-sjsu-blue focus:outline-none focus:ring-2 focus:ring-sjsu-blue/20"
          />
        </div>
        <button
          type="submit"
          disabled={adding || !classNumber.trim()}
          className="inline-flex items-center gap-2 rounded-lg bg-sjsu-blue px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-blue-800 disabled:opacity-50"
        >
          {adding && <Spinner />}
          Add course
        </button>
      </form>

      {error && (
        <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>
      )}

      {/* List */}
      {loading ? (
        <div className="flex items-center gap-2 py-8 text-sm text-slate-400">
          <Spinner /> Loading your courses…
        </div>
      ) : courses.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white/50 py-12 text-center">
          <p className="text-sm text-slate-500">No courses tracked yet.</p>
          <p className="mt-1 text-xs text-slate-400">Add a class number above to start.</p>
        </div>
      ) : (
        <ul className="space-y-2">
          {courses.map((c) => {
            const r = results[c.classNumber];
            return (
              <li
                key={c.classNumber}
                className="group flex items-center justify-between rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm transition hover:border-sjsu-blue/40 hover:shadow"
              >
                <div>
                  <p className="font-medium text-slate-800">{c.label}</p>
                  <p className="text-xs text-slate-400">Class #{c.classNumber}</p>
                </div>
                <div className="flex items-center gap-3">
                  <StatusBadge status={r?.status || "Unknown"} seats={r?.seats} />
                  <button
                    onClick={() => removeCourse(c.classNumber)}
                    className="text-slate-300 opacity-0 transition hover:text-red-600 group-hover:opacity-100"
                    aria-label="Remove course"
                    title="Remove"
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
        {lastRun
          ? `Statuses last checked ${new Date(lastRun).toLocaleString()} by the scraper.`
          : "Not checked yet — run the scraper to populate statuses."}{" "}
        New courses show “Unknown” until the next scraper run. Commit &amp; push{" "}
        <code>courses.json</code> so the cloud scraper tracks them.
      </p>
    </section>
  );
}

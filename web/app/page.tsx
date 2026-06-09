"use client";

import { useState } from "react";
import CourseTracker from "@/components/CourseTracker";
import SmartSearch from "@/components/SmartSearch";
import DegreeAudit from "@/components/DegreeAudit";

const TABS = [
  { id: "tracker", label: "📋 Course Tracker" },
  { id: "search", label: "🔍 Smart Search" },
  { id: "audit", label: "🎓 Degree Audit" },
] as const;

type TabId = (typeof TABS)[number]["id"];

export default function Home() {
  const [tab, setTab] = useState<TabId>("tracker");

  return (
    <main className="mx-auto max-w-4xl px-4 py-8">
      <header className="mb-6">
        <h1 className="text-3xl font-bold text-sjsu-blue">SJSU Course Seat Tracker</h1>
        <p className="mt-1 text-sm text-slate-600">
          Track openings, find courses in natural language, and audit your MS CS degree.
        </p>
      </header>

      <nav className="mb-6 flex gap-2 border-b border-slate-200">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`-mb-px border-b-2 px-4 py-2 text-sm font-medium transition ${
              tab === t.id
                ? "border-sjsu-blue text-sjsu-blue"
                : "border-transparent text-slate-500 hover:text-slate-700"
            }`}
          >
            {t.label}
          </button>
        ))}
      </nav>

      {tab === "tracker" && <CourseTracker />}
      {tab === "search" && <SmartSearch />}
      {tab === "audit" && <DegreeAudit />}
    </main>
  );
}

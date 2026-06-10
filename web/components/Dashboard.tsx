"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import CourseTracker from "@/components/CourseTracker";
import SmartSearch from "@/components/SmartSearch";
import DegreeAudit from "@/components/DegreeAudit";

const TABS = [
  { id: "tracker", label: "Course Tracker", icon: "📋" },
  { id: "search", label: "Smart Search", icon: "🔍" },
  { id: "audit", label: "Degree Audit", icon: "🎓" },
] as const;

type TabId = (typeof TABS)[number]["id"];

export default function Dashboard({ email }: { email: string }) {
  const [tab, setTab] = useState<TabId>("tracker");

  async function signOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    window.location.href = "/login";
  }

  return (
    <main className="mx-auto max-w-4xl px-4 py-8 sm:py-10">
      <header className="mb-8 overflow-hidden rounded-2xl bg-gradient-to-r from-sjsu-blue to-blue-900 px-6 py-7 text-white shadow-lg">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="text-3xl">🎓</span>
            <div>
              <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
                SJSU Course Seat Tracker
              </h1>
              <p className="mt-1 text-sm text-blue-100">
                Track openings, find courses in plain English, and audit your MS CS degree.
              </p>
            </div>
          </div>
          <div className="hidden shrink-0 text-right sm:block">
            <p className="text-xs text-blue-200">{email}</p>
            <button
              onClick={signOut}
              className="mt-1 rounded-md bg-white/15 px-3 py-1 text-xs font-medium text-white transition hover:bg-white/25"
            >
              Sign out
            </button>
          </div>
        </div>
      </header>

      <nav className="mb-6 flex gap-1.5 rounded-xl bg-white/70 p-1.5 shadow-sm ring-1 ring-slate-200 backdrop-blur">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex-1 rounded-lg px-4 py-2 text-sm font-medium transition-all ${
              tab === t.id ? "bg-sjsu-blue text-white shadow" : "text-slate-600 hover:bg-slate-100"
            }`}
          >
            <span className="mr-1.5">{t.icon}</span>
            <span className="hidden sm:inline">{t.label}</span>
          </button>
        ))}
      </nav>

      <div key={tab} className="animate-fade-in">
        {tab === "tracker" && <CourseTracker />}
        {tab === "search" && <SmartSearch />}
        {tab === "audit" && <DegreeAudit />}
      </div>

      <footer className="mt-10 text-center text-xs text-slate-400">
        Uses SJSU&apos;s public class search · not affiliated with SJSU · verify before enrolling
      </footer>
    </main>
  );
}

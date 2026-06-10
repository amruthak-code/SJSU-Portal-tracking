"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Spinner } from "@/components/ui";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function signIn(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
      });
      if (error) throw error;
      setSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not send link");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-4">
      <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-lg">
        <div className="mb-6 text-center">
          <div className="text-4xl">🎓</div>
          <h1 className="mt-2 text-2xl font-bold text-sjsu-blue">SJSU Course Seat Tracker</h1>
          <p className="mt-1 text-sm text-slate-500">Sign in with a magic link — no password.</p>
        </div>

        {sent ? (
          <div className="rounded-xl bg-green-50 p-4 text-center text-sm text-green-800">
            ✉️ Check <strong>{email}</strong> for a sign-in link. You can close this tab after
            clicking it.
          </div>
        ) : (
          <form onSubmit={signIn} className="space-y-3">
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@sjsu.edu"
              className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm focus:border-sjsu-blue focus:outline-none focus:ring-2 focus:ring-sjsu-blue/20"
            />
            <button
              type="submit"
              disabled={loading || !email}
              className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-sjsu-blue px-4 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-blue-800 disabled:opacity-50"
            >
              {loading && <Spinner />}
              {loading ? "Sending…" : "Send magic link"}
            </button>
            {error && <p className="text-center text-sm text-red-600">{error}</p>}
          </form>
        )}
      </div>
      <p className="mt-4 text-center text-xs text-slate-400">
        We email you a one-time sign-in link. No passwords are ever stored.
      </p>
    </main>
  );
}

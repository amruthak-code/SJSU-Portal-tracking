import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function authed(req: Request) {
  return req.headers.get("x-cron-secret") === process.env.CRON_SECRET;
}

// GET /api/internal/tracked — ALL users' tracked courses + their email, for the
// scraper. Protected by the shared CRON_SECRET; uses the service role (no RLS).
export async function GET(req: Request) {
  if (!authed(req)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const admin = createAdminClient();
  const { data: courses, error } = await admin
    .from("tracked_courses")
    .select("id, user_id, class_number, subject, label, term, status");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Attach each course owner's email (two-step join).
  const ids = [...new Set((courses ?? []).map((c) => c.user_id))];
  const emailById: Record<string, string> = {};
  if (ids.length) {
    const { data: profiles } = await admin.from("profiles").select("id, email").in("id", ids);
    for (const p of profiles ?? []) emailById[p.id] = p.email;
  }

  const out = (courses ?? []).map((c) => ({
    id: c.id,
    classNumber: c.class_number,
    subject: c.subject,
    label: c.label,
    term: c.term,
    status: c.status,
    email: emailById[c.user_id] ?? null,
  }));
  return NextResponse.json({ courses: out });
}

import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function authed(req: Request) {
  return req.headers.get("x-cron-secret") === process.env.CRON_SECRET;
}

// POST /api/internal/status — scraper writes back statuses.
// body: { updates: [{ id, status, seats, checkedAt }] }
export async function POST(req: Request) {
  if (!authed(req)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const updates: any[] = Array.isArray(body.updates) ? body.updates : [];
  const admin = createAdminClient();

  let updated = 0;
  for (const u of updates) {
    if (!u.id) continue;
    const { error } = await admin
      .from("tracked_courses")
      .update({
        status: u.status ?? "Unknown",
        seats: u.seats ?? null,
        checked_at: u.checkedAt ?? new Date().toISOString(),
      })
      .eq("id", u.id);
    if (!error) updated++;
  }
  return NextResponse.json({ updated });
}

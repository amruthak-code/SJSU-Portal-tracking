import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function authed(req: Request) {
  return req.headers.get("x-cron-secret") === process.env.CRON_SECRET;
}

// POST /api/internal/catalog — replace the live catalog (Smart Search data).
// body: { term, courses: [{ classNumber, code, title, section, daysTime, instructor, status, career }] }
export async function POST(req: Request) {
  if (!authed(req)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const term = String(body.term || "");
  const courses: any[] = Array.isArray(body.courses) ? body.courses : [];
  const admin = createAdminClient();

  const rows = courses
    .filter((c) => c.classNumber)
    .map((c) => ({
      class_number: String(c.classNumber),
      code: c.code ?? null,
      title: c.title ?? null,
      section: c.section ?? null,
      days_time: c.daysTime ?? null,
      instructor: c.instructor ?? null,
      status: c.status ?? null,
      career: c.career ?? null,
      term,
      updated_at: new Date().toISOString(),
    }));

  // Replace the whole catalog (fresh snapshot).
  const { error: delErr } = await admin.from("catalog").delete().neq("class_number", "");
  if (delErr) return NextResponse.json({ error: delErr.message }, { status: 500 });

  if (rows.length) {
    const { error: insErr } = await admin.from("catalog").insert(rows);
    if (insErr) return NextResponse.json({ error: insErr.message }, { status: 500 });
  }
  return NextResponse.json({ count: rows.length });
}

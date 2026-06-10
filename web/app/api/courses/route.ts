import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DEFAULT_TERM = "Fall 2026";

function rowToCourse(r: any) {
  return {
    id: r.id,
    classNumber: r.class_number,
    subject: r.subject,
    label: r.label,
    term: r.term,
    status: r.status,
    seats: r.seats,
    checkedAt: r.checked_at,
  };
}

// GET /api/courses — the signed-in user's tracked courses (RLS-scoped).
export async function GET() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const { data, error } = await supabase
    .from("tracked_courses")
    .select("*")
    .order("created_at", { ascending: true });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const courses = (data ?? []).map(rowToCourse);
  const lastRun = courses.reduce<string | null>(
    (max, c) => (c.checkedAt && (!max || c.checkedAt > max) ? c.checkedAt : max),
    null
  );
  return NextResponse.json({ term: DEFAULT_TERM, courses, lastRun });
}

// POST /api/courses — add a course   body: { classNumber, label?, subject?, term? }
export async function POST(req: Request) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const classNumber = String(body.classNumber || "").trim();
  if (!/^\d{4,6}$/.test(classNumber)) {
    return NextResponse.json(
      { error: "classNumber must be a 4–6 digit SJSU class number." },
      { status: 400 }
    );
  }
  const label = String(body.label || "").trim() || `Class ${classNumber}`;
  // Subject: explicit, else parse leading letters from the label (e.g. "CS 218").
  const subject =
    String(body.subject || "").trim().toUpperCase() ||
    (label.match(/^\s*([A-Za-z]{2,4})/)?.[1] || "").toUpperCase() ||
    null;
  const term = String(body.term || DEFAULT_TERM).trim();

  const { error } = await supabase.from("tracked_courses").insert({
    user_id: user.id,
    class_number: classNumber,
    subject,
    label,
    term,
    status: "Unknown",
  });
  if (error) {
    const conflict = error.code === "23505";
    return NextResponse.json(
      { error: conflict ? "Already tracking that class." : error.message },
      { status: conflict ? 409 : 500 }
    );
  }

  const { data } = await supabase
    .from("tracked_courses")
    .select("*")
    .order("created_at", { ascending: true });
  return NextResponse.json({ term: DEFAULT_TERM, courses: (data ?? []).map(rowToCourse) }, { status: 201 });
}

// DELETE /api/courses?classNumber=12345
export async function DELETE(req: Request) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const classNumber = searchParams.get("classNumber");
  if (!classNumber) return NextResponse.json({ error: "classNumber required" }, { status: 400 });

  const { error } = await supabase
    .from("tracked_courses")
    .delete()
    .eq("class_number", classNumber);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const { data } = await supabase
    .from("tracked_courses")
    .select("*")
    .order("created_at", { ascending: true });
  return NextResponse.json({ term: DEFAULT_TERM, courses: (data ?? []).map(rowToCourse) });
}

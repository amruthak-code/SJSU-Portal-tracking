import { NextResponse } from "next/server";
import { readCourses, writeCourses, type TrackedCourse } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/courses — list tracked courses + term
export async function GET() {
  const data = await readCourses();
  return NextResponse.json(data);
}

// POST /api/courses — add a course   body: { classNumber, label? }
export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const classNumber = String(body.classNumber || "").trim();
  if (!/^\d{4,6}$/.test(classNumber)) {
    return NextResponse.json(
      { error: "classNumber must be a 4–6 digit SJSU class number." },
      { status: 400 }
    );
  }
  const data = await readCourses();
  if (data.courses.some((c) => c.classNumber === classNumber)) {
    return NextResponse.json({ error: "Already tracking that class." }, { status: 409 });
  }
  const course: TrackedCourse = {
    classNumber,
    label: String(body.label || "").trim() || `Class ${classNumber}`,
    addedAt: new Date().toISOString(),
  };
  data.courses.push(course);
  await writeCourses(data);
  return NextResponse.json(data, { status: 201 });
}

// DELETE /api/courses?classNumber=12345
export async function DELETE(req: Request) {
  const { searchParams } = new URL(req.url);
  const classNumber = searchParams.get("classNumber");
  if (!classNumber) {
    return NextResponse.json({ error: "classNumber required" }, { status: 400 });
  }
  const data = await readCourses();
  data.courses = data.courses.filter((c) => c.classNumber !== classNumber);
  await writeCourses(data);
  return NextResponse.json(data);
}

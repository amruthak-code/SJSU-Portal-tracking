import { NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";
import { SAMPLE_COURSES } from "@/lib/sampleCourses";
import { readCatalog } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Lite model, thinking disabled (thinkingBudget: 0).
const MODEL = "gemini-2.5-flash-lite";

// POST /api/search   body: { query: string }
// Grounds GPT/Gemini recommendations in the LIVE catalog (catalog.json) when
// available, otherwise falls back to the hardcoded sample list.
export async function POST(req: Request) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "GEMINI_API_KEY is not set on the server." },
      { status: 500 }
    );
  }

  const { query } = await req.json().catch(() => ({ query: "" }));
  if (!query || !String(query).trim()) {
    return NextResponse.json({ error: "query is required" }, { status: 400 });
  }

  // Prefer the live catalog (real sections + Open/Full/Waitlist).
  const catalog = await readCatalog();
  const usingLive = !!catalog;
  const courseList = catalog
    ? catalog.courses.map((c) => ({
        code: c.code,
        title: c.title,
        section: c.section,
        days: c.daysTime,
        instructor: c.instructor,
        status: c.status,
        classNumber: c.classNumber,
      }))
    : SAMPLE_COURSES.map((c) => ({
        code: c.code,
        title: c.title,
        section: "",
        days: c.days,
        instructor: c.instructor,
        status: "Unknown",
        classNumber: "",
      }));

  const ai = new GoogleGenAI({ apiKey });

  const system =
    "You are an SJSU academic advising assistant. Recommend courses ONLY from " +
    "the provided course list (do not invent courses). Each course has a live " +
    "enrollment status: Open, Waitlist, or Full. Respect all constraints in the " +
    "request: day of week, time of day, level, topic, and avoiding conflicts with " +
    "named courses. If the user asks for 'open' or 'available' sections, ONLY " +
    "recommend ones with status Open. Otherwise you may include Waitlist/Full but " +
    "clearly note their status. For each pick, explain briefly why it fits and flag " +
    "anything to double-check.\n\n" +
    "Respond with ONLY a JSON object in exactly this shape (no markdown):\n" +
    `{
  "recommendations": [
    { "code": "", "title": "", "days": "", "time": "", "instructor": "", "status": "", "reason": "", "cautions": "" }
  ],
  "summary": ""
}`;

  const userContent =
    `Student request: "${query}"\n\n` +
    (usingLive
      ? `LIVE course list for ${catalog!.term} (generated ${catalog!.generatedAt}):\n`
      : `Sample course list (live data unavailable — note this to the user):\n`) +
    JSON.stringify(courseList, null, 2);

  try {
    const response = await ai.models.generateContent({
      model: MODEL,
      contents: userContent,
      config: {
        systemInstruction: system,
        responseMimeType: "application/json",
        thinkingConfig: { thinkingBudget: 0 },
      },
    });
    const text = response.text ?? "{}";
    const parsed = JSON.parse(text);
    return NextResponse.json({
      ...parsed,
      live: usingLive,
      generatedAt: catalog?.generatedAt ?? null,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: `Gemini request failed: ${message}` }, { status: 502 });
  }
}

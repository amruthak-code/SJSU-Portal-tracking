import { NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";
import { MS_CS_REQUIREMENTS, MS_CS_TOTAL_UNITS } from "@/lib/msCsRequirements";
import { SAMPLE_COURSES } from "@/lib/sampleCourses";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Lite model, thinking disabled (thinkingBudget: 0).
const MODEL = "gemini-2.5-flash-lite";

// POST /api/audit   body: { completed: string, major: string }
export async function POST(req: Request) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "GEMINI_API_KEY is not set on the server." },
      { status: 500 }
    );
  }

  const body = await req.json().catch(() => ({}));
  const completed = String(body.completed || "").trim();
  const major = String(body.major || "MS Computer Science").trim();
  if (!completed) {
    return NextResponse.json(
      { error: "Paste your completed courses first." },
      { status: 400 }
    );
  }

  const ai = new GoogleGenAI({ apiKey });

  const system =
    "You are an SJSU graduate advising assistant for the MS in Computer Science. " +
    "Use ONLY the provided degree-requirement structure as the source of truth for " +
    "what is required. Match the student's completed courses against each requirement, " +
    "compute remaining units, and suggest specific courses for unmet requirements, " +
    "preferring courses from the provided 'available this semester' list when relevant. " +
    "Be precise and do not invent requirements. Include a short disclaimer that this is " +
    "an unofficial estimate and the student should confirm with their advisor.\n\n" +
    "status must be one of: \"satisfied\", \"in-progress\", \"not-started\".\n" +
    "All array fields (satisfiedBy, suggestions, recommendedThisSemester) must be " +
    "arrays of PLAIN STRINGS like \"CS 235 - Computer Security\", never objects.\n" +
    "Respond with ONLY a JSON object in exactly this shape (no markdown, no extra text):\n" +
    `{
  "requirements": [
    { "name": "", "status": "", "unitsRequired": 0, "unitsCompleted": 0,
      "satisfiedBy": ["CS 200W"], "suggestions": ["CS 235 - Computer Security"] }
  ],
  "totalUnitsCompleted": 0,
  "totalUnitsRemaining": 0,
  "recommendedThisSemester": ["CS 256 - Topics in Artificial Intelligence"],
  "disclaimer": ""
}`;

  const userContent =
    `Major: ${major}\n` +
    `Total units required: ${MS_CS_TOTAL_UNITS}\n\n` +
    `Degree requirements (source of truth, JSON):\n${JSON.stringify(MS_CS_REQUIREMENTS, null, 2)}\n\n` +
    `Courses available this semester (JSON):\n${JSON.stringify(
      SAMPLE_COURSES.filter((c) => c.level === "graduate"),
      null,
      2
    )}\n\n` +
    `Student's completed courses (free text):\n${completed}`;

  try {
    const response = await ai.models.generateContent({
      model: MODEL,
      contents: userContent,
      config: {
        systemInstruction: system,
        responseMimeType: "application/json",
        thinkingConfig: { thinkingBudget: 0 }, // thinking OFF
      },
    });

    const text = response.text ?? "{}";
    return NextResponse.json(JSON.parse(text));
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: `Gemini request failed: ${message}` }, { status: 502 });
  }
}

import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { MS_CS_REQUIREMENTS, MS_CS_TOTAL_UNITS } from "@/lib/msCsRequirements";
import { SAMPLE_COURSES } from "@/lib/sampleCourses";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// POST /api/audit   body: { completed: string, major: string }
export async function POST(req: Request) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "ANTHROPIC_API_KEY is not set on the server." },
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

  const client = new Anthropic({ apiKey });

  const system =
    "You are an SJSU graduate advising assistant for the MS in Computer Science. " +
    "Use ONLY the provided degree-requirement structure as the source of truth for " +
    "what is required. Match the student's completed courses against each requirement, " +
    "compute remaining units, and suggest specific courses for unmet requirements, " +
    "preferring courses from the provided 'available this semester' list when relevant. " +
    "Be precise and do not invent requirements. Add a short disclaimer that this is " +
    "an unofficial estimate and the student should confirm with their advisor.";

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
    const response = await client.messages.create({
      model: "claude-opus-4-8",
      max_tokens: 16000,
      thinking: { type: "adaptive" },
      output_config: {
        effort: "high",
        format: {
          type: "json_schema",
          schema: {
            type: "object",
            properties: {
              requirements: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    name: { type: "string" },
                    status: {
                      type: "string",
                      enum: ["satisfied", "in-progress", "not-started"],
                    },
                    unitsRequired: { type: "number" },
                    unitsCompleted: { type: "number" },
                    satisfiedBy: { type: "array", items: { type: "string" } },
                    suggestions: { type: "array", items: { type: "string" } },
                  },
                  required: [
                    "name",
                    "status",
                    "unitsRequired",
                    "unitsCompleted",
                    "satisfiedBy",
                    "suggestions",
                  ],
                  additionalProperties: false,
                },
              },
              totalUnitsCompleted: { type: "number" },
              totalUnitsRemaining: { type: "number" },
              recommendedThisSemester: { type: "array", items: { type: "string" } },
              disclaimer: { type: "string" },
            },
            required: [
              "requirements",
              "totalUnitsCompleted",
              "totalUnitsRemaining",
              "recommendedThisSemester",
              "disclaimer",
            ],
            additionalProperties: false,
          },
        },
      },
      system,
      messages: [{ role: "user", content: userContent }],
    });

    const textBlock = response.content.find((b) => b.type === "text");
    const parsed = textBlock && "text" in textBlock ? JSON.parse(textBlock.text) : {};
    return NextResponse.json(parsed);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: `Claude request failed: ${message}` }, { status: 502 });
  }
}

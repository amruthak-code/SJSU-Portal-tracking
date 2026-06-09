import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { SAMPLE_COURSES } from "@/lib/sampleCourses";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// POST /api/search   body: { query: string }
// Returns Claude recommendations grounded in SAMPLE_COURSES.
export async function POST(req: Request) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "ANTHROPIC_API_KEY is not set on the server." },
      { status: 500 }
    );
  }

  const { query } = await req.json().catch(() => ({ query: "" }));
  if (!query || !String(query).trim()) {
    return NextResponse.json({ error: "query is required" }, { status: 400 });
  }

  const client = new Anthropic({ apiKey });

  const system =
    "You are an SJSU academic advising assistant. Recommend courses ONLY from " +
    "the provided course catalog (do not invent courses). Carefully respect any " +
    "constraints in the student's request: day of week, time of day, course level, " +
    "topic area, and avoiding time conflicts with named courses. For each " +
    "recommendation explain briefly why it fits, and flag anything the student " +
    "should double-check (e.g. prerequisites or possible conflicts).";

  const userContent =
    `Student request: "${query}"\n\n` +
    `Available courses (JSON):\n${JSON.stringify(SAMPLE_COURSES, null, 2)}`;

  try {
    const response = await client.messages.create({
      model: "claude-opus-4-8",
      max_tokens: 16000,
      thinking: { type: "adaptive" },
      output_config: {
        effort: "medium",
        format: {
          type: "json_schema",
          schema: {
            type: "object",
            properties: {
              recommendations: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    code: { type: "string" },
                    title: { type: "string" },
                    days: { type: "string" },
                    time: { type: "string" },
                    instructor: { type: "string" },
                    reason: { type: "string" },
                    cautions: { type: "string" },
                  },
                  required: [
                    "code",
                    "title",
                    "days",
                    "time",
                    "instructor",
                    "reason",
                    "cautions",
                  ],
                  additionalProperties: false,
                },
              },
              summary: { type: "string" },
            },
            required: ["recommendations", "summary"],
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

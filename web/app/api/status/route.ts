import { NextResponse } from "next/server";
import { readStatus } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/status — latest scraper results (written by the GitHub Action)
export async function GET() {
  const data = await readStatus();
  return NextResponse.json(data);
}

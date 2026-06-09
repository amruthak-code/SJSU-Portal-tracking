import { NextResponse } from "next/server";
import { spawn } from "child_process";
import { existsSync } from "fs";
import path from "path";
import { readCatalog } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

// POST /api/refresh-catalog?subject=CS
// Runs scraper/build_catalog.py on demand to rebuild catalog.json with the
// latest real sections + Open/Full/Waitlist status. Local-only (needs the
// Python venv + Playwright that the scraper uses).
export async function POST(req: Request) {
  const { searchParams } = new URL(req.url);
  const subject = (searchParams.get("subject") || "CS").toUpperCase();

  const repoRoot = path.resolve(process.cwd(), "..");
  const scraperDir = path.join(repoRoot, "scraper");
  const venvPython = path.join(scraperDir, ".venv", "bin", "python");
  const python = existsSync(venvPython) ? venvPython : "python3";
  const script = path.join(scraperDir, "build_catalog.py");

  if (!existsSync(script)) {
    return NextResponse.json(
      { error: "build_catalog.py not found — is the scraper set up?" },
      { status: 500 }
    );
  }

  try {
    await new Promise<void>((resolve, reject) => {
      const proc = spawn(python, [script, subject], { cwd: scraperDir });
      let stderr = "";
      proc.stderr.on("data", (d) => (stderr += d.toString()));
      proc.on("error", reject);
      proc.on("close", (code) =>
        code === 0 ? resolve() : reject(new Error(stderr || `exited ${code}`))
      );
    });

    const catalog = await readCatalog();
    return NextResponse.json({
      ok: true,
      count: catalog?.courses.length ?? 0,
      generatedAt: catalog?.generatedAt ?? null,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json(
      { error: `Catalog refresh failed: ${message}` },
      { status: 500 }
    );
  }
}

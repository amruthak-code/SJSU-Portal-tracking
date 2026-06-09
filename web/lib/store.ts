import { promises as fs } from "fs";
import path from "path";

// courses.json and status_log.json live at the REPO ROOT (one level above web/),
// so they are shared between this app and the GitHub Action scraper.
// Override with DATA_DIR if you relocate them.
const DATA_DIR = process.env.DATA_DIR
  ? path.resolve(process.env.DATA_DIR)
  : path.resolve(process.cwd(), "..");

const COURSES_FILE = path.join(DATA_DIR, "courses.json");
const STATUS_FILE = path.join(DATA_DIR, "status_log.json");

export type TrackedCourse = {
  classNumber: string;
  label: string;
  addedAt: string;
};

export type CoursesData = {
  term: string;
  termCode?: string;
  courses: TrackedCourse[];
};

export type StatusResult = {
  status: "Open" | "Full" | "Waitlist" | "Unknown";
  seats: number | null;
  checkedAt: string;
  label?: string;
  term?: string;
};

export type StatusData = {
  lastRun: string | null;
  results: Record<string, StatusResult>;
};

export async function readCourses(): Promise<CoursesData> {
  try {
    const raw = await fs.readFile(COURSES_FILE, "utf-8");
    return JSON.parse(raw);
  } catch {
    return { term: "Fall 2026", courses: [] };
  }
}

export async function writeCourses(data: CoursesData): Promise<void> {
  await fs.writeFile(COURSES_FILE, JSON.stringify(data, null, 2) + "\n", "utf-8");
}

export async function readStatus(): Promise<StatusData> {
  try {
    const raw = await fs.readFile(STATUS_FILE, "utf-8");
    return JSON.parse(raw);
  } catch {
    return { lastRun: null, results: {} };
  }
}

// SJSU MS in Computer Science — degree requirements (33 units total).
// This is a structured, hardcoded reference so the Degree Audit is accurate:
// Claude matches the student's completed courses against THIS list rather than
// guessing requirements from general knowledge.
//
// Source: SJSU Graduate Catalog (MS Computer Science). Verify against the
// catalog for your catalog year — requirements occasionally change.

export type Requirement = {
  id: string;
  name: string;
  units: number;
  description: string;
  // Specific course codes that satisfy this requirement, when applicable.
  // Empty array means "any qualifying graduate CS elective".
  satisfyingCourses: string[];
};

export const MS_CS_TOTAL_UNITS = 33;

export const MS_CS_REQUIREMENTS: Requirement[] = [
  {
    id: "writing",
    name: "Graduate Writing Requirement",
    units: 3,
    description:
      "CS 200W — Master's Writing Workshop. Required of all MS CS students.",
    satisfyingCourses: ["CS 200W"],
  },
  {
    id: "core-algorithms",
    name: "Core: Algorithms",
    units: 3,
    description: "Advanced algorithms core requirement.",
    satisfyingCourses: ["CS 218"],
  },
  {
    id: "core-foundations",
    name: "Core: Systems / Foundations",
    units: 6,
    description:
      "Two foundational graduate courses (e.g. databases, security, operating systems, networks).",
    satisfyingCourses: ["CS 235", "CS 249", "CS 247", "CS 158"],
  },
  {
    id: "electives",
    name: "Graduate CS Electives",
    units: 12,
    description:
      "Four approved graduate CS electives (200-level). AI/ML/vision/NLP courses count here.",
    satisfyingCourses: [
      "CS 256",
      "CS 271",
      "CS 274",
      "CS 286",
      "CS 255",
      "CS 257",
      "CS 244",
    ],
  },
  {
    id: "culminating",
    name: "Culminating Experience",
    units: 6,
    description:
      "Master's Project (CS 297 + CS 298) or Master's Thesis (CS 299A + CS 299B).",
    satisfyingCourses: ["CS 297", "CS 298", "CS 299A", "CS 299B"],
  },
];

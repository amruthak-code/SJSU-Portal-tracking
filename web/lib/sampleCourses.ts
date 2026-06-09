// A small, hardcoded sample of SJSU Computer Science courses used to ground the
// Smart Course Search. These are illustrative (titles/days/times are typical but
// not authoritative — verify against the official schedule before enrolling).
// Expand this list freely; the Claude prompt uses it as the candidate pool.

export type SampleCourse = {
  code: string;
  title: string;
  units: number;
  level: "undergraduate" | "graduate";
  days: string; // e.g. "Tue", "Mon/Wed", "Online"
  time: string; // e.g. "2:00 PM - 3:15 PM" or "Async"
  instructor: string;
  description: string;
};

export const SAMPLE_COURSES: SampleCourse[] = [
  {
    code: "CS 146",
    title: "Data Structures and Algorithms",
    units: 3,
    level: "undergraduate",
    days: "Mon/Wed",
    time: "12:00 PM - 1:15 PM",
    instructor: "Dr. Mike Wu",
    description: "Trees, graphs, sorting, complexity analysis.",
  },
  {
    code: "CS 151",
    title: "Object-Oriented Design",
    units: 3,
    level: "undergraduate",
    days: "Tue/Thu",
    time: "9:00 AM - 10:15 AM",
    instructor: "Dr. Kim Nguyen",
    description: "Design patterns, OOP principles in Java.",
  },
  {
    code: "CS 174",
    title: "Server-side Web Programming",
    units: 3,
    level: "undergraduate",
    days: "Wed",
    time: "6:00 PM - 8:45 PM",
    instructor: "Dr. Ron Mak",
    description: "Node.js, REST APIs, databases.",
  },
  {
    code: "CS 175",
    title: "Mobile Application Development",
    units: 3,
    level: "undergraduate",
    days: "Tue/Thu",
    time: "3:00 PM - 4:15 PM",
    instructor: "Dr. Kaung Htet",
    description: "Android/iOS app development.",
  },
  {
    code: "CS 185C",
    title: "Topics in Data Science",
    units: 3,
    level: "undergraduate",
    days: "Mon/Wed",
    time: "4:30 PM - 5:45 PM",
    instructor: "Dr. Gheorghi Guzun",
    description: "Applied data science, pandas, ML pipelines.",
  },
  {
    code: "CS 200W",
    title: "Master's Writing Workshop",
    units: 3,
    level: "graduate",
    days: "Thu",
    time: "6:00 PM - 8:45 PM",
    instructor: "Dr. Robert Chun",
    description: "Technical writing for graduate students (required).",
  },
  {
    code: "CS 218",
    title: "Design and Analysis of Algorithms",
    units: 3,
    level: "graduate",
    days: "Mon/Wed",
    time: "2:00 PM - 3:15 PM",
    instructor: "Dr. Katerina Potika",
    description: "Advanced algorithm design, NP-completeness.",
  },
  {
    code: "CS 235",
    title: "Computer Security",
    units: 3,
    level: "graduate",
    days: "Tue",
    time: "6:00 PM - 8:45 PM",
    instructor: "Dr. Fabio Di Troia",
    description: "Cryptography, network and system security.",
  },
  {
    code: "CS 249",
    title: "Database System Principles",
    units: 3,
    level: "graduate",
    days: "Wed",
    time: "6:00 PM - 8:45 PM",
    instructor: "Dr. Suneuy Kim",
    description: "Query processing, transactions, NoSQL.",
  },
  {
    code: "CS 256",
    title: "Topics in Artificial Intelligence",
    units: 3,
    level: "graduate",
    days: "Tue/Thu",
    time: "1:30 PM - 2:45 PM",
    instructor: "Dr. Mashhour Solh",
    description: "Search, knowledge representation, ML foundations.",
  },
  {
    code: "CS 271",
    title: "Topics in Machine Learning",
    units: 3,
    level: "graduate",
    days: "Mon/Wed",
    time: "3:00 PM - 4:15 PM",
    instructor: "Dr. Jorjeta Jetcheva",
    description: "Supervised/unsupervised learning, neural networks.",
  },
  {
    code: "CS 274",
    title: "Computer Vision",
    units: 3,
    level: "graduate",
    days: "Thu",
    time: "6:00 PM - 8:45 PM",
    instructor: "Dr. Wendy Lee",
    description: "Image processing, deep learning for vision.",
  },
  {
    code: "CS 286",
    title: "Natural Language Processing",
    units: 3,
    level: "graduate",
    days: "Tue/Thu",
    time: "4:30 PM - 5:45 PM",
    instructor: "Dr. Genya Ishigaki",
    description: "Language models, transformers, NLP applications.",
  },
  {
    code: "CS 297",
    title: "Master's Project Preparation",
    units: 3,
    level: "graduate",
    days: "Online",
    time: "Async",
    instructor: "Various",
    description: "Project proposal and literature review (culminating).",
  },
];

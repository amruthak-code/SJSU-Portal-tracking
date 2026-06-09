import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "SJSU Course Seat Tracker",
  description: "Track seats, find courses, and audit your degree.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}

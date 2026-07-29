import type { Metadata } from "next";
import CoachChat from "./CoachChat";

export const metadata: Metadata = { title: "Coach" };

export default function CoachPage() {
  const configured = Boolean(process.env.ANTHROPIC_API_KEY && process.env.COACH_SECRET);
  return <CoachChat configured={configured} />;
}

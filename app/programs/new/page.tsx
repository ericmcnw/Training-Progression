// Create a program. Same form as /focus/new — the schema noun is Focus, the
// word you read is Program.

import Link from "next/link";
import { prisma } from "@/lib/prisma";
import ProgramCreator from "./ProgramCreator";
import { getProgramAssessmentSuggestions } from "@/app/programs/assessment-suggestions";

export const dynamic = "force-dynamic";

export default async function NewProgramPage() {
  const [routines, exercises, injuries, assessmentSuggestions] = await Promise.all([
    prisma.routine.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    prisma.exercise.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true, unit: true, supportsWeight: true, supportsSports: true },
    }),
    prisma.activeInjury.findMany({
      where: { status: { in: ["ACTIVE", "FLARED"] } },
      orderBy: { startedAt: "desc" },
      select: { id: true, name: true },
    }),
    getProgramAssessmentSuggestions(),
  ]);

  return (
    <main style={page} className="focusForm">
      <div style={topBar}>
        <Link href="/programs" style={backLink}>← Programs</Link>
      </div>
      <h1 style={title}>New program</h1>
      <p style={blurb}>
          Define the foundation first. Then continue through training inputs,
          stages, blocks, scheduling, and named targets.
      </p>
      <ProgramCreator routines={routines} exercises={exercises} injuries={injuries} assessmentSuggestions={assessmentSuggestions} />
      <style>{`
        .focusForm { --edge: clamp(14px, 4vw, 28px); }
        @media (max-width: 720px) { .focusForm { --edge: 14px; } }
      `}</style>
    </main>
  );
}

const page = { width: "100%", minWidth: 0, maxWidth: 1180, margin: "0 auto", padding: "16px var(--edge) 96px", boxSizing: "border-box", display: "grid", gridTemplateColumns: "minmax(0, 1fr)", gap: 16 } as const;
const topBar = { display: "flex", alignItems: "center", justifyContent: "space-between" } as const;
const backLink = { fontSize: 13, fontWeight: 800, color: "rgba(255,255,255,0.6)", textDecoration: "none" } as const;
const title = { fontSize: 22, fontWeight: 900, margin: 0, color: "rgba(255,255,255,0.95)" } as const;
const blurb = { fontSize: 13, lineHeight: 1.5, color: "rgba(255,255,255,0.6)", margin: 0 } as const;

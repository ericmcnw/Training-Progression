// Create a program. Same form as /focus/new — the schema noun is Focus, the
// word you read is Program.

import Link from "next/link";
import { prisma } from "@/lib/prisma";
import ProgramCreator from "./ProgramCreator";

export const dynamic = "force-dynamic";

export default async function NewProgramPage() {
  const [routines, goals, frequencyGoals, exercises, injuries, tickListCount, climbingProjects, climbingLocations] = await Promise.all([
    prisma.routine.findMany({
      where: { isActive: true, isDeleted: false, isPlaceholder: false },
      orderBy: { name: "asc" },
      select: { id: true, name: true, kind: true, domain: true },
    }),
    prisma.goal.findMany({ where: { isActive: true }, orderBy: { name: "asc" }, select: { id: true, name: true, goalType: true } }),
    prisma.frequencyGoal.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true, targetCount: true, targetInterval: true, targetUnit: true },
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
    prisma.climbProblem.count({ where: { onTickList: true } }),
    prisma.climbProblem.findMany({
      where: {
        attempts: { some: { outcome: { in: ["PROJECT", "FELL"] } } },
        NOT: { attempts: { some: { outcome: { in: ["FLASH", "ONSIGHT", "SEND", "REDPOINT"] } } } },
      },
      orderBy: { updatedAt: "desc" },
      select: { id: true, name: true, grade: true, gradeSystem: true, onTickList: true, location: { select: { name: true } } },
    }),
    prisma.climbLocation.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true, type: true } }),
  ]);

  return (
    <main style={page} className="focusForm">
      <div style={topBar}>
        <Link href="/programs" style={backLink}>← Programs</Link>
      </div>
      <h1 style={title}>New program</h1>
      <p style={blurb}>
          Set the purpose, the work you&rsquo;ll do, and how you&rsquo;ll measure it.
          Stages, blocks, scheduling, and named targets come next.
      </p>
      <ProgramCreator
        routines={routines}
        goals={goals}
        frequencyGoals={frequencyGoals}
        exercises={exercises}
        injuries={injuries}
        tickListCount={tickListCount}
        climbingProjects={climbingProjects}
        climbingLocations={climbingLocations}
      />
      <style>{`
        .focusForm { --edge: clamp(14px, 4vw, 28px); }
        @media (max-width: 720px) { .focusForm { --edge: 14px; } }
      `}</style>
    </main>
  );
}

const page = { width: "100%", minWidth: 0, maxWidth: "var(--app-width-wide)", margin: "0 auto", padding: "16px var(--edge) 96px", boxSizing: "border-box", display: "grid", gridTemplateColumns: "minmax(0, 1fr)", gap: 16 } as const;
const topBar = { display: "flex", alignItems: "center", justifyContent: "space-between" } as const;
const backLink = { fontSize: 13, fontWeight: 800, color: "rgba(255,255,255,0.6)", textDecoration: "none" } as const;
const title = { fontSize: 22, fontWeight: 900, margin: 0, color: "rgba(255,255,255,0.95)" } as const;
const blurb = { fontSize: 13, lineHeight: 1.5, color: "rgba(255,255,255,0.6)", margin: 0 } as const;

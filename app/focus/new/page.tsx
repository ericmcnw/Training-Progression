// Create a new focus. Server component loads the routine/exercise pick lists,
// then renders the shared FocusForm in create mode.

import Link from "next/link";
import { prisma } from "@/lib/prisma";
import FocusForm from "@/app/focus/FocusForm";

export const dynamic = "force-dynamic";

export default async function NewFocusPage() {
  const [routines, exercises] = await Promise.all([
    prisma.routine.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    prisma.exercise.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
  ]);

  return (
    <main style={page} className="focusForm">
      <div style={topBar}>
        <Link href="/" style={backLink}>← Home</Link>
      </div>
      <h1 style={title}>New focus</h1>
      <FocusForm
        initial={{ name: "", description: "", icon: "", color: "#84cc78", status: "ACTIVE", targetDate: "", targetKind: "SOFT", milestones: [] }}
        routines={routines}
        exercises={exercises}
      />
      <style>{`
        .focusForm { --edge: clamp(14px, 4vw, 28px); }
        @media (max-width: 720px) { .focusForm { --edge: 14px; } }
      `}</style>
    </main>
  );
}

const page = { maxWidth: 640, margin: "0 auto", padding: "16px var(--edge) 96px", display: "grid", gap: 16 } as const;
const topBar = { display: "flex", alignItems: "center", justifyContent: "space-between" } as const;
const backLink = { fontSize: 13, fontWeight: 800, color: "rgba(255,255,255,0.6)", textDecoration: "none" } as const;
const title = { fontSize: 22, fontWeight: 900, margin: 0, color: "rgba(255,255,255,0.95)" } as const;

// Edit an existing focus. Loads the focus's fields + milestones (flattened
// from tracks back into an ordered form list) and the pick lists, then renders
// the shared FocusForm in edit mode.

import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import FocusForm from "@/app/focus/FocusForm";
import type { FocusStatus } from "@/generated/prisma";

export const dynamic = "force-dynamic";

export default async function EditFocusPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const [focus, milestones, routines, exercises] = await Promise.all([
    prisma.focus.findUnique({
      where: { id },
      select: { id: true, name: true, description: true, icon: true, color: true, status: true, targetDate: true, targetKind: true, season: true, phase: true, handoffNote: true },
    }),
    prisma.progressionMilestone.findMany({
      where: { ownerKind: "FOCUS", ownerId: id },
      orderBy: { sortOrder: "asc" },
      select: {
        id: true, scopeKind: true, scopeRef: true, label: true, targetText: true, estDurationDays: true,
        gateKind: true, gateNote: true, gatePainThreshold: true, gatePainDays: true,
      },
    }),
    prisma.routine.findMany({ where: { isActive: true }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
    prisma.exercise.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ]);
  if (!focus) notFound();

  return (
    <main style={page} className="focusForm">
      <div style={topBar}>
        <Link href={`/focus/${id}`} style={backLink}>← Back</Link>
      </div>
      <h1 style={title}>Edit focus</h1>
      <FocusForm
        initial={{
          id: focus.id,
          name: focus.name,
          description: focus.description ?? "",
          icon: focus.icon ?? "",
          color: focus.color ?? "#84cc78",
          status: focus.status as FocusStatus,
          targetDate: focus.targetDate ? focus.targetDate.toISOString().slice(0, 10) : "",
          targetKind: focus.targetKind as "SOFT" | "HARD",
          season: focus.season ?? "",
          phase: (focus.phase ?? "") as "" | "BUILD" | "PEAK" | "OFFSEASON" | "MAINTAIN",
          handoffNote: focus.handoffNote ?? "",
          milestones: milestones.map((m) => ({
            id: m.id,
            scopeKind: m.scopeKind,
            scopeRef: m.scopeRef,
            label: m.label,
            targetText: m.targetText,
            estDurationDays: m.estDurationDays,
            gateKind: m.gateKind,
            gateNote: m.gateNote,
            gatePainThreshold: m.gatePainThreshold,
            gatePainDays: m.gatePainDays,
          })),
        }}
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

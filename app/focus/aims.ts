// Aim resolution — the keystone of the Focus layer. For a set of routines,
// find each one's "current aim": the label of the first ACTIVE milestone
// scoped to that routine. This is what surfaces in the Week-at-a-Glance next
// to a routine name ("Legs A · progress ham curls").
//
// A routine can be scoped by more than one roadmap (e.g. a Focus AND an injury
// path). Resolution: only ACTIVE focuses count; among the candidates, the
// highest-priority owner wins (lower Focus.sortOrder = higher priority; injury
// paths rank alongside the top focus), then the earliest ACTIVE milestone in
// that track. "Current" is derived, never stored.

import { prisma } from "@/lib/prisma";
import { getAppSession } from "@/lib/auth";

export type RoutineAim = {
  label: string;
  targetText: string | null;
  ownerKind: "FOCUS" | "INJURY";
};

// Injury-path aims rank alongside a top-priority focus. Rehab is usually the
// priority when a routine serves both, and it keeps the common single-owner
// case unambiguous.
// Injury-path aims outrank any focus when a routine serves both — rehab wins.
// Focus sortOrders trend negative (new focuses = min-1), so this must be below
// all of them.
const INJURY_PRIORITY = Number.NEGATIVE_INFINITY;

export async function getRoutineAims(
  routineIds: string[]
): Promise<Map<string, RoutineAim>> {
  const ids = Array.from(new Set(routineIds.filter(Boolean)));
  if (ids.length === 0) return new Map();
  const session = await getAppSession();

  const milestones = await prisma.progressionMilestone.findMany({
    where: {
      scopeKind: "ROUTINE",
      scopeRef: { in: ids },
      status: "ACTIVE",
    },
    select: {
      scopeRef: true,
      label: true,
      targetText: true,
      ownerKind: true,
      ownerId: true,
      sortOrder: true,
    },
    orderBy: { sortOrder: "asc" },
  });
  if (milestones.length === 0) return new Map();

  // Resolve the priority of each candidate. Focus-owned milestones only count
  // when their focus is ACTIVE; their priority is the focus's sortOrder.
  const focusIds = Array.from(
    new Set(milestones.filter((m) => m.ownerKind === "FOCUS").map((m) => m.ownerId))
  );
  const focuses = focusIds.length
    ? await prisma.focus.findMany({
        where: { id: { in: focusIds }, profileKey: session.profileKey },
        select: { id: true, status: true, sortOrder: true },
      })
    : [];
  const focusById = new Map(focuses.map((f) => [f.id, f]));

  // For each routine, keep the best candidate: lowest priority rank, then
  // earliest milestone sortOrder (milestones already arrive sorted).
  type Candidate = RoutineAim & { rank: number; order: number };
  const best = new Map<string, Candidate>();

  for (const m of milestones) {
    if (!m.scopeRef) continue;
    let rank: number;
    if (m.ownerKind === "FOCUS") {
      const focus = focusById.get(m.ownerId);
      if (!focus || focus.status !== "ACTIVE") continue; // dropped: inactive focus
      rank = focus.sortOrder;
    } else {
      rank = INJURY_PRIORITY;
    }
    const candidate: Candidate = {
      label: m.label,
      targetText: m.targetText,
      ownerKind: m.ownerKind,
      rank,
      order: m.sortOrder,
    };
    const current = best.get(m.scopeRef);
    if (
      !current ||
      candidate.rank < current.rank ||
      (candidate.rank === current.rank && candidate.order < current.order)
    ) {
      best.set(m.scopeRef, candidate);
    }
  }

  const result = new Map<string, RoutineAim>();
  for (const [routineId, c] of best) {
    result.set(routineId, { label: c.label, targetText: c.targetText, ownerKind: c.ownerKind });
  }
  return result;
}

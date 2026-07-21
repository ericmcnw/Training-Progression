"use server";

// Server actions for the Focus layer (Phase 1). Focuses are strategic,
// time-bound objectives that group existing routines/activities/goals
// (FocusContributor) and carry a progression roadmap (ProgressionMilestone).
// A roadmap can belong to a Focus or, later, an ActiveInjury (ownerKind).
//
// Phase 1 scope: create/edit/delete a focus, manage its contributors, and
// author/mark/reorder milestones. No gates, projection, seasons, or structured
// targets yet — those are later phases.

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { todayAppYmd, getAppDayRange } from "@/lib/dates";
import type {
  Prisma,
  FocusStatus,
  FocusContributorKind,
  MilestoneOwnerKind,
  MilestoneScopeKind,
} from "@/generated/prisma";

// Surfaces that show focus/aim data — revalidated together after any mutation.
function revalidateFocusSurfaces() {
  revalidatePath("/"); // dashboard: Focus band + WaG aims
  revalidatePath("/plan");
  revalidatePath("/focus");
}

// ── Focus CRUD ───────────────────────────────────────────────────────────

export type FocusInput = {
  name: string;
  description?: string | null;
  status?: FocusStatus;
  color?: string | null;
  icon?: string | null;
  pursuitKey?: string | null;
  linkedInjuryId?: string | null;
};

export async function createFocus(input: FocusInput): Promise<{ id: string }> {
  const name = input.name.trim();
  if (!name) throw new Error("Focus needs a name.");

  // New focuses sort to the top of the active list.
  const min = await prisma.focus.aggregate({ _min: { sortOrder: true } });
  const sortOrder = (min._min.sortOrder ?? 0) - 1;

  const focus = await prisma.focus.create({
    data: {
      name,
      description: input.description?.trim() || null,
      status: input.status ?? "ACTIVE",
      color: input.color?.trim() || null,
      icon: input.icon?.trim() || null,
      pursuitKey: input.pursuitKey?.trim() || null,
      linkedInjuryId: input.linkedInjuryId || null,
      sortOrder,
    },
    select: { id: true },
  });

  revalidateFocusSurfaces();
  return { id: focus.id };
}

export async function updateFocus(id: string, input: FocusInput): Promise<void> {
  const name = input.name.trim();
  if (!name) throw new Error("Focus needs a name.");

  await prisma.focus.update({
    where: { id },
    data: {
      name,
      description: input.description?.trim() || null,
      status: input.status,
      color: input.color?.trim() || null,
      icon: input.icon?.trim() || null,
      pursuitKey: input.pursuitKey?.trim() || null,
      linkedInjuryId: input.linkedInjuryId || null,
    },
  });

  revalidateFocusSurfaces();
}

// Real delete (user-initiated). Contributors cascade via FK; milestones use a
// polymorphic owner (no FK), so remove them explicitly. Training logs are never
// touched — a focus is an organizational overlay, not a record of work.
export async function deleteFocus(id: string): Promise<void> {
  await prisma.$transaction([
    prisma.progressionMilestone.deleteMany({
      where: { ownerKind: "FOCUS", ownerId: id },
    }),
    prisma.focus.delete({ where: { id } }),
  ]);
  revalidateFocusSurfaces();
}

// Lightweight archive — hides a focus without deleting its roadmap/history.
export async function setFocusStatus(id: string, status: FocusStatus): Promise<void> {
  await prisma.focus.update({ where: { id }, data: { status } });
  revalidateFocusSurfaces();
}

export async function reorderFocuses(orderedIds: string[]): Promise<void> {
  await prisma.$transaction(
    orderedIds.map((id, index) =>
      prisma.focus.update({ where: { id }, data: { sortOrder: index } })
    )
  );
  revalidateFocusSurfaces();
}

// ── Contributors (what counts toward the focus) ───────────────────────────

export type ContributorInput = { kind: FocusContributorKind; refId: string };

// Replace the focus's whole contributor set in one call — matches how the
// editor works (pick the full list, save). skipDuplicates guards the unique
// (focusId, kind, refId) constraint.
export async function setFocusContributors(
  focusId: string,
  contributors: ContributorInput[]
): Promise<void> {
  const deduped = Array.from(
    new Map(contributors.map((c) => [`${c.kind}:${c.refId}`, c])).values()
  ).filter((c) => c.refId.trim().length > 0);

  await prisma.$transaction([
    prisma.focusContributor.deleteMany({ where: { focusId } }),
    prisma.focusContributor.createMany({
      data: deduped.map((c) => ({ focusId, kind: c.kind, refId: c.refId })),
      skipDuplicates: true,
    }),
  ]);
  revalidateFocusSurfaces();
}

// ── Milestones (the progression roadmap) ──────────────────────────────────

export type MilestoneInput = {
  scopeKind: MilestoneScopeKind;
  scopeRef?: string | null; // routineId / exerciseId / capacity label
  label: string;
  targetText?: string | null;
};

export async function addMilestone(
  ownerKind: MilestoneOwnerKind,
  ownerId: string,
  input: MilestoneInput
): Promise<{ id: string }> {
  const label = input.label.trim();
  if (!label) throw new Error("Milestone needs a label.");

  // Append to the end of this owner's roadmap.
  const max = await prisma.progressionMilestone.aggregate({
    where: { ownerKind, ownerId },
    _max: { sortOrder: true },
  });
  const sortOrder = (max._max.sortOrder ?? -1) + 1;

  const milestone = await prisma.progressionMilestone.create({
    data: {
      ownerKind,
      ownerId,
      scopeKind: input.scopeKind,
      scopeRef: input.scopeRef?.trim() || null,
      label,
      targetText: input.targetText?.trim() || null,
      sortOrder,
    },
    select: { id: true },
  });

  revalidateFocusSurfaces();
  return { id: milestone.id };
}

export async function updateMilestone(id: string, input: MilestoneInput): Promise<void> {
  const label = input.label.trim();
  if (!label) throw new Error("Milestone needs a label.");

  await prisma.progressionMilestone.update({
    where: { id },
    data: {
      scopeKind: input.scopeKind,
      scopeRef: input.scopeRef?.trim() || null,
      label,
      targetText: input.targetText?.trim() || null,
    },
  });
  revalidateFocusSurfaces();
}

// Mark a milestone done. The track's "current" milestone is derived (first
// ACTIVE by sortOrder), so this single write advances the aim to the next one.
export async function markMilestoneMet(id: string): Promise<void> {
  await prisma.progressionMilestone.update({
    where: { id },
    data: { status: "ACHIEVED", achievedAt: new Date() },
  });
  revalidateFocusSurfaces();
}

// Undo a mark-met (back to ACTIVE).
export async function reopenMilestone(id: string): Promise<void> {
  await prisma.progressionMilestone.update({
    where: { id },
    data: { status: "ACTIVE", achievedAt: null },
  });
  revalidateFocusSurfaces();
}

export async function skipMilestone(id: string): Promise<void> {
  await prisma.progressionMilestone.update({
    where: { id },
    data: { status: "SKIPPED", achievedAt: null },
  });
  revalidateFocusSurfaces();
}

export async function deleteMilestone(id: string): Promise<void> {
  await prisma.progressionMilestone.delete({ where: { id } });
  revalidateFocusSurfaces();
}

// ── One-tap daily pain reading (from the injury panel) ────────────────────
// Logs (or corrects) today's reading for a body zone. If a reading already
// exists for today, it's updated — so tapping a different number fixes the
// day rather than stacking duplicates. This is the low-friction path that
// keeps the injury panel + future gates live instead of stale.
export async function logInjuryReading(zoneId: string, level: number): Promise<void> {
  if (!zoneId) throw new Error("Missing zone.");
  const lvl = Math.max(0, Math.min(10, Math.round(level)));
  const { start, end } = getAppDayRange(todayAppYmd());

  const existing = await prisma.painLog.findFirst({
    where: { zoneId, loggedAt: { gte: start, lt: end } },
    orderBy: { loggedAt: "desc" },
    select: { id: true },
  });
  if (existing) {
    await prisma.painLog.update({ where: { id: existing.id }, data: { level: lvl } });
  } else {
    await prisma.painLog.create({ data: { zoneId, level: lvl, context: "GENERAL" } });
  }

  revalidatePath("/");
  revalidatePath("/focus");
  revalidatePath("/body");
}

export async function reorderMilestones(orderedIds: string[]): Promise<void> {
  await prisma.$transaction(
    orderedIds.map((id, index) =>
      prisma.progressionMilestone.update({ where: { id }, data: { sortOrder: index } })
    )
  );
  revalidateFocusSurfaces();
}

// ── One-shot save for the create/edit form ────────────────────────────────
// Upserts the focus and reconciles its whole milestone list in one call:
// updates existing (by id), creates new (no id), deletes any the form
// dropped, and re-numbers sortOrder by list position. A milestone's
// ACHIEVED/SKIPPED status is preserved across an edit — editing a label must
// never silently un-complete it.

export type MilestoneFormRow = {
  id?: string; // present = existing milestone
  scopeKind: MilestoneScopeKind;
  scopeRef?: string | null;
  label: string;
  targetText?: string | null;
  estDurationDays?: number | null;
  // Gate: NONE | FREE_TEXT | PAIN. Pain gates auto-target the focus's linked
  // injury zone (resolved server-side), so the form only supplies threshold +
  // days.
  gateKind?: "NONE" | "FREE_TEXT" | "PAIN" | "FREQUENCY";
  gateNote?: string | null;
  gatePainThreshold?: number | null;
  gatePainDays?: number | null;
  gateFreqPerWeek?: number | null;
  gateFreqWeeks?: number | null;
};

// Parse a <input type="date"> value (YYYY-MM-DD) to a UTC-midnight Date, or
// null. Target dates carry no time-of-day, so UTC midnight is unambiguous.
function parseTargetDate(value?: string | null): Date | null {
  const raw = (value ?? "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) return null;
  const d = new Date(`${raw}T00:00:00.000Z`);
  return Number.isNaN(d.getTime()) ? null : d;
}

export async function saveFocus(input: {
  id?: string;
  name: string;
  description?: string | null;
  status?: FocusStatus;
  color?: string | null;
  icon?: string | null;
  pursuitKey?: string | null;
  linkedInjuryId?: string | null;
  targetDate?: string | null;
  targetKind?: "SOFT" | "HARD";
  season?: string | null;
  phase?: "BUILD" | "PEAK" | "OFFSEASON" | "MAINTAIN" | "" | null;
  handoffNote?: string | null;
  milestones: MilestoneFormRow[];
}): Promise<{ id: string }> {
  const name = input.name.trim();
  if (!name) throw new Error("Focus needs a name.");

  const focusData = {
    name,
    description: input.description?.trim() || null,
    color: input.color?.trim() || null,
    icon: input.icon?.trim() || null,
    targetDate: parseTargetDate(input.targetDate),
    targetKind: input.targetKind ?? "SOFT",
    season: input.season?.trim() || null,
    phase: input.phase ? input.phase : null,
    handoffNote: input.handoffNote?.trim() || null,
    // Only touch these when the caller explicitly provides them — the edit
    // form doesn't manage them, so an undefined must NOT wipe the value.
    ...(input.linkedInjuryId !== undefined ? { linkedInjuryId: input.linkedInjuryId || null } : {}),
    ...(input.pursuitKey !== undefined ? { pursuitKey: input.pursuitKey?.trim() || null } : {}),
  };

  // Create or update the focus first so we have its id for milestone ownership.
  let focusId: string;
  if (input.id) {
    await prisma.focus.update({
      where: { id: input.id },
      data: { ...focusData, status: input.status },
    });
    focusId = input.id;
  } else {
    const min = await prisma.focus.aggregate({ _min: { sortOrder: true } });
    const created = await prisma.focus.create({
      data: {
        ...focusData,
        status: input.status ?? "ACTIVE",
        sortOrder: (min._min.sortOrder ?? 0) - 1,
      },
      select: { id: true },
    });
    focusId = created.id;
  }

  // Resolve the zone for pain gates once — the focus's linked injury's first
  // zone. Pain gates without a resolvable zone fall back to no auto-eval.
  let painZoneId: string | null = null;
  if (input.milestones.some((m) => m.gateKind === "PAIN")) {
    const f = await prisma.focus.findUnique({ where: { id: focusId }, select: { linkedInjuryId: true } });
    if (f?.linkedInjuryId) {
      const iz = await prisma.injuryZone.findFirst({
        where: { injuryId: f.linkedInjuryId },
        orderBy: { zone: { sortOrder: "asc" } },
        select: { zoneId: true },
      });
      painZoneId = iz?.zoneId ?? null;
    }
  }

  // Reconcile milestones.
  const rows = input.milestones.filter((m) => m.label.trim().length > 0);
  const keepIds = rows.map((m) => m.id).filter((id): id is string => Boolean(id));

  const ops: Prisma.PrismaPromise<unknown>[] = [];
  // Delete any existing milestone the form no longer includes.
  ops.push(
    prisma.progressionMilestone.deleteMany({
      where: {
        ownerKind: "FOCUS",
        ownerId: focusId,
        ...(keepIds.length ? { id: { notIn: keepIds } } : {}),
      },
    })
  );
  rows.forEach((m, index) => {
    const gk = m.gateKind ?? "NONE";
    const common = {
      scopeKind: m.scopeKind,
      scopeRef: m.scopeRef?.trim() || null,
      label: m.label.trim(),
      targetText: m.targetText?.trim() || null,
      estDurationDays:
        m.estDurationDays != null && Number.isFinite(m.estDurationDays) && m.estDurationDays > 0
          ? Math.round(m.estDurationDays)
          : null,
      gateKind: gk,
      gateNote: m.gateNote?.trim() || null,
      gatePainZoneId: gk === "PAIN" ? painZoneId : null,
      gatePainThreshold:
        gk === "PAIN" && m.gatePainThreshold != null
          ? Math.max(0, Math.min(10, Math.round(m.gatePainThreshold)))
          : null,
      gatePainDays:
        gk === "PAIN" && m.gatePainDays != null ? Math.max(1, Math.round(m.gatePainDays)) : null,
      gateFreqPerWeek:
        gk === "FREQUENCY" && m.gateFreqPerWeek != null && m.gateFreqPerWeek > 0
          ? Math.min(14, m.gateFreqPerWeek)
          : null,
      gateFreqWeeks:
        gk === "FREQUENCY" && m.gateFreqWeeks != null ? Math.max(1, Math.min(8, Math.round(m.gateFreqWeeks))) : null,
      sortOrder: index,
    };
    if (m.id) {
      ops.push(prisma.progressionMilestone.update({ where: { id: m.id }, data: common }));
    } else {
      ops.push(
        prisma.progressionMilestone.create({
          data: { ownerKind: "FOCUS", ownerId: focusId, ...common },
        })
      );
    }
  });
  await prisma.$transaction(ops);

  revalidateFocusSurfaces();
  return { id: focusId };
}

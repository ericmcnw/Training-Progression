import { prisma } from "@/lib/prisma";
import { getActivityEntry, activityIcon } from "@/lib/activity-families";
import { sportSlugFromRoutineId } from "@/lib/synthetic-sport-routines";

// Rotation engine. A rotation is an ordered list of slots advanced by logging.
// A slot is "satisfied" in the current round when its primary routine OR any
// covering activity has been logged since the round began. The round resets
// once every slot is satisfied. The recommendation is the first unsatisfied
// slot in order. See prisma `Rotation` model header for the full rationale.

const LOOKBACK_DAYS = 120;

export type RotationCoverageTag = { tag: string; label: string; icon: string | null };

export type RotationSlotState = {
  id: string;
  name: string;
  position: number;
  primaryRoutineId: string | null;
  primaryRoutineName: string | null;
  coverageRoutines: Array<{ id: string; name: string }>;
  coverageTags: RotationCoverageTag[];
  satisfied: boolean;
  isNext: boolean;
  lastDoneDate: Date | null;
};

export type RotationRecentEntry = {
  date: Date;
  slotName: string;
  /** What was logged that satisfied the slot (routine or activity name). */
  label: string;
};

export type RotationOverview = {
  rotation: { id: string; name: string };
  slots: RotationSlotState[];
  nextSlotId: string | null;
  recent: RotationRecentEntry[];
  /** True when every slot is satisfied — the round just completed. */
  roundComplete: boolean;
};

function tagLabel(tag: string): RotationCoverageTag {
  const entry = getActivityEntry(tag);
  return { tag, label: entry?.label ?? tag, icon: activityIcon(tag) };
}

// All the ways a single log can satisfy slots: its routine id (matches a
// primary or a coverage routine) and its "tags" (metadata group slugs + the
// sport slug derived from a synthetic sport routine id).
type LogSignal = { routineId: string; tags: Set<string>; performedAt: Date; label: string };

function slotsMatchedByLog(
  log: LogSignal,
  slots: Array<{
    id: string;
    primaryRoutineId: string | null;
    coverageRoutineIds: Set<string>;
    coverageTags: Set<string>;
  }>
): string[] {
  const matched: string[] = [];
  for (const slot of slots) {
    if (slot.primaryRoutineId && slot.primaryRoutineId === log.routineId) {
      matched.push(slot.id);
      continue;
    }
    if (slot.coverageRoutineIds.has(log.routineId)) {
      matched.push(slot.id);
      continue;
    }
    let tagHit = false;
    for (const t of log.tags) {
      if (slot.coverageTags.has(t)) {
        tagHit = true;
        break;
      }
    }
    if (tagHit) matched.push(slot.id);
  }
  return matched;
}

export async function getRotationOverview(): Promise<RotationOverview | null> {
  const rotation = await prisma.rotation.findFirst({
    where: { isActive: true },
    orderBy: { createdAt: "asc" },
    include: {
      slots: {
        orderBy: { position: "asc" },
        include: { coverage: true },
      },
    },
  });

  if (!rotation || rotation.slots.length === 0) return null;

  // Resolve primary + coverage routine names in one lookup.
  const routineIds = new Set<string>();
  for (const slot of rotation.slots) {
    if (slot.primaryRoutineId) routineIds.add(slot.primaryRoutineId);
    for (const c of slot.coverage) if (c.routineId) routineIds.add(c.routineId);
  }
  // Only resolve LIVE routines. A slot/coverage pointing at a soft-deleted
  // routine (e.g. a retired legacy routine) renders via the existing
  // "(removed routine)" / null-name fallbacks and no longer counts toward
  // satisfying or advancing the slot.
  const routineRows = routineIds.size
    ? await prisma.routine.findMany({
        where: { id: { in: [...routineIds] }, isDeleted: false },
        select: { id: true, name: true },
      })
    : [];
  const routineNameById = new Map(routineRows.map((r) => [r.id, r.name]));
  const liveRoutineIds = new Set(routineRows.map((r) => r.id));

  // Matchers per slot — deleted routine refs are dropped so they can't match.
  const matchers = rotation.slots.map((slot) => ({
    id: slot.id,
    primaryRoutineId:
      slot.primaryRoutineId && liveRoutineIds.has(slot.primaryRoutineId) ? slot.primaryRoutineId : null,
    coverageRoutineIds: new Set(
      slot.coverage.map((c) => c.routineId).filter((x): x is string => typeof x === "string" && liveRoutineIds.has(x))
    ),
    coverageTags: new Set(slot.coverage.map((c) => c.tag).filter((x): x is string => Boolean(x))),
  }));

  // Recent logs, newest first, with the tags they carry.
  const since = new Date(Date.now() - LOOKBACK_DAYS * 86_400_000);
  const logs = await prisma.routineLog.findMany({
    where: { performedAt: { gte: since } },
    orderBy: { performedAt: "desc" },
    select: {
      routineId: true,
      performedAt: true,
      routine: {
        select: {
          name: true,
          metadataGroups: { select: { group: { select: { slug: true } } } },
        },
      },
      activityType: { select: { name: true } },
    },
  });

  const signals: LogSignal[] = logs.map((l) => {
    const tags = new Set(l.routine.metadataGroups.map((m) => m.group.slug));
    const sportSlug = sportSlugFromRoutineId(l.routineId);
    if (sportSlug) tags.add(sportSlug);
    return {
      routineId: l.routineId,
      tags,
      performedAt: l.performedAt,
      label: l.activityType?.name ?? l.routine.name,
    };
  });

  // Walk newest → oldest, accumulating the current round's satisfied slots.
  const satisfied = new Set<string>();
  const lastDoneBySlot = new Map<string, Date>();
  const recent: RotationRecentEntry[] = [];
  const slotNameById = new Map(rotation.slots.map((s) => [s.id, s.name]));

  for (const sig of signals) {
    const matched = slotsMatchedByLog(sig, matchers);
    if (matched.length === 0) continue;

    const fresh = matched.filter((id) => !satisfied.has(id));

    // Record the most recent log per slot (for "last done" display) even if
    // it lands in a prior round.
    for (const id of matched) {
      if (!lastDoneBySlot.has(id)) lastDoneBySlot.set(id, sig.performedAt);
    }

    if (recent.length < 3) {
      recent.push({ date: sig.performedAt, slotName: matched.map((id) => slotNameById.get(id) ?? "").filter(Boolean).join(" + "), label: sig.label });
    }

    if (fresh.length === 0) {
      // This log only re-hits already-satisfied slots → previous round. Stop
      // accumulating the current round, but we've already captured history.
      if (recent.length >= 3) break;
      continue;
    }
    for (const id of fresh) satisfied.add(id);
    if (satisfied.size === matchers.length && recent.length >= 3) break;
  }

  const roundComplete = satisfied.size >= rotation.slots.length;
  // Next = first unsatisfied slot in order, or slot 0 if the round is done.
  const nextSlot = roundComplete
    ? rotation.slots[0]
    : rotation.slots.find((s) => !satisfied.has(s.id)) ?? rotation.slots[0];
  const nextSlotId = nextSlot?.id ?? null;

  const slots: RotationSlotState[] = rotation.slots.map((slot) => ({
    id: slot.id,
    name: slot.name,
    position: slot.position,
    primaryRoutineId: slot.primaryRoutineId,
    primaryRoutineName: slot.primaryRoutineId ? routineNameById.get(slot.primaryRoutineId) ?? null : null,
    coverageRoutines: slot.coverage
      .filter((c) => c.routineId)
      .map((c) => ({ id: c.routineId as string, name: routineNameById.get(c.routineId as string) ?? "(removed routine)" })),
    coverageTags: slot.coverage.filter((c) => c.tag).map((c) => tagLabel(c.tag as string)),
    satisfied: satisfied.has(slot.id),
    isNext: slot.id === nextSlotId,
    lastDoneDate: lastDoneBySlot.get(slot.id) ?? null,
  }));

  return {
    rotation: { id: rotation.id, name: rotation.name },
    slots,
    nextSlotId,
    recent,
    roundComplete,
  };
}

import { getRotationOverview } from "@/lib/rotation";
import { formatAppDate } from "@/lib/dates";

// Home rotation summary — a serializable, date-formatted projection of
// getRotationOverview() for the home Rotation card. Returns null when there's
// no active rotation, so the section self-hides for users who don't run one.

export type HomeRotationSlot = {
  id: string;
  name: string;
  position: number;
  /** Primary routine name, else a coverage summary (tags / routines). */
  detail: string | null;
  satisfied: boolean;
  isNext: boolean;
  lastDoneLabel: string | null;
};

export type HomeRotation = {
  name: string;
  /** Name of the next slot to do, or null when the round just completed. */
  nextSlotName: string | null;
  nextSlotDetail: string | null;
  satisfiedCount: number;
  totalCount: number;
  roundComplete: boolean;
  slots: HomeRotationSlot[];
  recent: Array<{ dateLabel: string; slotName: string; label: string }>;
};

function slotDetail(slot: {
  primaryRoutineName: string | null;
  coverageTags: Array<{ label: string }>;
  coverageRoutines: Array<{ name: string }>;
}): string | null {
  if (slot.primaryRoutineName) return slot.primaryRoutineName;
  if (slot.coverageTags.length > 0) return slot.coverageTags.map((t) => t.label).join(" · ");
  if (slot.coverageRoutines.length > 0) return slot.coverageRoutines.map((r) => r.name).join(" · ");
  return null;
}

export async function getHomeRotation(): Promise<HomeRotation | null> {
  const overview = await getRotationOverview();
  if (!overview) return null;

  const next = overview.slots.find((s) => s.id === overview.nextSlotId) ?? null;

  return {
    name: overview.rotation.name,
    nextSlotName: overview.roundComplete ? null : next?.name ?? null,
    nextSlotDetail: overview.roundComplete ? null : next ? slotDetail(next) : null,
    satisfiedCount: overview.slots.filter((s) => s.satisfied).length,
    totalCount: overview.slots.length,
    roundComplete: overview.roundComplete,
    slots: overview.slots.map((s) => ({
      id: s.id,
      name: s.name,
      position: s.position,
      detail: slotDetail(s),
      satisfied: s.satisfied,
      isNext: s.isNext,
      lastDoneLabel: s.lastDoneDate ? formatAppDate(s.lastDoneDate, { month: "short", day: "numeric" }) : null,
    })),
    recent: overview.recent.map((r) => ({
      dateLabel: formatAppDate(r.date, { month: "short", day: "numeric" }),
      slotName: r.slotName,
      label: r.label,
    })),
  };
}

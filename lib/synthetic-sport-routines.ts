// Synthetic per-sport routines — the "Sports" equivalent of the
// synthetic Endurance routine. Each sport the user has selected has
// one routine row of its own (`sports-{slug}-synthetic`, kind=SESSION,
// isPlaceholder=true) that holds every quick-log against that sport.
//
// Existence of the synthetic routine *is* the user's selection — no
// separate "selectedSportSlugs" array on the profile, no extra
// migration. Adding a sport = create the routine; removing = soft-
// delete via isActive=false. Routine list pages already filter
// isPlaceholder=false, so these never clutter /routines.

import { prisma } from "@/lib/prisma";
import { activitiesByFamily, getActivityEntry } from "@/lib/activity-families";

/** Deterministic id so callers can reference the routine by slug
 *  without a DB lookup. */
export function getSyntheticSportRoutineId(slug: string): string {
  return `sports-${slug}-synthetic`;
}

/** True if the routine id matches the synthetic-sport pattern. */
export function isSyntheticSportRoutineId(id: string): boolean {
  return id.startsWith("sports-") && id.endsWith("-synthetic");
}

/** Extract the sport slug from a synthetic routine id, or null if it
 *  isn't one. */
export function sportSlugFromRoutineId(id: string): string | null {
  if (!isSyntheticSportRoutineId(id)) return null;
  return id.slice("sports-".length, -"-synthetic".length);
}

export type SelectedSport = {
  slug: string;
  label: string;
  routineId: string;
};

/** Sports the user has selected, ordered by activity-registry sortHint
 *  then label. Reads from the routine table directly — synthetic-routine
 *  existence (and isActive=true) is the source of truth. */
export async function listSelectedSports(): Promise<SelectedSport[]> {
  const routines = await prisma.routine.findMany({
    where: {
      isPlaceholder: true,
      isActive: true,
      isDeleted: false,
      id: { startsWith: "sports-", endsWith: "-synthetic" },
    },
    select: { id: true },
  });

  const slugs = routines
    .map((r) => sportSlugFromRoutineId(r.id))
    .filter((s): s is string => Boolean(s));

  const entries = slugs
    .map((slug) => {
      const entry = getActivityEntry(slug);
      if (!entry || entry.family !== "sports" || entry.pinnedCatchAll) return null;
      return { slug, label: entry.label, routineId: getSyntheticSportRoutineId(slug) };
    })
    .filter((e): e is SelectedSport => e !== null)
    .sort((a, b) => {
      const ea = getActivityEntry(a.slug);
      const eb = getActivityEntry(b.slug);
      return (
        (ea?.sortHint ?? 999) - (eb?.sortHint ?? 999) ||
        a.label.localeCompare(b.label)
      );
    });

  return entries;
}

/** Sports the user hasn't yet selected — used to populate the
 *  add-sport picker. */
export async function listUnselectedSports(): Promise<Array<{ slug: string; label: string; eyebrow: string }>> {
  const selected = await listSelectedSports();
  const selectedSlugs = new Set(selected.map((s) => s.slug));
  return activitiesByFamily("sports")
    .filter((entry) => !selectedSlugs.has(entry.slug))
    .map((entry) => ({ slug: entry.slug, label: entry.label, eyebrow: entry.eyebrow }));
}

/** Create the synthetic routine for this sport if it doesn't exist;
 *  un-archive if it was previously removed. Idempotent. */
export async function ensureSportSelected(slug: string): Promise<void> {
  const entry = getActivityEntry(slug);
  if (!entry || entry.family !== "sports") {
    throw new Error(`Unknown sport slug: ${slug}`);
  }
  const id = getSyntheticSportRoutineId(slug);

  // Upsert by id. If the row existed but was archived (isActive=false),
  // restore it.
  await prisma.routine.upsert({
    where: { id },
    update: { isActive: true, isDeleted: false, name: entry.label },
    create: {
      id,
      name: entry.label,
      kind: "SESSION",
      domain: "sport",
      isActive: true,
      isPlaceholder: true,
      isDeleted: false,
    },
  });
}

/** Backpacking's synthetic routine. Backpacking is an endurance pursuit (not a
 *  sports-family activity), so it doesn't go through ensureSportSelected — but
 *  it reuses the same synthetic-routine id scheme for a stable, lookup-free id.
 *  domain=cardio so its trip miles count as cardio. Idempotent; created on the
 *  first trip log. */
export async function ensureBackpackingRoutine(): Promise<void> {
  const id = getSyntheticSportRoutineId("backpacking");
  await prisma.routine.upsert({
    where: { id },
    update: { isActive: true, isDeleted: false, name: "Backpacking", domain: "cardio" },
    create: {
      id,
      name: "Backpacking",
      kind: "SESSION",
      domain: "cardio",
      isActive: true,
      isPlaceholder: true,
      isDeleted: false,
    },
  });
}

/** Soft-remove the user's selection of this sport. Existing logs
 *  against the synthetic routine are preserved — they continue to
 *  count in stats, the sport just no longer appears on the log
 *  page's tile grid. Re-add via ensureSportSelected restores it. */
export async function unselectSport(slug: string): Promise<void> {
  const id = getSyntheticSportRoutineId(slug);
  await prisma.routine.update({
    where: { id },
    data: { isActive: false },
  }).catch(() => {
    // Routine may not exist (user removed twice in a row); no-op.
  });
}

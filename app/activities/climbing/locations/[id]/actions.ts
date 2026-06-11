"use server";

// Mutation actions for the location detail page. Problem-level (rename,
// notes) lives here alongside location-level (rename, type change, merge,
// delete). Media actions live in app/activities/climbing/media/actions.ts.

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import type { ClimbLocationType } from "@/lib/climb-types";
import { revalidateActivityWorlds } from "@/lib/revalidate-helpers";

function revalidateLocation(locationId: string) {
  // Layout-scoped invalidate over /activities catches every climbing
  // subroute in one call, plus the per-location detail page via the
  // explicit path (helps when the route segment hasn't been hit yet).
  revalidatePath(`/activities/climbing/locations/${locationId}`);
  revalidateActivityWorlds();
}

export async function renameClimbProblem(input: { id: string; name: string }) {
  const name = input.name.trim();
  if (!name) throw new Error("Name cannot be empty");
  const updated = await prisma.climbProblem.update({
    where: { id: input.id },
    data: { name },
    select: { id: true, name: true, locationId: true },
  });
  if (updated.locationId) revalidateLocation(updated.locationId);
  return updated;
}

export async function updateClimbProblemNotes(input: { id: string; notes: string | null }) {
  const notes = input.notes?.trim() ? input.notes.trim() : null;
  const updated = await prisma.climbProblem.update({
    where: { id: input.id },
    data: { notes },
    select: { id: true, notes: true, locationId: true },
  });
  if (updated.locationId) revalidateLocation(updated.locationId);
  return updated;
}

export async function renameClimbLocation(input: { id: string; name: string }) {
  const name = input.name.trim();
  if (!name) throw new Error("Name cannot be empty");
  const updated = await prisma.climbLocation.update({
    where: { id: input.id },
    data: { name },
    select: { id: true, name: true },
  });
  revalidateLocation(updated.id);
  return updated;
}

export async function updateClimbLocationType(input: { id: string; type: ClimbLocationType }) {
  const updated = await prisma.climbLocation.update({
    where: { id: input.id },
    data: { type: input.type },
    select: { id: true, type: true },
  });
  revalidateLocation(updated.id);
  return updated;
}

// Delete the location if it has no logs. We don't expose this in the UI
// when routineLogs._count > 0; the check is repeated server-side for
// safety (UI state can lie or be raced).
export async function deleteClimbLocationIfEmpty(input: { id: string }) {
  const usage = await prisma.routineLog.count({ where: { climbLocationId: input.id } });
  if (usage > 0) throw new Error("Can't delete a location with logged climbs. Merge it into another spot instead.");
  await prisma.climbLocation.delete({ where: { id: input.id } });
  revalidateActivityWorlds();
}

// Merge `sourceId` into `targetId`: reassign every RoutineLog, ClimbProblem,
// and ClimbMedia from source to target, then delete the source location.
// Problem-name collisions (same name + grade + system at both locations)
// fold attempts into the target problem and concatenate beta notes with a
// separator so nothing is lost. Wrapped in a transaction so a mid-way
// failure leaves the DB unchanged.
//
// Returns the targetId so the caller can redirect.
export async function mergeClimbLocations(input: { sourceId: string; targetId: string }) {
  if (input.sourceId === input.targetId) throw new Error("Source and target must be different locations");

  const [source, target] = await Promise.all([
    prisma.climbLocation.findUnique({
      where: { id: input.sourceId },
      select: { id: true, name: true },
    }),
    prisma.climbLocation.findUnique({
      where: { id: input.targetId },
      select: { id: true, name: true },
    }),
  ]);
  if (!source) throw new Error("Source location no longer exists");
  if (!target) throw new Error("Target location no longer exists");

  // Pre-fetch problems on both sides so we can detect collisions before the
  // transaction runs. Collision = same name (case-insensitive) + grade +
  // gradeSystem at both locations.
  const [sourceProblems, targetProblems] = await Promise.all([
    prisma.climbProblem.findMany({
      where: { locationId: input.sourceId },
      select: { id: true, name: true, grade: true, gradeSystem: true, notes: true },
    }),
    prisma.climbProblem.findMany({
      where: { locationId: input.targetId },
      select: { id: true, name: true, grade: true, gradeSystem: true, notes: true },
    }),
  ]);

  type Match = { sourceProblemId: string; sourceNotes: string | null; targetProblemId: string; targetNotes: string | null };
  const collisions: Match[] = [];
  const reassignProblemIds: string[] = [];
  for (const sp of sourceProblems) {
    const dupe = targetProblems.find(
      (tp) =>
        tp.name.toLowerCase() === sp.name.toLowerCase() &&
        tp.grade === sp.grade &&
        tp.gradeSystem === sp.gradeSystem
    );
    if (dupe) {
      collisions.push({
        sourceProblemId: sp.id,
        sourceNotes: sp.notes,
        targetProblemId: dupe.id,
        targetNotes: dupe.notes,
      });
    } else {
      reassignProblemIds.push(sp.id);
    }
  }

  await prisma.$transaction(async (tx) => {
    // 1) Reassign all logs to the target.
    await tx.routineLog.updateMany({
      where: { climbLocationId: input.sourceId },
      data: { climbLocationId: input.targetId },
    });

    // 2) Reassign all media to the target.
    await tx.climbMedia.updateMany({
      where: { locationId: input.sourceId },
      data: { locationId: input.targetId },
    });

    // 3) For non-colliding problems, re-parent to the target location.
    if (reassignProblemIds.length > 0) {
      await tx.climbProblem.updateMany({
        where: { id: { in: reassignProblemIds } },
        data: { locationId: input.targetId },
      });
    }

    // 4) For colliding problems, move every attempt to the target problem,
    //    move any per-problem media, merge notes, then delete the source
    //    problem. Concatenation preserves both sets of beta — losing notes
    //    silently would be worse than the cosmetic seam of a separator.
    for (const c of collisions) {
      await tx.climbAttempt.updateMany({
        where: { problemId: c.sourceProblemId },
        data: { problemId: c.targetProblemId },
      });
      await tx.climbMedia.updateMany({
        where: { problemId: c.sourceProblemId },
        data: { problemId: c.targetProblemId },
      });
      const mergedNotes = mergeNotes(c.targetNotes, c.sourceNotes, source.name);
      if (mergedNotes !== c.targetNotes) {
        await tx.climbProblem.update({
          where: { id: c.targetProblemId },
          data: { notes: mergedNotes },
        });
      }
      await tx.climbProblem.delete({ where: { id: c.sourceProblemId } });
    }

    // 5) Carry areas over. Without this, the source's ClimbArea rows
    //    cascade-delete with the location and their attempts' areaId goes
    //    null — silent data loss. Same-named areas at the target absorb
    //    the source area's attempts; everything else re-parents.
    const sourceAreas = await tx.climbArea.findMany({
      where: { locationId: input.sourceId },
      select: { id: true, name: true },
    });
    for (const area of sourceAreas) {
      const clash = await tx.climbArea.findFirst({
        where: { locationId: input.targetId, name: { equals: area.name, mode: "insensitive" } },
        select: { id: true },
      });
      if (clash) {
        await tx.climbAttempt.updateMany({ where: { areaId: area.id }, data: { areaId: clash.id } });
        await tx.climbArea.delete({ where: { id: area.id } });
      } else {
        await tx.climbArea.update({ where: { id: area.id }, data: { locationId: input.targetId } });
      }
    }

    // 6) Finally, delete the source location. By this point it has no logs,
    //    no problems, no media, and no areas — the cascade rules are no-ops.
    await tx.climbLocation.delete({ where: { id: input.sourceId } });
  });

  // Top-level revalidate covers map + browse + projects + the now-stale
  // source detail URL.
  revalidateLocation(input.targetId);
  revalidatePath(`/activities/climbing/locations/${input.sourceId}`);

  return { targetId: input.targetId, collisions: collisions.length };
}

// Combine target + source notes when merging duplicate problems. If either
// is empty, just return the other. Otherwise stack them with a labeled
// separator so users can disentangle the history.
function mergeNotes(target: string | null, source: string | null, sourceLocationName: string): string | null {
  const t = target?.trim() ?? "";
  const s = source?.trim() ?? "";
  if (!t) return s || null;
  if (!s) return t;
  if (t === s) return t;
  return `${t}\n\n— merged from ${sourceLocationName} —\n${s}`;
}

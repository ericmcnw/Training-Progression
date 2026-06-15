"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import {
  ClimbMediaStorageError,
  deleteClimbPhotoFromDisk,
  saveClimbPhotoToDisk,
} from "@/lib/climb-media-storage";
import { validateLinkUrl } from "@/lib/climb-media-shared";

type AttachTarget =
  | { locationId: string; areaId?: never; problemId?: never }
  | { areaId: string; locationId?: never; problemId?: never }
  | { problemId: string; locationId?: never; areaId?: never };

function validateTarget(input: {
  locationId?: string | null;
  areaId?: string | null;
  problemId?: string | null;
}): AttachTarget {
  const hasLocation = typeof input.locationId === "string" && input.locationId.length > 0;
  const hasArea = typeof input.areaId === "string" && input.areaId.length > 0;
  const hasProblem = typeof input.problemId === "string" && input.problemId.length > 0;
  const setCount = Number(hasLocation) + Number(hasArea) + Number(hasProblem);
  if (setCount !== 1) {
    throw new Error("Media must attach to exactly one of a location, area, or problem");
  }
  if (hasLocation) return { locationId: input.locationId as string };
  if (hasArea) return { areaId: input.areaId as string };
  return { problemId: input.problemId as string };
}

// After mutating media, refresh both possible parent paths. We don't always
// know which one is being viewed, so blanket-revalidate the surfaces that
// render galleries. Cheap because force-dynamic anyway.
// Where-clause picking the parent for the sortOrder aggregate.
function parentWhere(target: AttachTarget) {
  if ("locationId" in target) return { locationId: target.locationId };
  if ("areaId" in target) return { areaId: target.areaId };
  return { problemId: target.problemId };
}

function revalidateMediaParents(target: AttachTarget) {
  if ("locationId" in target) {
    revalidatePath(`/activities/climbing/locations/${target.locationId}`);
    revalidatePath("/activities/climbing/map");
  } else {
    // Area / problem media surfaces on the location detail page — we don't
    // have the locationId here without a round-trip, so just revalidate the
    // whole climbing layout.
    revalidatePath("/activities/climbing", "layout");
  }
}

export async function uploadClimbPhoto(formData: FormData) {
  const file = formData.get("file");
  const locationId = (formData.get("locationId") as string | null) ?? null;
  const areaId = (formData.get("areaId") as string | null) ?? null;
  const problemId = (formData.get("problemId") as string | null) ?? null;
  const captionRaw = formData.get("caption");
  const caption = typeof captionRaw === "string" && captionRaw.trim() ? captionRaw.trim() : null;

  if (!(file instanceof File)) throw new Error("No file uploaded");

  const target = validateTarget({ locationId, areaId, problemId });

  let saved;
  try {
    saved = await saveClimbPhotoToDisk(file);
  } catch (err) {
    if (err instanceof ClimbMediaStorageError) throw new Error(err.message);
    throw err;
  }

  // Append by setting sortOrder = max(existing) + 1. Cheaper than rewriting
  // every other row, and the natural read order matches insertion order
  // for the default "no manual reorder" case.
  const maxOrder = await prisma.climbMedia.aggregate({
    _max: { sortOrder: true },
    where: parentWhere(target),
  });
  const nextOrder = (maxOrder._max.sortOrder ?? -1) + 1;

  const created = await prisma.climbMedia.create({
    data: {
      kind: "PHOTO",
      url: saved.url,
      sizeBytes: saved.sizeBytes,
      caption,
      sortOrder: nextOrder,
      ...target,
    },
  });

  revalidateMediaParents(target);
  return created;
}

export async function addClimbLink(input: {
  url: string;
  locationId?: string | null;
  areaId?: string | null;
  problemId?: string | null;
  caption?: string | null;
}) {
  const url = validateLinkUrl(input.url);
  const target = validateTarget(input);
  const caption = input.caption?.trim() ? input.caption.trim() : null;

  const maxOrder = await prisma.climbMedia.aggregate({
    _max: { sortOrder: true },
    where: parentWhere(target),
  });
  const nextOrder = (maxOrder._max.sortOrder ?? -1) + 1;

  const created = await prisma.climbMedia.create({
    data: {
      kind: "LINK",
      url,
      caption,
      sortOrder: nextOrder,
      ...target,
    },
  });

  revalidateMediaParents(target);
  return created;
}

export async function deleteClimbMedia(id: string) {
  const existing = await prisma.climbMedia.findUnique({
    where: { id },
    select: { id: true, kind: true, url: true, locationId: true, problemId: true },
  });
  if (!existing) return; // already gone

  // Delete the DB row first; if that fails, the file is still discoverable.
  // After success, attempt the file unlink — failure here is benign (the
  // file just orphans on disk until manual cleanup).
  await prisma.climbMedia.delete({ where: { id } });
  if (existing.kind === "PHOTO") {
    await deleteClimbPhotoFromDisk(existing.url);
  }

  if (existing.locationId) {
    revalidatePath(`/activities/climbing/locations/${existing.locationId}`);
  }
  revalidatePath("/activities/climbing", "layout");
}

export async function updateClimbMediaCaption(input: { id: string; caption: string | null }) {
  const caption = input.caption?.trim() ? input.caption.trim() : null;
  const updated = await prisma.climbMedia.update({
    where: { id: input.id },
    data: { caption },
    select: { id: true, caption: true, locationId: true, problemId: true },
  });
  if (updated.locationId) {
    revalidatePath(`/activities/climbing/locations/${updated.locationId}`);
  }
  revalidatePath("/activities/climbing", "layout");
  return updated;
}

// Bulk-rewrite sortOrder for a parent's gallery. Callers pass the desired
// final ordering as an array of media IDs (first → sortOrder 0, etc.). All
// IDs must belong to the same parent — we validate that to prevent a buggy
// caller from re-parenting media across galleries.
export async function reorderClimbMedia(input: { ids: string[] }) {
  if (input.ids.length === 0) return;
  const records = await prisma.climbMedia.findMany({
    where: { id: { in: input.ids } },
    select: { id: true, locationId: true, areaId: true, problemId: true },
  });
  if (records.length !== input.ids.length) throw new Error("Some media records not found");

  const locationIds = new Set(records.map((r) => r.locationId).filter(Boolean));
  const areaIds = new Set(records.map((r) => r.areaId).filter(Boolean));
  const problemIds = new Set(records.map((r) => r.problemId).filter(Boolean));
  if (locationIds.size + areaIds.size + problemIds.size !== 1) {
    throw new Error("Reorder targets must share one parent");
  }

  await prisma.$transaction(
    input.ids.map((id, index) =>
      prisma.climbMedia.update({
        where: { id },
        data: { sortOrder: index },
      })
    )
  );

  const [first] = records;
  if (first.locationId) revalidatePath(`/activities/climbing/locations/${first.locationId}`);
  revalidatePath("/activities/climbing", "layout");
}

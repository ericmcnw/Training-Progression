"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";

function clampLat(value: number) {
  if (!Number.isFinite(value)) return null;
  if (value < -90 || value > 90) return null;
  return value;
}

function clampLng(value: number) {
  if (!Number.isFinite(value)) return null;
  if (value < -180 || value > 180) return null;
  return value;
}

export async function createActivitySpotOnMap(input: {
  activitySlug: string;
  name: string;
  type: string | null;
  latitude: number;
  longitude: number;
}) {
  const name = input.name.trim();
  if (!name) throw new Error("Name is required");
  const lat = clampLat(input.latitude);
  const lng = clampLng(input.longitude);
  if (lat === null || lng === null) throw new Error("Invalid coordinates");
  const slug = input.activitySlug.trim();
  if (!slug) throw new Error("Activity slug required");

  const created = await prisma.activitySpot.create({
    data: { activitySlug: slug, name, type: input.type ?? null, latitude: lat, longitude: lng },
    select: { id: true, activitySlug: true, name: true, type: true, latitude: true, longitude: true },
  });
  revalidatePath(`/activities/${slug}/map`);
  return created;
}

export async function updateActivitySpotCoords(input: {
  id: string;
  latitude: number;
  longitude: number;
}) {
  const lat = clampLat(input.latitude);
  const lng = clampLng(input.longitude);
  if (lat === null || lng === null) throw new Error("Invalid coordinates");

  const updated = await prisma.activitySpot.update({
    where: { id: input.id },
    data: { latitude: lat, longitude: lng },
    select: { id: true, activitySlug: true, name: true, type: true, latitude: true, longitude: true },
  });
  revalidatePath(`/activities/${updated.activitySlug}/map`);
  return updated;
}

export async function updateActivitySpotMeta(input: {
  id: string;
  name?: string;
  type?: string | null;
}) {
  const data: { name?: string; type?: string | null } = {};
  if (input.name !== undefined) {
    const trimmed = input.name.trim();
    if (!trimmed) throw new Error("Name cannot be empty");
    data.name = trimmed;
  }
  if (input.type !== undefined) data.type = input.type;
  if (Object.keys(data).length === 0) return null;

  const updated = await prisma.activitySpot.update({
    where: { id: input.id },
    data,
    select: { id: true, activitySlug: true, name: true, type: true, latitude: true, longitude: true },
  });
  revalidatePath(`/activities/${updated.activitySlug}/map`);
  return updated;
}

export async function clearActivitySpotCoords(id: string) {
  const updated = await prisma.activitySpot.update({
    where: { id },
    data: { latitude: null, longitude: null },
    select: { id: true, activitySlug: true, name: true, type: true, latitude: true, longitude: true },
  });
  revalidatePath(`/activities/${updated.activitySlug}/map`);
  return updated;
}

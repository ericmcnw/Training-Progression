"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import type { ClimbLocationType } from "@/lib/climb-types";
import { revalidateActivityWorlds } from "@/lib/revalidate-helpers";

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

export async function createClimbLocationOnMap(input: {
  name: string;
  type: ClimbLocationType;
  latitude: number;
  longitude: number;
}) {
  const name = input.name.trim();
  if (!name) throw new Error("Name is required");
  const lat = clampLat(input.latitude);
  const lng = clampLng(input.longitude);
  if (lat === null || lng === null) throw new Error("Invalid coordinates");

  const created = await prisma.climbLocation.create({
    data: { name, type: input.type, latitude: lat, longitude: lng },
    select: { id: true, name: true, type: true, latitude: true, longitude: true },
  });
  // Layout-scoped revalidate so the new pin appears across every
  // climbing subroute (map sidebar, climbs browse location filter,
  // projects, location detail) on the next visit.
  revalidateActivityWorlds();
  return created;
}

export async function updateClimbLocationCoords(input: {
  id: string;
  latitude: number;
  longitude: number;
}) {
  const lat = clampLat(input.latitude);
  const lng = clampLng(input.longitude);
  if (lat === null || lng === null) throw new Error("Invalid coordinates");

  const updated = await prisma.climbLocation.update({
    where: { id: input.id },
    data: { latitude: lat, longitude: lng },
    select: { id: true, name: true, type: true, latitude: true, longitude: true },
  });
  revalidateActivityWorlds();
  return updated;
}

export async function updateClimbLocationMeta(input: {
  id: string;
  name?: string;
  type?: ClimbLocationType;
}) {
  const data: { name?: string; type?: ClimbLocationType } = {};
  if (input.name !== undefined) {
    const trimmed = input.name.trim();
    if (!trimmed) throw new Error("Name cannot be empty");
    data.name = trimmed;
  }
  if (input.type !== undefined) data.type = input.type;
  if (Object.keys(data).length === 0) return null;

  const updated = await prisma.climbLocation.update({
    where: { id: input.id },
    data,
    select: { id: true, name: true, type: true, latitude: true, longitude: true },
  });
  revalidateActivityWorlds();
  return updated;
}

export async function clearClimbLocationCoords(id: string) {
  const updated = await prisma.climbLocation.update({
    where: { id },
    data: { latitude: null, longitude: null },
    select: { id: true, name: true, type: true, latitude: true, longitude: true },
  });
  revalidateActivityWorlds();
  return updated;
}

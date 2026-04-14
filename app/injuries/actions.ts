"use server";

import type { InjuryStatus } from "@/generated/prisma";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";

export type InjuryInput = {
  name: string;
  severity: number;
  status: InjuryStatus;
  startedAt: string;
  resolvedAt?: string | null;
  notes?: string | null;
  zoneSlugs: string[];
};

const statuses = new Set<InjuryStatus>(["ACTIVE", "RECOVERING", "RESOLVED", "FLARED"]);

function sanitizeInput(data: InjuryInput) {
  const name = data.name.trim();
  if (!name) throw new Error("Name is required.");
  const status = statuses.has(data.status) ? data.status : "ACTIVE";
  const severity = Math.max(1, Math.min(5, Math.round(Number(data.severity))));
  const startedAt = data.startedAt ? new Date(`${data.startedAt}T00:00:00.000`) : new Date();
  const resolvedAt = status === "RESOLVED" && data.resolvedAt ? new Date(`${data.resolvedAt}T00:00:00.000`) : null;
  const zoneSlugs = Array.from(new Set(data.zoneSlugs.map((slug) => slug.trim()).filter(Boolean)));
  if (zoneSlugs.length === 0) throw new Error("Select at least one affected zone.");
  return { name, severity, status, startedAt, resolvedAt, notes: data.notes?.trim() || null, zoneSlugs };
}

function revalidateInjurySurfaces(id?: string) {
  revalidatePath("/");
  revalidatePath("/body");
  revalidatePath("/injuries");
  if (id) revalidatePath(`/injuries/${id}`);
}

export async function getInjuries() {
  return prisma.activeInjury.findMany({
    orderBy: [{ status: "asc" }, { startedAt: "desc" }],
    include: { zones: { include: { zone: true }, orderBy: { zone: { sortOrder: "asc" } } } },
  });
}

export async function getInjury(id: string) {
  return prisma.activeInjury.findUnique({
    where: { id },
    include: {
      zones: { include: { zone: true }, orderBy: { zone: { sortOrder: "asc" } } },
    },
  });
}

export async function createInjury(data: InjuryInput) {
  const input = sanitizeInput(data);
  const zones = await prisma.bodyZone.findMany({
    where: { slug: { in: input.zoneSlugs } },
    select: { id: true },
  });
  const injury = await prisma.activeInjury.create({
    data: {
      name: input.name,
      severity: input.severity,
      status: input.status,
      startedAt: input.startedAt,
      resolvedAt: input.resolvedAt,
      notes: input.notes,
      zones: { create: zones.map((zone) => ({ zoneId: zone.id })) },
    },
    select: { id: true },
  });
  revalidateInjurySurfaces(injury.id);
  return injury.id;
}

export async function updateInjury(id: string, data: InjuryInput) {
  const input = sanitizeInput(data);
  const zones = await prisma.bodyZone.findMany({
    where: { slug: { in: input.zoneSlugs } },
    select: { id: true },
  });
  await prisma.$transaction(async (tx) => {
    await tx.activeInjury.update({
      where: { id },
      data: {
        name: input.name,
        severity: input.severity,
        status: input.status,
        startedAt: input.startedAt,
        resolvedAt: input.resolvedAt,
        notes: input.notes,
      },
    });
    await tx.injuryZone.deleteMany({ where: { injuryId: id } });
    if (zones.length > 0) {
      await tx.injuryZone.createMany({
        data: zones.map((zone) => ({ injuryId: id, zoneId: zone.id })),
        skipDuplicates: true,
      });
    }
  });
  revalidateInjurySurfaces(id);
}

export async function updateInjuryStatus(id: string, status: InjuryStatus) {
  if (!statuses.has(status)) throw new Error("Invalid status.");
  await prisma.activeInjury.update({
    where: { id },
    data: { status, resolvedAt: status === "RESOLVED" ? new Date() : null },
  });
  revalidateInjurySurfaces(id);
}

export async function deleteInjury(id: string) {
  await prisma.activeInjury.delete({ where: { id } });
  revalidateInjurySurfaces(id);
}

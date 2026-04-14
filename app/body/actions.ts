"use server";

import type { ActivitySource, PainContext } from "@/generated/prisma";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";

const painContexts = new Set<PainContext>(["AT_REST", "DURING_ACTIVITY", "AFTER_ACTIVITY", "MORNING", "GENERAL"]);
const activitySources = new Set<ActivitySource>(["EXERCISE", "SPORT_TAG", "MANUAL"]);

export async function logPain(
  input: { zoneSlug: string; level: number; context: PainContext; notes?: string; routineLogId?: string }[]
) {
  const rows = input
    .map((entry) => ({
      zoneSlug: String(entry.zoneSlug || "").trim(),
      level: Math.max(0, Math.min(10, Math.round(Number(entry.level)))),
      context: entry.context,
      notes: entry.notes?.trim() || null,
      routineLogId: entry.routineLogId?.trim() || null,
    }))
    .filter((entry) => entry.zoneSlug && entry.level > 0 && painContexts.has(entry.context));

  if (rows.length === 0) throw new Error("Select at least one zone with pain above 0.");

  const zones = await prisma.bodyZone.findMany({
    where: { slug: { in: rows.map((entry) => entry.zoneSlug) } },
    select: { id: true, slug: true },
  });
  const zoneIdBySlug = new Map(zones.map((zone) => [zone.slug, zone.id]));

  await prisma.painLog.createMany({
    data: rows
      .map((entry) => {
        const zoneId = zoneIdBySlug.get(entry.zoneSlug);
        if (!zoneId) return null;
        return {
          zoneId,
          level: entry.level,
          context: entry.context,
          notes: entry.notes,
          routineLogId: entry.routineLogId,
        };
      })
      .filter((entry): entry is NonNullable<typeof entry> => Boolean(entry)),
  });

  revalidatePath("/");
  revalidatePath("/body");
  for (const row of rows) revalidatePath(`/body/${row.zoneSlug}`);
}

export async function addManualZoneActivity(input: {
  zoneSlug: string;
  performedAt: Date | string;
  label: string;
  intensity?: string | null;
  notes?: string | null;
  source?: ActivitySource;
  routineLogId?: string | null;
}) {
  const zone = await prisma.bodyZone.findUnique({
    where: { slug: input.zoneSlug },
    select: { id: true, slug: true },
  });
  if (!zone) throw new Error("Body zone not found.");

  const label = input.label.trim();
  if (!label) throw new Error("Activity label is required.");

  const source = input.source && activitySources.has(input.source) ? input.source : "MANUAL";
  await prisma.zoneActivity.create({
    data: {
      zoneId: zone.id,
      performedAt: input.performedAt instanceof Date ? input.performedAt : new Date(input.performedAt),
      source,
      label,
      intensity: input.intensity?.trim() || null,
      notes: input.notes?.trim() || null,
      routineLogId: input.routineLogId?.trim() || null,
    },
  });

  revalidatePath("/");
  revalidatePath("/body");
  revalidatePath(`/body/${zone.slug}`);
}

export async function addSportZoneActivities(input: {
  routineLogId: string;
  zoneSlugs: string[];
  label: string;
  intensity?: string | null;
}) {
  const routineLog = await prisma.routineLog.findUnique({
    where: { id: input.routineLogId },
    select: { id: true, performedAt: true },
  });
  if (!routineLog) throw new Error("Routine log not found.");

  const zones = await prisma.bodyZone.findMany({
    where: { slug: { in: Array.from(new Set(input.zoneSlugs)) } },
    select: { id: true, slug: true },
  });
  if (zones.length === 0) return;

  await prisma.zoneActivity.createMany({
    data: zones.map((zone) => ({
      zoneId: zone.id,
      routineLogId: routineLog.id,
      performedAt: routineLog.performedAt,
      source: "SPORT_TAG",
      label: input.label.trim() || "Sport session",
      intensity: input.intensity?.trim() || null,
    })),
  });

  revalidatePath("/");
  revalidatePath("/body");
  for (const zone of zones) revalidatePath(`/body/${zone.slug}`);
}

"use server";

import type { ActivitySource, PainContext } from "@/generated/prisma";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";

const painContexts = new Set<PainContext>(["AT_REST", "DURING_ACTIVITY", "AFTER_ACTIVITY", "MORNING", "GENERAL"]);
const activitySources = new Set<ActivitySource>(["EXERCISE", "SPORT_TAG", "MANUAL"]);

function sanitizeFactors(arr?: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of arr ?? []) {
    const value = (raw ?? "").trim().slice(0, 60);
    const key = value.toLowerCase();
    if (!value || seen.has(key)) continue;
    seen.add(key);
    out.push(value);
  }
  return out;
}

export async function logPain(
  input: { zoneSlug: string; level: number; context: PainContext; notes?: string; routineLogId?: string; aggravatingFactors?: string[] }[]
) {
  const rows = input
    .map((entry) => ({
      zoneSlug: String(entry.zoneSlug || "").trim(),
      level: Math.max(0, Math.min(10, Math.round(Number(entry.level)))),
      context: entry.context,
      notes: entry.notes?.trim() || null,
      routineLogId: entry.routineLogId?.trim() || null,
      aggravatingFactors: sanitizeFactors(entry.aggravatingFactors),
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
          aggravatingFactors: entry.aggravatingFactors,
        };
      })
      .filter((entry): entry is NonNullable<typeof entry> => Boolean(entry)),
  });

  // Union the factors into any active injury covering the affected zones, so
  // the injury's factor list grows as you log pain.
  const factorsByZoneId = new Map<string, string[]>();
  for (const entry of rows) {
    if (entry.aggravatingFactors.length === 0) continue;
    const zoneId = zoneIdBySlug.get(entry.zoneSlug);
    if (!zoneId) continue;
    factorsByZoneId.set(zoneId, [...(factorsByZoneId.get(zoneId) ?? []), ...entry.aggravatingFactors]);
  }
  if (factorsByZoneId.size > 0) {
    const injuries = await prisma.activeInjury.findMany({
      where: {
        status: { in: ["ACTIVE", "FLARED", "RECOVERING"] },
        zones: { some: { zoneId: { in: [...factorsByZoneId.keys()] } } },
      },
      select: { id: true, aggravatingFactors: true, zones: { select: { zoneId: true } } },
    });
    for (const injury of injuries) {
      const incoming = injury.zones.flatMap((z) => factorsByZoneId.get(z.zoneId) ?? []);
      if (incoming.length === 0) continue;
      const seen = new Set(injury.aggravatingFactors.map((f) => f.toLowerCase()));
      const merged = [...injury.aggravatingFactors];
      for (const f of incoming) {
        const key = f.toLowerCase();
        if (!seen.has(key)) {
          seen.add(key);
          merged.push(f);
        }
      }
      if (merged.length !== injury.aggravatingFactors.length) {
        await prisma.activeInjury.update({ where: { id: injury.id }, data: { aggravatingFactors: merged } });
      }
    }
  }

  revalidatePath("/");
  revalidatePath("/body");
  revalidatePath("/injuries");
  for (const row of rows) revalidatePath(`/body/${row.zoneSlug}`);
}

export async function updatePainLog(
  id: string,
  input: { zoneSlug: string; level: number; context: PainContext; notes?: string; aggravatingFactors?: string[] }
) {
  const level = Math.max(0, Math.min(10, Math.round(Number(input.level))));
  if (level <= 0) throw new Error("Pain level must be above 0.");
  if (!painContexts.has(input.context)) throw new Error("Invalid context.");

  const zone = await prisma.bodyZone.findUnique({
    where: { slug: String(input.zoneSlug || "").trim() },
    select: { id: true, slug: true },
  });
  if (!zone) throw new Error("Body zone not found.");

  const existing = await prisma.painLog.findUnique({ where: { id }, select: { zone: { select: { slug: true } } } });

  await prisma.painLog.update({
    where: { id },
    data: {
      zoneId: zone.id,
      level,
      context: input.context,
      notes: input.notes?.trim() || null,
      aggravatingFactors: sanitizeFactors(input.aggravatingFactors),
    },
  });

  revalidatePath("/");
  revalidatePath("/body");
  revalidatePath("/injuries");
  revalidatePath(`/body/${zone.slug}`);
  // Moving a log off its old zone changes that zone's surfaces too.
  if (existing?.zone?.slug && existing.zone.slug !== zone.slug) revalidatePath(`/body/${existing.zone.slug}`);
}

export async function deletePainLog(id: string) {
  const log = await prisma.painLog.findUnique({
    where: { id },
    select: { zone: { select: { slug: true } } },
  });
  if (!log) return;
  await prisma.painLog.delete({ where: { id } });

  revalidatePath("/");
  revalidatePath("/body");
  revalidatePath("/injuries");
  if (log.zone?.slug) revalidatePath(`/body/${log.zone.slug}`);
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


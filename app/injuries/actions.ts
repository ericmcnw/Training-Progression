"use server";

import type { InjuryStatus } from "@/generated/prisma";
import { getAppDayRange } from "@/lib/dates";
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
  aggravatingFactors?: string[];
};

const statuses = new Set<InjuryStatus>(["ACTIVE", "RECOVERING", "RESOLVED", "FLARED"]);

// Common aggravating factors seeded into the typeahead. The user's exercises
// and previously-used factors are merged on top in getAggravatingFactorSuggestions.
const PRESET_AGGRAVATING_FACTORS = [
  "Overhead pressing",
  "Pushing",
  "Pulling",
  "Squatting",
  "Hinging / deadlift",
  "Running",
  "Jumping / landing",
  "Twisting / rotation",
  "Gripping hard",
  "Reaching overhead",
  "Going up stairs",
  "Going down stairs",
  "Sitting too long",
  "Sleeping on it",
  "Foam rolling on it",
  "Stretching it",
  "Overloading it",
  "Cold weather",
];

function sanitizeInput(data: InjuryInput) {
  const name = data.name.trim();
  if (!name) throw new Error("Name is required.");
  const status = statuses.has(data.status) ? data.status : "ACTIVE";
  const severity = Math.max(1, Math.min(5, Math.round(Number(data.severity))));
  const startedAt = data.startedAt ? getAppDayRange(data.startedAt).start : new Date();
  const resolvedAt = status === "RESOLVED" && data.resolvedAt ? getAppDayRange(data.resolvedAt).start : null;
  const zoneSlugs = Array.from(new Set(data.zoneSlugs.map((slug) => slug.trim()).filter(Boolean)));
  if (zoneSlugs.length === 0) throw new Error("Select at least one affected zone.");
  // Dedupe factors case-insensitively, preserve first-seen casing, cap length.
  const seen = new Set<string>();
  const aggravatingFactors: string[] = [];
  for (const raw of data.aggravatingFactors ?? []) {
    const value = raw.trim().slice(0, 60);
    const key = value.toLowerCase();
    if (!value || seen.has(key)) continue;
    seen.add(key);
    aggravatingFactors.push(value);
  }
  return { name, severity, status, startedAt, resolvedAt, notes: data.notes?.trim() || null, zoneSlugs, aggravatingFactors };
}

// Typeahead source: previously-used factors first (most relevant), then the
// preset list, then the user's exercise names. Deduped case-insensitively.
// Pulls past factors from BOTH injuries and pain logs so a factor typed while
// logging pain on an un-injured zone still reappears next time.
export async function getAggravatingFactorSuggestions(): Promise<string[]> {
  const [injuries, painLogs, exercises] = await Promise.all([
    prisma.activeInjury.findMany({ select: { aggravatingFactors: true } }),
    prisma.painLog.findMany({
      where: { NOT: { aggravatingFactors: { isEmpty: true } } },
      select: { aggravatingFactors: true },
      orderBy: { loggedAt: "desc" },
      take: 200,
    }),
    prisma.exercise.findMany({ select: { name: true }, orderBy: { name: "asc" } }),
  ]);
  const past = [
    ...injuries.flatMap((injury) => injury.aggravatingFactors),
    ...painLogs.flatMap((log) => log.aggravatingFactors),
  ];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const value of [...past, ...PRESET_AGGRAVATING_FACTORS, ...exercises.map((e) => e.name)]) {
    const trimmed = value.trim();
    const key = trimmed.toLowerCase();
    if (!trimmed || seen.has(key)) continue;
    seen.add(key);
    out.push(trimmed);
  }
  return out;
}

function revalidateInjurySurfaces(id?: string) {
  revalidatePath("/");
  revalidatePath("/body");
  revalidatePath("/profile/health");
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
      aggravatingFactors: input.aggravatingFactors,
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
        aggravatingFactors: input.aggravatingFactors,
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

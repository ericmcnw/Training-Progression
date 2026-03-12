"use server";

import { randomUUID } from "crypto";
import { todayAppYmd } from "@/lib/dates";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

const MIN_CYCLE_DAYS = 1;
const MAX_CYCLE_DAYS = 60;

function clampCycleDays(value: number) {
  return Math.max(MIN_CYCLE_DAYS, Math.min(MAX_CYCLE_DAYS, Math.floor(value)));
}

function makeId() {
  return randomUUID().replace(/-/g, "");
}

function normalizeDateInput(dateInput: string) {
  const value = dateInput.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error("Invalid date.");
  return `${value}T00:00:00.000Z`;
}

function parseUtcDayStart(ymd: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(ymd)) throw new Error("Invalid date.");
  return new Date(`${ymd}T00:00:00.000Z`);
}

function nextUtcDayStart(date: Date) {
  return new Date(date.getTime() + 24 * 60 * 60 * 1000);
}

export async function createCyclePlan(formData: FormData) {
  const returnMode = String(formData.get("returnMode") || "cycle");
  const name = String(formData.get("name") || "").trim() || "New Cycle";
  const raw = Number(String(formData.get("cycleLengthDays") || "7"));
  const cycleLengthDays = clampCycleDays(Number.isFinite(raw) ? raw : 7);
  const startDateInput = String(formData.get("startDate") || "").trim();
  const startDateIso = startDateInput ? normalizeDateInput(startDateInput) : `${todayAppYmd()}T00:00:00.000Z`;

  const planId = makeId();
  const activationId = makeId();

  await prisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe(
      'INSERT INTO "SchedulePlan" ("id","name","cycleLengthDays","isActive","createdAt","updatedAt") VALUES (?,?,?,?,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)',
      planId,
      name,
      cycleLengthDays,
      false
    );
    await tx.$executeRawUnsafe(
      'INSERT INTO "SchedulePlanActivation" ("id","schedulePlanId","isEnabled","startDate","createdAt","updatedAt") VALUES (?,?,?,?,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)',
      activationId,
      planId,
      false,
      startDateIso
    );
  });

  revalidatePath("/schedule");
  redirect(`/schedule?mode=${encodeURIComponent(returnMode)}&planId=${planId}`);
}

export async function updateCyclePlan(formData: FormData) {
  const planId = String(formData.get("planId") || "");
  const returnMode = String(formData.get("returnMode") || "cycle");
  const name = String(formData.get("name") || "").trim();
  const raw = Number(String(formData.get("cycleLengthDays") || "7"));
  const cycleLengthDays = clampCycleDays(Number.isFinite(raw) ? raw : 7);

  if (!planId) throw new Error("Missing planId.");
  if (!name) throw new Error("Plan name is required.");

  await prisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe(
      'UPDATE "SchedulePlan" SET "name" = ?, "cycleLengthDays" = ?, "updatedAt" = CURRENT_TIMESTAMP WHERE "id" = ?',
      name,
      cycleLengthDays,
      planId
    );
    await tx.$executeRawUnsafe(
      'DELETE FROM "ScheduleEntry" WHERE "schedulePlanId" = ? AND "dayOffset" >= ?',
      planId,
      cycleLengthDays
    );
  });

  revalidatePath("/schedule");
  redirect(`/schedule?mode=${encodeURIComponent(returnMode)}&planId=${planId}`);
}

export async function setCycleActivation(formData: FormData) {
  const planId = String(formData.get("planId") || "");
  const returnMode = String(formData.get("returnMode") || "schedule");
  const isEnabled = String(formData.get("isEnabled") || "") === "on";
  const startDateInput = String(formData.get("startDate") || "").trim();
  const startDateIso = normalizeDateInput(startDateInput);

  if (!planId) throw new Error("Missing planId.");

  const existing = await prisma.$queryRawUnsafe<Array<{ id: string }>>(
    'SELECT "id" FROM "SchedulePlanActivation" WHERE "schedulePlanId" = ? LIMIT 1',
    planId
  );

  if (existing[0]) {
    await prisma.$executeRawUnsafe(
      'UPDATE "SchedulePlanActivation" SET "isEnabled" = ?, "startDate" = ?, "updatedAt" = CURRENT_TIMESTAMP WHERE "schedulePlanId" = ?',
      isEnabled,
      startDateIso,
      planId
    );
  } else {
    await prisma.$executeRawUnsafe(
      'INSERT INTO "SchedulePlanActivation" ("id","schedulePlanId","isEnabled","startDate","createdAt","updatedAt") VALUES (?,?,?,?,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)',
      makeId(),
      planId,
      isEnabled,
      startDateIso
    );
  }

  revalidatePath("/schedule");
  redirect(`/schedule?mode=${encodeURIComponent(returnMode)}&planId=${planId}`);
}

type IncomingCycleEntry = {
  routineId: string;
  dayOffset: number;
  sortOrder: number;
};

export async function saveCycleEntries(formData: FormData) {
  const planId = String(formData.get("planId") || "");
  const returnMode = String(formData.get("returnMode") || "cycle");
  const entriesRaw = String(formData.get("entriesJson") || "[]");
  if (!planId) throw new Error("Missing planId.");

  let parsed: unknown;
  try {
    parsed = JSON.parse(entriesRaw);
  } catch {
    throw new Error("Invalid entries payload.");
  }

  const planRow = await prisma.$queryRawUnsafe<Array<{ cycleLengthDays: number }>>(
    'SELECT "cycleLengthDays" FROM "SchedulePlan" WHERE "id" = ? LIMIT 1',
    planId
  );
  if (!planRow[0]) throw new Error("Schedule plan not found.");
  const cycleLengthDays = Number(planRow[0].cycleLengthDays);

  if (!Array.isArray(parsed)) throw new Error("Entries payload must be an array.");
  const entries: IncomingCycleEntry[] = [];
  for (const item of parsed) {
    if (!item || typeof item !== "object") continue;
    const rec = item as Record<string, unknown>;
    const routineId = String(rec.routineId || "");
    const dayOffset = Number(rec.dayOffset);
    const sortOrder = Number(rec.sortOrder);
    if (!routineId) continue;
    if (!Number.isInteger(dayOffset) || dayOffset < 0 || dayOffset >= cycleLengthDays) continue;
    if (!Number.isInteger(sortOrder) || sortOrder < 0) continue;
    entries.push({ routineId, dayOffset, sortOrder });
  }

  const routineIds = Array.from(new Set(entries.map((entry) => entry.routineId)));
  if (routineIds.length > 0) {
    const placeholders = routineIds.map(() => "?").join(",");
    const validRows = await prisma.$queryRawUnsafe<Array<{ id: string }>>(
      `SELECT "id" FROM "Routine" WHERE "isDeleted" = false AND "id" IN (${placeholders})`,
      ...routineIds
    );
    const validSet = new Set(validRows.map((row) => row.id));
    for (let i = entries.length - 1; i >= 0; i -= 1) {
      if (!validSet.has(entries[i].routineId)) entries.splice(i, 1);
    }
  }

  entries.sort((a, b) => a.dayOffset - b.dayOffset || a.sortOrder - b.sortOrder || a.routineId.localeCompare(b.routineId));

  await prisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe('DELETE FROM "ScheduleEntry" WHERE "schedulePlanId" = ?', planId);
    for (const entry of entries) {
      await tx.$executeRawUnsafe(
        'INSERT INTO "ScheduleEntry" ("id","schedulePlanId","routineId","dayOffset","sortOrder","createdAt","updatedAt") VALUES (?,?,?,?,?,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)',
        makeId(),
        planId,
        entry.routineId,
        entry.dayOffset,
        entry.sortOrder
      );
    }
  });

  revalidatePath("/schedule");
  redirect(`/schedule?mode=${encodeURIComponent(returnMode)}&planId=${planId}`);
}

type IncomingManualEntry = {
  routineId: string;
  scheduledDate: string;
  sortOrder: number;
};

export async function saveManualEntries(formData: FormData) {
  const entriesRaw = String(formData.get("manualEntriesJson") || "[]");

  let parsed: unknown;
  try {
    parsed = JSON.parse(entriesRaw);
  } catch {
    throw new Error("Invalid manual entries payload.");
  }
  if (!Array.isArray(parsed)) throw new Error("Manual entries payload must be an array.");

  const entries: IncomingManualEntry[] = [];
  for (const item of parsed) {
    if (!item || typeof item !== "object") continue;
    const rec = item as Record<string, unknown>;
    const routineId = String(rec.routineId || "");
    const scheduledDate = String(rec.scheduledDate || "");
    const sortOrder = Number(rec.sortOrder);
    if (!routineId) continue;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(scheduledDate)) continue;
    if (!Number.isInteger(sortOrder) || sortOrder < 0) continue;
    entries.push({ routineId, scheduledDate, sortOrder });
  }

  const routineIds = Array.from(new Set(entries.map((entry) => entry.routineId)));
  if (routineIds.length > 0) {
    const placeholders = routineIds.map(() => "?").join(",");
    const validRows = await prisma.$queryRawUnsafe<Array<{ id: string }>>(
      `SELECT "id" FROM "Routine" WHERE "isDeleted" = false AND "id" IN (${placeholders})`,
      ...routineIds
    );
    const validSet = new Set(validRows.map((row) => row.id));
    for (let i = entries.length - 1; i >= 0; i -= 1) {
      if (!validSet.has(entries[i].routineId)) entries.splice(i, 1);
    }
  }

  entries.sort(
    (a, b) =>
      a.scheduledDate.localeCompare(b.scheduledDate) ||
      a.sortOrder - b.sortOrder ||
      a.routineId.localeCompare(b.routineId)
  );

  await prisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe('DELETE FROM "ScheduleManualEntry"');
    for (const entry of entries) {
      await tx.$executeRawUnsafe(
        'INSERT INTO "ScheduleManualEntry" ("id","routineId","scheduledDate","sortOrder","createdAt","updatedAt") VALUES (?,?,?, ?,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)',
        makeId(),
        entry.routineId,
        `${entry.scheduledDate}T00:00:00.000Z`,
        entry.sortOrder
      );
    }
  });

  revalidatePath("/schedule");
  redirect("/schedule");
}

export async function quickAddManualEntry(formData: FormData) {
  const routineId = String(formData.get("routineId") || "").trim();
  const scheduledDate = String(formData.get("scheduledDate") || "").trim();
  const returnStart = String(formData.get("returnStart") || "").trim();
  const returnMonth = String(formData.get("returnMonth") || "").trim();

  if (!routineId) throw new Error("Missing routineId.");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(scheduledDate)) throw new Error("Invalid scheduled date.");

  const routine = await prisma.routine.findFirst({
    where: { id: routineId, isDeleted: false },
    select: { id: true },
  });
  if (!routine) throw new Error("Routine not found.");

  const dayStart = parseUtcDayStart(scheduledDate);
  const nextDayStart = nextUtcDayStart(dayStart);
  const existing = await prisma.scheduleManualEntry.aggregate({
    where: {
      scheduledDate: {
        gte: dayStart,
        lt: nextDayStart,
      },
    },
    _max: { sortOrder: true },
  });
  const nextSortOrder = (existing._max.sortOrder ?? -1) + 1;

  await prisma.scheduleManualEntry.create({
    data: {
      id: makeId(),
      routineId,
      scheduledDate: dayStart,
      sortOrder: nextSortOrder,
    },
  });

  revalidatePath("/schedule");
  const params = new URLSearchParams();
  if (/^\d{4}-\d{2}-\d{2}$/.test(returnStart)) params.set("start", returnStart);
  if (/^\d{4}-\d{2}$/.test(returnMonth)) params.set("month", returnMonth);
  redirect(params.size > 0 ? `/schedule?${params.toString()}` : "/schedule");
}

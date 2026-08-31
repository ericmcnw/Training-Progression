"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getAppSession } from "@/lib/auth";
import { todayAppYmd } from "@/lib/dates";
import type { ProgramBlockStatus, ProgramStageStatus, ProgramTargetItemStatus } from "@/generated/prisma";

async function requireProgram(programId: string) {
  const session = await getAppSession();
  const program = await prisma.focus.findFirst({
    where: { id: programId, profileKey: session.profileKey },
    select: { id: true },
  });
  if (!program) throw new Error("Program not found.");
  return program;
}

function revalidateProgram(programId: string) {
  revalidatePath("/programs");
  revalidatePath(`/programs/${programId}`);
  revalidatePath(`/programs/${programId}/edit`);
  revalidatePath("/plan");
  revalidatePath("/");
}

function ids(formData: FormData, name: string) {
  return Array.from(new Set(formData.getAll(name).map(String).map((value) => value.trim()).filter(Boolean)));
}

export async function saveProgramRelationships(formData: FormData) {
  const programId = String(formData.get("programId") || "");
  await requireProgram(programId);
  const routineIds = ids(formData, "routineId");
  const goalIds = ids(formData, "goalId");
  const frequencyGoalIds = ids(formData, "frequencyGoalId");

  const [validRoutines, validGoals, validFrequencyGoals] = await Promise.all([
    prisma.routine.findMany({ where: { id: { in: routineIds }, isDeleted: false }, select: { id: true } }),
    prisma.goal.findMany({ where: { id: { in: goalIds } }, select: { id: true } }),
    prisma.frequencyGoal.findMany({ where: { id: { in: frequencyGoalIds } }, select: { id: true } }),
  ]);

  await prisma.$transaction([
    prisma.programRoutine.deleteMany({ where: { programId } }),
    prisma.programGoal.deleteMany({ where: { programId } }),
    prisma.programFrequencyGoal.deleteMany({ where: { programId } }),
    ...validRoutines.map((routine, sortOrder) =>
      prisma.programRoutine.create({ data: { programId, routineId: routine.id, sortOrder } })
    ),
    ...validGoals.map((goal, sortOrder) =>
      prisma.programGoal.create({ data: { programId, goalId: goal.id, role: "PRIMARY", sortOrder } })
    ),
    ...validFrequencyGoals.map((goal, sortOrder) =>
      prisma.programFrequencyGoal.create({
        data: { programId, frequencyGoalId: goal.id, role: "SUPPORTING", sortOrder },
      })
    ),
  ]);
  revalidateProgram(programId);
}

function cleanYmd(value: FormDataEntryValue | null) {
  const raw = String(value || "").trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(raw) ? raw : null;
}

export async function createProgramStage(formData: FormData) {
  const programId = String(formData.get("programId") || "");
  await requireProgram(programId);
  const name = String(formData.get("name") || "").trim();
  if (!name) throw new Error("Stage needs a name.");
  const last = await prisma.programStage.aggregate({ where: { programId }, _max: { sortOrder: true } });
  const existing = await prisma.programStage.count({ where: { programId } });
  await prisma.programStage.create({
    data: {
      programId,
      name,
      description: String(formData.get("description") || "").trim() || null,
      status: existing === 0 ? "ACTIVE" : "PLANNED",
      notBeforeYmd: cleanYmd(formData.get("notBeforeYmd")),
      targetEndYmd: cleanYmd(formData.get("targetEndYmd")),
      sortOrder: (last._max.sortOrder ?? -1) + 1,
    },
  });
  revalidateProgram(programId);
}

export async function setProgramStageStatus(formData: FormData) {
  const programId = String(formData.get("programId") || "");
  await requireProgram(programId);
  const stageId = String(formData.get("stageId") || "");
  const rawStatus = String(formData.get("status") || "");
  const allowed = new Set<ProgramStageStatus>(["PLANNED", "ACTIVE", "COMPLETED", "SKIPPED"]);
  if (!allowed.has(rawStatus as ProgramStageStatus)) throw new Error("Invalid stage status.");
  const status = rawStatus as ProgramStageStatus;
  const stage = await prisma.programStage.findFirst({ where: { id: stageId, programId }, select: { id: true, startedAt: true } });
  if (!stage) throw new Error("Stage not found.");
  const now = new Date();
  if (status === "ACTIVE") {
    await prisma.$transaction([
      prisma.programStage.updateMany({
        where: { programId, status: "ACTIVE", id: { not: stageId } },
        data: { status: "COMPLETED", completedAt: now },
      }),
      prisma.programStage.update({
        where: { id: stageId },
        data: { status, startedAt: stage.startedAt ?? now, completedAt: null },
      }),
    ]);
  } else {
    await prisma.programStage.update({
      where: { id: stageId },
      data: {
        status,
        startedAt: status === "PLANNED" ? null : undefined,
        completedAt: status === "COMPLETED" || status === "SKIPPED" ? now : null,
      },
    });
  }
  revalidateProgram(programId);
}

export async function createProgramBlock(formData: FormData) {
  const programId = String(formData.get("programId") || "");
  await requireProgram(programId);
  const name = String(formData.get("name") || "").trim();
  if (!name) throw new Error("Block needs a name.");
  const stageId = String(formData.get("stageId") || "").trim() || null;
  if (stageId) {
    const stage = await prisma.programStage.findFirst({ where: { id: stageId, programId }, select: { id: true } });
    if (!stage) throw new Error("Stage not found.");
  }
  const rawWeeks = Number(formData.get("lengthWeeks"));
  const lengthWeeks = Number.isFinite(rawWeeks) && rawWeeks > 0 ? Math.min(52, Math.round(rawWeeks)) : null;
  const last = await prisma.programBlock.aggregate({ where: { programId }, _max: { sortOrder: true } });
  await prisma.programBlock.create({
    data: {
      programId,
      stageId,
      name,
      description: String(formData.get("description") || "").trim() || null,
      status: "DRAFT",
      scheduleMode: "FLEXIBLE",
      lengthWeeks,
      startYmd: cleanYmd(formData.get("startYmd")),
      sortOrder: (last._max.sortOrder ?? -1) + 1,
    },
  });
  revalidateProgram(programId);
}

export async function setProgramBlockStatus(formData: FormData) {
  const programId = String(formData.get("programId") || "");
  await requireProgram(programId);
  const blockId = String(formData.get("blockId") || "");
  const rawStatus = String(formData.get("status") || "");
  const allowed = new Set<ProgramBlockStatus>(["DRAFT", "ACTIVE", "COMPLETED", "ARCHIVED"]);
  if (!allowed.has(rawStatus as ProgramBlockStatus)) throw new Error("Invalid block status.");
  const status = rawStatus as ProgramBlockStatus;
  const block = await prisma.programBlock.findFirst({ where: { id: blockId, programId }, select: { id: true, startYmd: true } });
  if (!block) throw new Error("Block not found.");
  if (status === "ACTIVE") {
    await prisma.$transaction([
      prisma.programBlock.updateMany({
        where: { programId, status: "ACTIVE", id: { not: blockId } },
        data: { status: "COMPLETED", endYmd: todayAppYmd() },
      }),
      prisma.programBlock.update({
        where: { id: blockId },
        data: { status, startYmd: block.startYmd ?? todayAppYmd(), endYmd: null },
      }),
    ]);
  } else {
    await prisma.programBlock.update({
      where: { id: blockId },
      data: {
        status,
        startYmd: status === "DRAFT" ? null : undefined,
        endYmd: status === "COMPLETED" || status === "ARCHIVED" ? todayAppYmd() : null,
      },
    });
  }
  revalidateProgram(programId);
}

export async function addProgramBlockRoutine(formData: FormData) {
  const programId = String(formData.get("programId") || "");
  await requireProgram(programId);
  const blockId = String(formData.get("blockId") || "");
  const routineId = String(formData.get("routineId") || "");
  const [block, routine] = await Promise.all([
    prisma.programBlock.findFirst({ where: { id: blockId, programId }, select: { id: true } }),
    prisma.routine.findFirst({ where: { id: routineId, isDeleted: false }, select: { id: true, name: true } }),
  ]);
  if (!block || !routine) throw new Error("Block or routine not found.");
  const existingItem = await prisma.programBlockItem.findFirst({
    where: { blockId, kind: "ROUTINE", routineId },
    select: { id: true },
  });
  if (existingItem) throw new Error("That routine is already in this block.");
  const rawTarget = Number(formData.get("targetPerWeek"));
  const targetPerWeek = Number.isFinite(rawTarget) && rawTarget > 0 ? Math.min(21, rawTarget) : null;
  const last = await prisma.programBlockItem.aggregate({ where: { blockId }, _max: { sortOrder: true } });
  await prisma.programBlockItem.create({
    data: {
      blockId,
      kind: "ROUTINE",
      routineId,
      label: routine.name,
      targetPerWeek,
      notes: String(formData.get("notes") || "").trim() || null,
      sortOrder: (last._max.sortOrder ?? -1) + 1,
    },
  });
  revalidateProgram(programId);
}

/** Add visible phase work while retaining ProgramBlock as an internal
 * compatibility container. The user never has to create or name that layer. */
export async function addProgramPhaseRoutine(formData: FormData) {
  const programId = String(formData.get("programId") || "");
  await requireProgram(programId);
  const routineId = String(formData.get("routineId") || "");
  if (!routineId) throw new Error("Choose a routine.");
  const routine = await prisma.routine.findFirst({
    where: { id: routineId, isDeleted: false },
    select: { id: true, name: true },
  });
  if (!routine) throw new Error("Routine not found.");
  const lastRoutineLink = await prisma.programRoutine.aggregate({ where: { programId }, _max: { sortOrder: true } });
  await prisma.programRoutine.upsert({
    where: { programId_routineId: { programId, routineId } },
    update: {},
    create: { programId, routineId, sortOrder: (lastRoutineLink._max.sortOrder ?? -1) + 1 },
  });

  let stageId = String(formData.get("stageId") || "").trim() || null;
  let stage = stageId
    ? await prisma.programStage.findFirst({ where: { id: stageId, programId }, select: { id: true, name: true } })
    : await prisma.programStage.findFirst({
        where: { programId, status: "ACTIVE" },
        orderBy: { sortOrder: "asc" },
        select: { id: true, name: true },
      });
  if (!stage) {
    const lastStage = await prisma.programStage.aggregate({ where: { programId }, _max: { sortOrder: true } });
    stage = await prisma.programStage.create({
      data: { programId, name: "Current phase", status: "ACTIVE", sortOrder: (lastStage._max.sortOrder ?? -1) + 1 },
      select: { id: true, name: true },
    });
  }
  stageId = stage.id;

  let block = await prisma.programBlock.findFirst({
    where: { programId, stageId },
    orderBy: { sortOrder: "asc" },
    select: { id: true },
  });
  if (!block) {
    const lastBlock = await prisma.programBlock.aggregate({ where: { programId }, _max: { sortOrder: true } });
    block = await prisma.programBlock.create({
      data: {
        programId,
        stageId,
        name: stage.name,
        status: "ACTIVE",
        scheduleMode: "FLEXIBLE",
        sortOrder: (lastBlock._max.sortOrder ?? -1) + 1,
      },
      select: { id: true },
    });
  }

  const existing = await prisma.programBlockItem.findFirst({ where: { blockId: block.id, routineId }, select: { id: true } });
  if (existing) return;
  const last = await prisma.programBlockItem.aggregate({ where: { blockId: block.id }, _max: { sortOrder: true } });
  const rawTarget = Number(formData.get("targetPerWeek"));
  await prisma.programBlockItem.create({
    data: {
      blockId: block.id,
      kind: "ROUTINE",
      routineId,
      label: routine.name,
      targetPerWeek: Number.isFinite(rawTarget) && rawTarget > 0 ? Math.min(21, rawTarget) : null,
      sortOrder: (last._max.sortOrder ?? -1) + 1,
    },
  });
  revalidateProgram(programId);
}

export async function removeProgramBlockItem(formData: FormData) {
  const programId = String(formData.get("programId") || "");
  await requireProgram(programId);
  const itemId = String(formData.get("itemId") || "");
  const item = await prisma.programBlockItem.findFirst({
    where: { id: itemId, block: { programId } },
    select: { id: true },
  });
  if (!item) throw new Error("Block item not found.");
  await prisma.programBlockItem.delete({ where: { id: itemId } });
  revalidateProgram(programId);
}

export async function createProgramTargetList(formData: FormData) {
  const programId = String(formData.get("programId") || "");
  await requireProgram(programId);
  const name = String(formData.get("name") || "").trim();
  if (!name) throw new Error("List needs a name.");
  const last = await prisma.programTargetList.aggregate({ where: { programId }, _max: { sortOrder: true } });
  await prisma.programTargetList.create({
    data: {
      programId,
      name,
      description: String(formData.get("description") || "").trim() || null,
      kind: formData.get("kind") === "PROGRESSION" ? "PROGRESSION" : "CHECKLIST",
      sportSlug: String(formData.get("sportSlug") || "").trim() || null,
      sortOrder: (last._max.sortOrder ?? -1) + 1,
    },
  });
  revalidateProgram(programId);
}

export async function addProgramTargetItem(formData: FormData) {
  const programId = String(formData.get("programId") || "");
  await requireProgram(programId);
  const listId = String(formData.get("listId") || "");
  const list = await prisma.programTargetList.findFirst({ where: { id: listId, programId }, select: { id: true } });
  if (!list) throw new Error("Target list not found.");
  const label = String(formData.get("label") || "").trim();
  if (!label) throw new Error("Target needs a label.");
  const last = await prisma.programTargetListItem.aggregate({ where: { listId }, _max: { sortOrder: true } });
  await prisma.programTargetListItem.create({
    data: {
      listId,
      label,
      description: String(formData.get("description") || "").trim() || null,
      sortOrder: (last._max.sortOrder ?? -1) + 1,
    },
  });
  revalidateProgram(programId);
}

export async function setProgramTargetItemStatus(formData: FormData) {
  const programId = String(formData.get("programId") || "");
  await requireProgram(programId);
  const itemId = String(formData.get("itemId") || "");
  const rawStatus = String(formData.get("status") || "");
  const allowed = new Set<ProgramTargetItemStatus>(["ACTIVE", "COMPLETED", "DROPPED"]);
  if (!allowed.has(rawStatus as ProgramTargetItemStatus)) throw new Error("Invalid target status.");
  const item = await prisma.programTargetListItem.findFirst({
    where: { id: itemId, list: { programId } },
    select: { id: true },
  });
  if (!item) throw new Error("Target not found.");
  const status = rawStatus as ProgramTargetItemStatus;
  await prisma.programTargetListItem.update({
    where: { id: itemId },
    data: { status, completedAt: status === "COMPLETED" ? new Date() : null },
  });
  revalidateProgram(programId);
}

export async function moveProgramTargetItem(formData: FormData) {
  const programId = String(formData.get("programId") || "");
  await requireProgram(programId);
  const itemId = String(formData.get("itemId") || "");
  const direction = String(formData.get("direction") || "") === "up" ? -1 : 1;
  const item = await prisma.programTargetListItem.findFirst({
    where: { id: itemId, list: { programId } },
    select: { id: true, listId: true },
  });
  if (!item) throw new Error("Target not found.");
  const ordered = await prisma.programTargetListItem.findMany({
    where: { listId: item.listId },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    select: { id: true },
  });
  const currentIndex = ordered.findIndex((row) => row.id === itemId);
  const swapIndex = currentIndex + direction;
  if (currentIndex < 0 || swapIndex < 0 || swapIndex >= ordered.length) return;
  await prisma.$transaction([
    prisma.programTargetListItem.update({ where: { id: ordered[currentIndex].id }, data: { sortOrder: swapIndex } }),
    prisma.programTargetListItem.update({ where: { id: ordered[swapIndex].id }, data: { sortOrder: currentIndex } }),
  ]);
  revalidateProgram(programId);
}

export async function addProgramGoalCheckpoint(formData: FormData) {
  const programId = String(formData.get("programId") || "");
  await requireProgram(programId);
  const goalId = String(formData.get("goalId") || "");
  const link = await prisma.programGoal.findFirst({
    where: { programId, goalId },
    select: { id: true },
  });
  if (!link) throw new Error("Goal is not connected to this Program.");
  const raw = String(formData.get("value") || "").trim();
  if (!raw) throw new Error("Enter a checkpoint value.");
  const parsed = Number(raw);
  const isNumber = Number.isFinite(parsed);
  const measuredYmd = cleanYmd(formData.get("measuredYmd")) ?? todayAppYmd();
  const isBaseline = String(formData.get("isBaseline") || "") === "1";
  await prisma.$transaction(async (tx) => {
    if (isBaseline) {
      await tx.goalCheckpoint.updateMany({ where: { goalId, isBaseline: true }, data: { isBaseline: false } });
    }
    await tx.goalCheckpoint.create({
      data: {
        goalId,
        measuredAt: new Date(`${measuredYmd}T12:00:00.000Z`),
        numberValue: isNumber ? parsed : null,
        textValue: isNumber ? null : raw,
        source: "MANUAL",
        isBaseline,
        notes: String(formData.get("notes") || "").trim() || null,
      },
    });
  });
  revalidateProgram(programId);
  revalidatePath(`/goals/${goalId}`);
}

export async function createPlannedSession(formData: FormData) {
  const programId = String(formData.get("programId") || "");
  await requireProgram(programId);
  const currentYmd = cleanYmd(formData.get("currentYmd"));
  if (!currentYmd) throw new Error("Choose a date.");
  const blockItemId = String(formData.get("blockItemId") || "").trim() || null;
  const requestedRoutineId = String(formData.get("routineId") || "").trim() || null;
  let blockId: string | null = null;
  let routineId = requestedRoutineId;
  let label = String(formData.get("label") || "").trim();
  if (blockItemId) {
    const item = await prisma.programBlockItem.findFirst({
      where: { id: blockItemId, block: { programId } },
      select: { id: true, label: true, routineId: true, blockId: true },
    });
    if (!item) throw new Error("Training item not found.");
    blockId = item.blockId;
    routineId = item.routineId ?? routineId;
    label ||= item.label;
  }
  if (routineId) {
    const routine = await prisma.routine.findFirst({ where: { id: routineId, isDeleted: false }, select: { id: true, name: true } });
    if (!routine) throw new Error("Routine not found.");
    label ||= routine.name;
  }
  if (!label) throw new Error("Name the planned session.");
  const last = await prisma.plannedSession.aggregate({ where: { programId, currentYmd }, _max: { sortOrder: true } });
  await prisma.plannedSession.create({
    data: {
      programId,
      blockId,
      blockItemId,
      routineId,
      label,
      originalYmd: currentYmd,
      currentYmd,
      pinned: String(formData.get("pinned") || "") === "1",
      sortOrder: (last._max.sortOrder ?? -1) + 1,
    },
  });
  revalidateProgram(programId);
}

export async function updatePlannedSession(formData: FormData) {
  const programId = String(formData.get("programId") || "");
  await requireProgram(programId);
  const sessionId = String(formData.get("sessionId") || "");
  const mode = String(formData.get("mode") || "");
  const planned = await prisma.plannedSession.findFirst({ where: { id: sessionId, programId }, select: { id: true, currentYmd: true } });
  if (!planned) throw new Error("Planned session not found.");
  if (mode === "SKIP") {
    await prisma.plannedSession.update({ where: { id: sessionId }, data: { status: "SKIPPED" } });
    revalidateProgram(programId);
    return;
  }
  if (mode === "DELETE") {
    await prisma.plannedSession.delete({ where: { id: sessionId } });
    revalidateProgram(programId);
    return;
  }
  const targetYmd = cleanYmd(formData.get("targetYmd"));
  if (!targetYmd) throw new Error("Choose a new date.");
  if (mode === "MOVE_ONE") {
    await prisma.plannedSession.update({ where: { id: sessionId }, data: { currentYmd: targetYmd } });
    revalidateProgram(programId);
    return;
  }
  if (mode !== "SLIDE") throw new Error("Invalid schedule action.");
  const delta = ymdDayNumber(targetYmd) - ymdDayNumber(planned.currentYmd);
  const affected = await prisma.plannedSession.findMany({
    where: { programId, status: "PLANNED", pinned: false, currentYmd: { gte: planned.currentYmd } },
    select: { id: true, currentYmd: true },
  });
  await prisma.$transaction(affected.map((session) => prisma.plannedSession.update({ where: { id: session.id }, data: { currentYmd: addYmdDays(session.currentYmd, delta) } })));
  revalidateProgram(programId);
}

function ymdDayNumber(ymd: string) {
  const [year, month, day] = ymd.split("-").map(Number);
  return Math.floor(Date.UTC(year, month - 1, day) / 86_400_000);
}

function addYmdDays(ymd: string, days: number) {
  return new Date((ymdDayNumber(ymd) + days) * 86_400_000).toISOString().slice(0, 10);
}

export async function continueProgramCycle(formData: FormData) {
  const programId = String(formData.get("programId") || "");
  await requireProgram(programId);
  const session = await getAppSession();
  const source = await prisma.focus.findFirst({
    where: { id: programId, profileKey: session.profileKey },
    include: {
      routineLinks: true,
      goalLinks: true,
      frequencyGoalLinks: true,
      targetLists: { include: { items: true } },
    },
  });
  if (!source) throw new Error("Program not found.");
  const carryRoutines = String(formData.get("carryRoutines") || "") === "1";
  const carryGoals = String(formData.get("carryGoals") || "") === "1";
  const carryTargets = String(formData.get("carryTargets") || "") === "1";
  const created = await prisma.focus.create({
    data: {
      name: String(formData.get("name") || "").trim() || `${source.name} - next cycle`,
      description: source.description,
      status: "PLANNED",
      sortOrder: source.sortOrder - 1,
      color: source.color,
      icon: source.icon,
      season: null,
      phase: "BUILD",
      pursuitKey: source.pursuitKey,
      linkedInjuryId: source.linkedInjuryId,
      profileKey: source.profileKey,
      objectiveKind: source.objectiveKind,
      timelineMode: "REVIEW_DATE",
      continuedFromId: source.id,
      ...(carryRoutines ? { routineLinks: { create: source.routineLinks.map((link) => ({ routineId: link.routineId, role: link.role, sortOrder: link.sortOrder })) } } : {}),
      ...(carryGoals ? {
        goalLinks: { create: source.goalLinks.map((link) => ({ goalId: link.goalId, role: link.role, sortOrder: link.sortOrder })) },
        frequencyGoalLinks: { create: source.frequencyGoalLinks.map((link) => ({ frequencyGoalId: link.frequencyGoalId, role: link.role, sortOrder: link.sortOrder })) },
      } : {}),
      ...(carryTargets ? { targetLists: { create: source.targetLists.map((list) => ({ name: list.name, description: list.description, kind: list.kind, sportSlug: list.sportSlug, sortOrder: list.sortOrder, items: { create: list.items.filter((item) => item.status === "ACTIVE").map((item) => ({ label: item.label, description: item.description, climbProblemId: item.climbProblemId, refKind: item.refKind, refId: item.refId, sortOrder: item.sortOrder })) } })) } } : {}),
    },
    select: { id: true },
  });
  revalidateProgram(programId);
  redirect(`/programs/${created.id}/edit`);
}

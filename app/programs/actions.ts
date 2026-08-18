"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getAppSession } from "@/lib/auth";

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


"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { GOAL_TYPE } from "@/lib/progress";

function parseRoutinePlannedType(goalType: string) {
  if (!goalType.startsWith(`${GOAL_TYPE.routinePlannedPerWeek}:`)) return null;
  const [, routineId] = goalType.split(":");
  return routineId || null;
}

export async function deleteGoal(input: { goalId?: string; goalType?: string }) {
  const goalId = input.goalId?.trim();
  const goalType = input.goalType?.trim();

  if (!goalId && !goalType) {
    throw new Error("Goal id or goal type is required.");
  }

  if (goalId) {
    await prisma.goal.delete({ where: { id: goalId } });
  } else if (goalType) {
    await prisma.goal.deleteMany({ where: { type: goalType, isActive: true } });
    const routineId = parseRoutinePlannedType(goalType);
    if (routineId) {
      await prisma.routine.update({
        where: { id: routineId },
        data: { timesPerWeek: null },
      });
    }
  }

  revalidatePath("/goals");
  revalidatePath("/progress");
  revalidatePath("/schedule");
}

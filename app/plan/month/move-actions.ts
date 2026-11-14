"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getAppDayRange } from "@/lib/dates";
import type { PlanSource } from "./data";

export async function movePlannedEntry(input: { source: PlanSource; toYmd: string }) {
  const { source, toYmd } = input;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(toYmd)) throw new Error("Invalid date.");

  if (source.kind === "manual") {
    const entry = await prisma.scheduleManualEntry.findFirst({ where: { id: source.id }, select: { id: true } });
    if (!entry) throw new Error("That plan is gone. Refresh and try again.");
    const { start, end } = getAppDayRange(toYmd);
    const last = await prisma.scheduleManualEntry.aggregate({
      where: { scheduledDate: { gte: start, lt: end } },
      _max: { sortOrder: true },
    });
    await prisma.scheduleManualEntry.update({
      where: { id: entry.id },
      data: { scheduledDate: start, sortOrder: (last._max.sortOrder ?? -1) + 1 },
    });
  } else if (source.kind === "program") {
    const session = await prisma.plannedSession.findFirst({
      where: { id: source.id, status: "PLANNED" },
      select: { id: true, programId: true },
    });
    if (!session) throw new Error("That session is gone. Refresh and try again.");
    await prisma.plannedSession.update({ where: { id: session.id }, data: { currentYmd: toYmd } });
    revalidatePath(`/programs/${session.programId}`);
  } else {
    throw new Error("Unknown plan source.");
  }

  revalidatePath("/plan");
  revalidatePath("/");
}

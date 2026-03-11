"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

function routeFor(routineId: string) {
  return `/routines/${routineId}/guided`;
}

export async function addGuidedStep(formData: FormData) {
  const routineId = String(formData.get("routineId") || "").trim();
  const title = String(formData.get("title") || "").trim();
  const durationSecRaw = String(formData.get("durationSec") || "").trim();
  const restSecRaw = String(formData.get("restSec") || "").trim();
  if (!routineId) throw new Error("Missing routine id.");
  if (!title) throw new Error("Title is required.");

  const existing = await prisma.guidedStep.findMany({
    where: { routineId },
    orderBy: { sortOrder: "asc" },
    select: { id: true },
  });

  await prisma.guidedStep.create({
    data: {
      routineId,
      title,
      durationSec: durationSecRaw ? Math.max(0, Math.floor(Number(durationSecRaw))) : null,
      restSec: restSecRaw ? Math.max(0, Math.floor(Number(restSecRaw))) : null,
      sortOrder: existing.length,
    },
  });

  revalidatePath(routeFor(routineId));
  revalidatePath(`/routines/${routineId}/log-guided`);
  redirect(routeFor(routineId));
}

export async function updateGuidedStep(formData: FormData) {
  const routineId = String(formData.get("routineId") || "").trim();
  const stepId = String(formData.get("stepId") || "").trim();
  const title = String(formData.get("title") || "").trim();
  const durationSecRaw = String(formData.get("durationSec") || "").trim();
  const restSecRaw = String(formData.get("restSec") || "").trim();
  if (!routineId || !stepId) throw new Error("Missing ids.");
  if (!title) throw new Error("Title is required.");

  await prisma.guidedStep.update({
    where: { id: stepId },
    data: {
      title,
      durationSec: durationSecRaw ? Math.max(0, Math.floor(Number(durationSecRaw))) : null,
      restSec: restSecRaw ? Math.max(0, Math.floor(Number(restSecRaw))) : null,
    },
  });

  revalidatePath(routeFor(routineId));
  revalidatePath(`/routines/${routineId}/log-guided`);
  redirect(routeFor(routineId));
}

export async function deleteGuidedStep(formData: FormData) {
  const routineId = String(formData.get("routineId") || "").trim();
  const stepId = String(formData.get("stepId") || "").trim();
  if (!routineId || !stepId) throw new Error("Missing ids.");

  await prisma.guidedStep.delete({ where: { id: stepId } });
  const remaining = await prisma.guidedStep.findMany({
    where: { routineId },
    orderBy: { sortOrder: "asc" },
    select: { id: true },
  });
  await prisma.$transaction(
    remaining.map((step, index) =>
      prisma.guidedStep.update({
        where: { id: step.id },
        data: { sortOrder: index },
      })
    )
  );

  revalidatePath(routeFor(routineId));
  revalidatePath(`/routines/${routineId}/log-guided`);
  redirect(routeFor(routineId));
}

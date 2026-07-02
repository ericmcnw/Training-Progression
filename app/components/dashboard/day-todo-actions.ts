"use server";

// Day-todo CRUD — keep tight & purpose-built. Each action revalidates only
// the dashboard since that's the only surface that renders todos right now.

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";

const YMD_RE = /^\d{4}-\d{2}-\d{2}$/;
const MAX_LABEL_LENGTH = 200;

function normalizeYmd(value: string): string {
  if (!YMD_RE.test(value)) throw new Error("Invalid date");
  return value;
}

function normalizeLabel(value: string): string {
  const trimmed = value.trim();
  if (trimmed.length === 0) throw new Error("Label is required");
  return trimmed.slice(0, MAX_LABEL_LENGTH);
}

export async function createDayTodo(formData: FormData) {
  const ymd = normalizeYmd(String(formData.get("ymd") ?? ""));
  const label = normalizeLabel(String(formData.get("label") ?? ""));
  await prisma.dayTodo.create({ data: { ymd, label } });
  revalidatePath("/");
  revalidatePath("/plan");
}

export async function toggleDayTodo(id: string, done: boolean) {
  if (!id) throw new Error("Missing id");
  await prisma.dayTodo.update({ where: { id }, data: { done } });
  revalidatePath("/");
  revalidatePath("/plan");
}

export async function deleteDayTodo(id: string) {
  if (!id) throw new Error("Missing id");
  await prisma.dayTodo.delete({ where: { id } });
  revalidatePath("/");
  revalidatePath("/plan");
}

// "Carry forward" suggestions — when the user adds a new todo, we look
// back at the recent past for any todos that were left undone, so they
// can resurrect one with one tap instead of retyping. Returns up to 5
// most-recent unfinished todos from the trailing 14 days, excluding any
// labels already present today.
export async function getCarryForwardSuggestions(targetYmd: string): Promise<Array<{ id: string; label: string; ymd: string }>> {
  const ymd = normalizeYmd(targetYmd);

  const cutoffDate = new Date(ymd);
  cutoffDate.setUTCDate(cutoffDate.getUTCDate() - 14);
  const cutoffYmd = cutoffDate.toISOString().slice(0, 10);

  const [unfinished, alreadyToday] = await Promise.all([
    prisma.dayTodo.findMany({
      where: { done: false, ymd: { gte: cutoffYmd, lt: ymd } },
      orderBy: [{ ymd: "desc" }, { createdAt: "desc" }],
      take: 25,
      select: { id: true, label: true, ymd: true },
    }),
    prisma.dayTodo.findMany({
      where: { ymd },
      select: { label: true },
    }),
  ]);

  const todayLabels = new Set(alreadyToday.map((t) => t.label.toLowerCase().trim()));
  const seenLabels = new Set<string>();
  const suggestions: Array<{ id: string; label: string; ymd: string }> = [];
  for (const item of unfinished) {
    const key = item.label.toLowerCase().trim();
    if (todayLabels.has(key) || seenLabels.has(key)) continue;
    seenLabels.add(key);
    suggestions.push(item);
    if (suggestions.length >= 5) break;
  }
  return suggestions;
}

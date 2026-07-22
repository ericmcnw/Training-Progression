"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getAppSession } from "@/lib/auth";

// Generic multi-day spans (vacation / travel / away) shown as a bar across the
// Week-at-a-glance. Pure annotations — they explain a dip in activity rather
// than recording any.

const YMD_RE = /^\d{4}-\d{2}-\d{2}$/;

// Keep custom emoji short — one glyph, tolerant of ZWJ/skin-tone sequences.
function normalizeIcon(icon: string | null | undefined): string | null {
  const trimmed = icon?.trim();
  if (!trimmed) return null;
  return Array.from(trimmed).slice(0, 4).join("");
}

export async function createDaySpan(input: {
  kind: string;
  label: string;
  icon?: string | null;
  startYmd: string;
  endYmd: string;
  notes?: string;
}): Promise<void> {
  const label = input.label?.trim();
  if (!label) throw new Error("A label is required.");
  if (!YMD_RE.test(input.startYmd) || !YMD_RE.test(input.endYmd)) throw new Error("Invalid dates.");
  // Tolerate reversed ranges — the user may pick the end first.
  const [startYmd, endYmd] = input.startYmd <= input.endYmd ? [input.startYmd, input.endYmd] : [input.endYmd, input.startYmd];

  const session = await getAppSession();
  await prisma.daySpan.create({
    data: {
      profileKey: session.profileKey,
      kind: input.kind?.trim() || "away",
      label,
      icon: normalizeIcon(input.icon),
      startYmd,
      endYmd,
      notes: input.notes?.trim() || null,
    },
  });
  revalidatePath("/");
  revalidatePath("/plan");
}

export async function updateDaySpan(input: {
  id: string;
  kind: string;
  label: string;
  icon?: string | null;
  startYmd: string;
  endYmd: string;
  notes?: string;
}): Promise<void> {
  const label = input.label?.trim();
  if (!input.id) throw new Error("Missing trip id.");
  if (!label) throw new Error("A label is required.");
  if (!YMD_RE.test(input.startYmd) || !YMD_RE.test(input.endYmd)) throw new Error("Invalid dates.");
  const [startYmd, endYmd] = input.startYmd <= input.endYmd ? [input.startYmd, input.endYmd] : [input.endYmd, input.startYmd];

  // Scope the update to this profile so an id from elsewhere can't be edited.
  const session = await getAppSession();
  await prisma.daySpan.updateMany({
    where: { id: input.id, profileKey: session.profileKey },
    data: {
      kind: input.kind?.trim() || "away",
      label,
      icon: normalizeIcon(input.icon),
      startYmd,
      endYmd,
      ...(input.notes !== undefined ? { notes: input.notes?.trim() || null } : {}),
    },
  });
  revalidatePath("/");
  revalidatePath("/plan");
}

export async function deleteDaySpan(id: string): Promise<void> {
  await prisma.daySpan.delete({ where: { id } }).catch(() => {});
  revalidatePath("/");
  revalidatePath("/plan");
}

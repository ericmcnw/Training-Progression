"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getAppSession } from "@/lib/auth";

function optionalNumber(value: FormDataEntryValue | null) {
  const raw = String(value || "").trim();
  if (!raw) return null;
  const number = Number(raw);
  return Number.isFinite(number) ? number : null;
}

export async function addBodyMeasurement(formData: FormData) {
  const session = await getAppSession();
  const date = String(formData.get("date") || "");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error("Choose a valid date.");
  const weightLb = optionalNumber(formData.get("weightLb"));
  const bodyFatPct = optionalNumber(formData.get("bodyFatPct"));
  const waistIn = optionalNumber(formData.get("waistIn"));
  if (weightLb == null && bodyFatPct == null && waistIn == null) throw new Error("Enter at least one measurement.");
  if (weightLb != null && (weightLb <= 0 || weightLb > 1500)) throw new Error("Weight is outside the supported range.");
  if (bodyFatPct != null && (bodyFatPct < 0 || bodyFatPct > 100)) throw new Error("Body fat must be between 0 and 100.");
  if (waistIn != null && (waistIn <= 0 || waistIn > 150)) throw new Error("Waist is outside the supported range.");
  await prisma.bodyMeasurement.create({
    data: {
      profileKey: session.profileKey,
      measuredAt: new Date(`${date}T12:00:00.000Z`),
      weightKg: weightLb == null ? null : weightLb / 2.2046226218,
      bodyFatPct,
      waistCm: waistIn == null ? null : waistIn * 2.54,
      notes: String(formData.get("notes") || "").trim() || null,
    },
  });
  revalidatePath("/profile");
  revalidatePath("/profile/measurements");
}

export async function deleteBodyMeasurement(formData: FormData) {
  const session = await getAppSession();
  const id = String(formData.get("id") || "");
  await prisma.bodyMeasurement.deleteMany({ where: { id, profileKey: session.profileKey } });
  revalidatePath("/profile");
  revalidatePath("/profile/measurements");
}

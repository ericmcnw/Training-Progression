"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getAppSession } from "@/lib/auth";
import { todayAppYmd } from "@/lib/dates";
import { MAX_DISTANCE_MI, MAX_SLEEP_MINUTES, MAX_STEPS } from "@/lib/daily-metrics";

function optionalNumber(value: FormDataEntryValue | null) {
  const raw = String(value || "").trim();
  if (!raw) return null;
  const number = Number(raw);
  return Number.isFinite(number) ? number : null;
}

function optionalInt(value: FormDataEntryValue | null) {
  const number = optionalNumber(value);
  return number == null ? null : Math.round(number);
}

export async function saveDailyMetric(formData: FormData) {
  const session = await getAppSession();
  const date = String(formData.get("date") || "");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error("Choose a valid date.");
  if (date > todayAppYmd()) throw new Error("Can't log a day in the future.");

  const sleepHours = optionalInt(formData.get("sleepHours"));
  const sleepMins = optionalInt(formData.get("sleepMins"));
  const sleepMinutes =
    sleepHours == null && sleepMins == null ? null : (sleepHours ?? 0) * 60 + (sleepMins ?? 0);
  const sleepScore = optionalInt(formData.get("sleepScore"));
  const steps = optionalInt(formData.get("steps"));
  const distanceMi = optionalNumber(formData.get("distanceMi"));

  if (sleepMinutes == null && sleepScore == null && steps == null && distanceMi == null) {
    throw new Error("Enter at least one number.");
  }
  if (sleepMinutes != null && (sleepMinutes <= 0 || sleepMinutes > MAX_SLEEP_MINUTES)) {
    throw new Error("Sleep must be between 0 and 24 hours.");
  }
  if (sleepScore != null && (sleepScore < 0 || sleepScore > 100)) {
    throw new Error("Sleep score must be between 0 and 100.");
  }
  if (steps != null && (steps < 0 || steps > MAX_STEPS)) {
    throw new Error("Steps are outside the supported range.");
  }
  if (distanceMi != null && (distanceMi < 0 || distanceMi > MAX_DISTANCE_MI)) {
    throw new Error("Distance is outside the supported range.");
  }

  const notes = String(formData.get("notes") || "").trim() || null;
  const day = new Date(`${date}T12:00:00.000Z`);
  const values = { source: "manual", sleepMinutes, sleepScore, steps, distanceMi, notes };

  // Upsert, not create: re-entering a day corrects it instead of stacking a
  // second row the summaries would then average against itself.
  await prisma.dailyMetric.upsert({
    where: { profileKey_day: { profileKey: session.profileKey, day } },
    create: { profileKey: session.profileKey, day, ...values },
    update: values,
  });

  revalidatePath("/profile");
  revalidatePath("/profile/daily");
}

export async function deleteDailyMetric(formData: FormData) {
  const session = await getAppSession();
  const id = String(formData.get("id") || "");
  await prisma.dailyMetric.deleteMany({ where: { id, profileKey: session.profileKey } });
  revalidatePath("/profile");
  revalidatePath("/profile/daily");
}

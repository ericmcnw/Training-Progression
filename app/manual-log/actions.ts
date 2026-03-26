"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { STIMULUS_EMPHASIS_PRESETS, STIMULUS_PRESET_COOKIE, ensureAppProfile } from "@/lib/stimulus-preferences";
import { prisma } from "@/lib/prisma";

const validPresetKeys = new Set(STIMULUS_EMPHASIS_PRESETS.map((preset) => preset.key));

function normalizeKeys(values: FormDataEntryValue[]) {
  return Array.from(
    new Set(
      values
        .map((value) => String(value))
        .filter((value) => validPresetKeys.has(value))
    )
  );
}

export async function saveStimulusPresetSelection(formData: FormData) {
  const profile = await ensureAppProfile();
  const selectedPresetKeys = normalizeKeys(formData.getAll("presetKey"));
  const cookieStore = await cookies();
  cookieStore.set(STIMULUS_PRESET_COOKIE, selectedPresetKeys.join(","), {
    path: "/",
    httpOnly: true,
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 365,
  });

  if (profile) {
    try {
      await prisma.appProfile.update({
        where: { id: profile.id },
        data: { selectedStimulusPresetKeys: selectedPresetKeys },
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "";
      if (!message.includes("AppProfile")) throw error;
    }
  }

  revalidatePath("/manual-log");
  revalidatePath("/progress");
}

export async function resetStimulusPresetSelection() {
  const profile = await ensureAppProfile();
  const cookieStore = await cookies();
  cookieStore.set(STIMULUS_PRESET_COOKIE, "", {
    path: "/",
    httpOnly: true,
    sameSite: "lax",
    maxAge: 0,
  });

  if (profile) {
    try {
      await prisma.appProfile.update({
        where: { id: profile.id },
        data: { selectedStimulusPresetKeys: [] },
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "";
      if (!message.includes("AppProfile")) throw error;
    }
  }

  revalidatePath("/manual-log");
  revalidatePath("/progress");
}

"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { ensureAppProfile } from "@/lib/stimulus-preferences";
import { ACTIVE_LOCATION_COOKIE } from "@/lib/active-location";
import { fetchCurrentWeather, type WeatherSnapshot } from "@/lib/weather";

// Persist the home base and hand back current conditions there as a save
// confirmation (also a live smoke-test of the weather provider). Coords are
// validated at this boundary; label is trimmed/optional.
export async function setHomeLocation(input: {
  lat: number;
  lng: number;
  label?: string | null;
}): Promise<{ ok: boolean; weather: WeatherSnapshot | null }> {
  const lat = Number(input.lat);
  const lng = Number(input.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) {
    throw new Error("Invalid coordinates.");
  }
  const profile = await ensureAppProfile();
  if (!profile) throw new Error("Profile unavailable.");

  await prisma.appProfile.update({
    where: { id: profile.id },
    data: { homeLat: lat, homeLng: lng, homeLabel: input.label?.trim() || null },
  });

  revalidatePath("/");
  revalidatePath("/profile");

  const weather = await fetchCurrentWeather({ lat, lng });
  return { ok: true, weather };
}

// Persist a device-local active-location override (the home-strip chip's "use
// my current location"). Stored in a cookie so it survives refresh without
// touching the saved home base; the home dashboard re-renders future WaG days
// + the live chip against it. Coords validated at this boundary.
export async function setActiveLocation(input: {
  lat: number;
  lng: number;
  label?: string | null;
}): Promise<void> {
  const lat = Number(input.lat);
  const lng = Number(input.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) {
    return;
  }
  (await cookies()).set(
    ACTIVE_LOCATION_COOKIE,
    JSON.stringify({ lat, lng, label: input.label?.trim() || null, capturedAt: new Date().toISOString() }),
    { maxAge: 60 * 60 * 24 * 30, sameSite: "lax", path: "/" }
  );
  revalidatePath("/");
}

export async function clearActiveLocation(): Promise<void> {
  (await cookies()).delete(ACTIVE_LOCATION_COOKIE);
  revalidatePath("/");
}

export async function clearHomeLocation(): Promise<void> {
  const profile = await ensureAppProfile();
  if (!profile) return;
  await prisma.appProfile.update({
    where: { id: profile.id },
    data: { homeLat: null, homeLng: null, homeLabel: null },
  });
  revalidatePath("/");
  revalidatePath("/profile");
}

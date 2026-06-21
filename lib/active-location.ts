import { cookies } from "next/headers";

// The "active location" is a temporary, device-local override of the home base
// — set when the user taps the home-strip weather chip to use their phone's
// current location. It persists in a cookie (per-device, survives refresh) and
// never touches the saved home base. Weather's *future* WaG days + the live
// chip follow it; past days stay anchored to home/real data.

export const ACTIVE_LOCATION_COOKIE = "active-location";

export type ActiveLocation = {
  lat: number;
  lng: number;
  label: string | null;
  capturedAt: string;
};

export async function getActiveLocation(): Promise<ActiveLocation | null> {
  const raw = (await cookies()).get(ACTIVE_LOCATION_COOKIE)?.value;
  if (!raw) return null;
  try {
    const v = JSON.parse(raw) as Record<string, unknown>;
    if (typeof v.lat !== "number" || typeof v.lng !== "number") return null;
    if (Math.abs(v.lat) > 90 || Math.abs(v.lng) > 180) return null;
    return {
      lat: v.lat,
      lng: v.lng,
      label: typeof v.label === "string" ? v.label : null,
      capturedAt: typeof v.capturedAt === "string" ? v.capturedAt : "",
    };
  } catch {
    return null;
  }
}

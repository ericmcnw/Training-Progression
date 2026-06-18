import { prisma } from "@/lib/prisma";
import { effectiveRoutineDomain } from "@/lib/routines";
import { getHomeLocation } from "@/lib/home-location";
import { fetchWeatherSnapshot } from "@/lib/weather";

// Only sport + endurance logs get weather. Strength, mobility, and lifestyle
// are skipped (climbing's synthetic routine is domain "sport", so it's in).
const WEATHER_DOMAINS = new Set(["sport", "cardio"]);

// Stamp an ambient weather snapshot onto a just-created sport/endurance log.
// Coords resolve picked-location-first (climb location → activity spot) then
// fall back to the home base. Self-gating + fully best-effort: it no-ops for
// ineligible domains, logs with no resolvable coords, already-stamped logs, or
// any provider/DB hiccup. Never throws — weather must not disturb a save.
export async function stampLogWeather(logId: string): Promise<void> {
  try {
    const log = await prisma.routineLog.findUnique({
      where: { id: logId },
      select: {
        performedAt: true,
        weather: true,
        routine: { select: { domain: true, kind: true, subtype: true } },
        climbLocation: { select: { latitude: true, longitude: true } },
        activitySpot: { select: { latitude: true, longitude: true } },
      },
    });
    if (!log || log.weather != null) return;

    const domain = effectiveRoutineDomain(log.routine.domain, log.routine.kind, log.routine.subtype);
    if (!WEATHER_DOMAINS.has(domain)) return;

    let lat: number | null = null;
    let lng: number | null = null;
    if (log.climbLocation?.latitude != null && log.climbLocation.longitude != null) {
      lat = log.climbLocation.latitude;
      lng = log.climbLocation.longitude;
    } else if (log.activitySpot?.latitude != null && log.activitySpot.longitude != null) {
      lat = log.activitySpot.latitude;
      lng = log.activitySpot.longitude;
    } else {
      const home = await getHomeLocation();
      if (home) {
        lat = home.lat;
        lng = home.lng;
      }
    }
    if (lat == null || lng == null) return;

    const snapshot = await fetchWeatherSnapshot({ lat, lng, atIso: log.performedAt.toISOString() });
    if (!snapshot) return;

    await prisma.routineLog.update({ where: { id: logId }, data: { weather: snapshot } });
  } catch {
    // Best-effort — a weather failure must never break logging.
  }
}

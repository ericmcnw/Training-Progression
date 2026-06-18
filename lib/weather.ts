// Weather provider seam. Everything that talks to an external weather API
// lives here so swapping providers at commercial launch (Open-Meteo's free
// tier is non-commercial) is a one-file change. Callers only ever see
// WeatherSnapshot + the WMO code helpers.
//
// Provider: Open-Meteo (no API key). Recent/near-future instants come from
// the forecast endpoint with past_days (covers ~92 days back + 16 forward in
// one call, and dodges the historical archive's ~5-day lag). Older instants
// fall to the ERA5 archive endpoint. All requests ask for imperial units and
// UTC times so the nearest-hour match is a plain absolute-time comparison.

export type WeatherSnapshot = {
  tempF: number;
  feelsLikeF: number;
  /** WMO weather code — see describeWeatherCode for label + emoji. */
  code: number;
  windMph: number;
  precipIn: number;
  /** Relative humidity %. */
  humidity: number;
  lat: number;
  lng: number;
  source: "open-meteo";
  /** ISO timestamp of when this snapshot was fetched (provenance). */
  fetchedAt: string;
};

const FORECAST_URL = "https://api.open-meteo.com/v1/forecast";
const ARCHIVE_URL = "https://archive-api.open-meteo.com/v1/archive";
const HOURLY_FIELDS =
  "temperature_2m,apparent_temperature,relative_humidity_2m,precipitation,weather_code,wind_speed_10m";
const IMPERIAL = "temperature_unit=fahrenheit&wind_speed_unit=mph&precipitation_unit=inch";
const DAY_MS = 24 * 60 * 60 * 1000;
const ARCHIVE_AGE_DAYS = 90; // forecast past_days tops out at 92; stay clear

function round(n: number, digits = 0): number {
  const f = 10 ** digits;
  return Math.round(n * f) / f;
}

function ymd(d: Date): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(
    d.getUTCDate()
  ).padStart(2, "0")}`;
}

type HourlyBlock = {
  time: string[];
  temperature_2m: number[];
  apparent_temperature: number[];
  relative_humidity_2m: number[];
  precipitation: number[];
  weather_code: number[];
  wind_speed_10m: number[];
};

// Open-Meteo hourly times come back as bare local-to-tz strings ("2026-06-18T06:00").
// We request timezone=GMT, so appending ":00Z" pins them to UTC for comparison.
function parseUtc(t: string): number {
  return Date.parse(`${t}:00Z`);
}

function snapshotFromHourly(
  hourly: HourlyBlock,
  targetMs: number,
  lat: number,
  lng: number
): WeatherSnapshot | null {
  if (!hourly?.time?.length) return null;
  let best = -1;
  let bestDiff = Infinity;
  for (let i = 0; i < hourly.time.length; i++) {
    const diff = Math.abs(parseUtc(hourly.time[i]) - targetMs);
    if (diff < bestDiff) {
      bestDiff = diff;
      best = i;
    }
  }
  if (best < 0 || hourly.temperature_2m[best] == null) return null;
  return {
    tempF: round(hourly.temperature_2m[best]),
    feelsLikeF: round(hourly.apparent_temperature[best] ?? hourly.temperature_2m[best]),
    code: hourly.weather_code[best] ?? 0,
    windMph: round(hourly.wind_speed_10m[best] ?? 0),
    precipIn: round(hourly.precipitation[best] ?? 0, 2),
    humidity: round(hourly.relative_humidity_2m[best] ?? 0),
    lat,
    lng,
    source: "open-meteo",
    fetchedAt: new Date().toISOString(),
  };
}

// Weather at a specific instant + place. Used to stamp a log on save. Returns
// null on any failure — weather is never allowed to block a save.
export async function fetchWeatherSnapshot({
  lat,
  lng,
  atIso,
}: {
  lat: number;
  lng: number;
  atIso: string;
}): Promise<WeatherSnapshot | null> {
  const targetMs = Date.parse(atIso);
  if (Number.isNaN(targetMs) || !Number.isFinite(lat) || !Number.isFinite(lng)) return null;

  const ageDays = (Date.now() - targetMs) / DAY_MS;
  const coords = `latitude=${lat}&longitude=${lng}`;

  let url: string;
  if (ageDays > ARCHIVE_AGE_DAYS) {
    const date = ymd(new Date(targetMs));
    url = `${ARCHIVE_URL}?${coords}&start_date=${date}&end_date=${date}&hourly=${HOURLY_FIELDS}&timezone=GMT&${IMPERIAL}`;
  } else {
    // Pull just enough history to cover the instant; cap at the 92-day max.
    const pastDays = Math.min(92, Math.max(1, Math.ceil(ageDays) + 1));
    url = `${FORECAST_URL}?${coords}&hourly=${HOURLY_FIELDS}&past_days=${pastDays}&forecast_days=2&timezone=GMT&${IMPERIAL}`;
  }

  try {
    const res = await fetch(url, { headers: { Accept: "application/json" } });
    if (!res.ok) return null;
    const data = (await res.json()) as { hourly?: HourlyBlock };
    if (!data.hourly) return null;
    return snapshotFromHourly(data.hourly, targetMs, lat, lng);
  } catch {
    return null;
  }
}

// Current conditions at a place. Used by the home-page live widget and the
// home-base setter's "currently N°" confirmation.
export async function fetchCurrentWeather({
  lat,
  lng,
}: {
  lat: number;
  lng: number;
}): Promise<WeatherSnapshot | null> {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  const url =
    `${FORECAST_URL}?latitude=${lat}&longitude=${lng}` +
    `&current=temperature_2m,apparent_temperature,relative_humidity_2m,precipitation,weather_code,wind_speed_10m` +
    `&timezone=GMT&${IMPERIAL}`;
  try {
    const res = await fetch(url, { headers: { Accept: "application/json" } });
    if (!res.ok) return null;
    const data = (await res.json()) as {
      current?: {
        temperature_2m: number;
        apparent_temperature: number;
        relative_humidity_2m: number;
        precipitation: number;
        weather_code: number;
        wind_speed_10m: number;
      };
    };
    const c = data.current;
    if (!c || c.temperature_2m == null) return null;
    return {
      tempF: round(c.temperature_2m),
      feelsLikeF: round(c.apparent_temperature ?? c.temperature_2m),
      code: c.weather_code ?? 0,
      windMph: round(c.wind_speed_10m ?? 0),
      precipIn: round(c.precipitation ?? 0, 2),
      humidity: round(c.relative_humidity_2m ?? 0),
      lat,
      lng,
      source: "open-meteo",
      fetchedAt: new Date().toISOString(),
    };
  } catch {
    return null;
  }
}

export type DailyWeather = { code: number; highF: number; lowF: number };

// Daily high/low + code for a date range at one place. Powers the per-day
// chips on the home Week-at-a-glance rail. The range stays within Open-Meteo's
// forecast window (today-92 … today+16), so one call covers the whole rail —
// no archive needed. Cached ~30 min; returns {} on any failure (home renders
// weather-less). Keyed by YYYY-MM-DD in the location's local timezone.
export async function fetchDailyWeather({
  lat,
  lng,
  startYmd,
  endYmd,
}: {
  lat: number;
  lng: number;
  startYmd: string;
  endYmd: string;
}): Promise<Record<string, DailyWeather>> {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return {};
  const url =
    `${FORECAST_URL}?latitude=${lat}&longitude=${lng}` +
    `&daily=weather_code,temperature_2m_max,temperature_2m_min` +
    `&start_date=${startYmd}&end_date=${endYmd}&timezone=auto&${IMPERIAL}`;
  try {
    const res = await fetch(url, {
      headers: { Accept: "application/json" },
      next: { revalidate: 1800 },
    });
    if (!res.ok) return {};
    const data = (await res.json()) as {
      daily?: {
        time: string[];
        weather_code: number[];
        temperature_2m_max: number[];
        temperature_2m_min: number[];
      };
    };
    const d = data.daily;
    if (!d?.time?.length) return {};
    const out: Record<string, DailyWeather> = {};
    for (let i = 0; i < d.time.length; i++) {
      if (d.temperature_2m_max[i] == null) continue;
      out[d.time[i]] = {
        code: d.weather_code[i] ?? 0,
        highF: round(d.temperature_2m_max[i]),
        lowF: round(d.temperature_2m_min[i] ?? d.temperature_2m_max[i]),
      };
    }
    return out;
  } catch {
    return {};
  }
}

// Coerce a stored RoutineLog.weather JSON blob back into a WeatherSnapshot.
// Validates at the boundary (it's deserialized storage) — returns null for
// anything that isn't a recognizable snapshot.
export function coerceWeatherSnapshot(value: unknown): WeatherSnapshot | null {
  if (!value || typeof value !== "object") return null;
  const w = value as Record<string, unknown>;
  if (typeof w.tempF !== "number" || typeof w.code !== "number") return null;
  return {
    tempF: w.tempF,
    feelsLikeF: typeof w.feelsLikeF === "number" ? w.feelsLikeF : w.tempF,
    code: w.code,
    windMph: typeof w.windMph === "number" ? w.windMph : 0,
    precipIn: typeof w.precipIn === "number" ? w.precipIn : 0,
    humidity: typeof w.humidity === "number" ? w.humidity : 0,
    lat: typeof w.lat === "number" ? w.lat : 0,
    lng: typeof w.lng === "number" ? w.lng : 0,
    source: "open-meteo",
    fetchedAt: typeof w.fetchedAt === "string" ? w.fetchedAt : "",
  };
}

// WMO weather code → short label + emoji. Reference:
// https://open-meteo.com/en/docs (WMO Weather interpretation codes).
export function describeWeatherCode(code: number): { label: string; emoji: string } {
  if (code === 0) return { label: "Clear", emoji: "☀️" };
  if (code === 1) return { label: "Mostly clear", emoji: "🌤️" };
  if (code === 2) return { label: "Partly cloudy", emoji: "⛅" };
  if (code === 3) return { label: "Overcast", emoji: "☁️" };
  if (code === 45 || code === 48) return { label: "Fog", emoji: "🌫️" };
  if (code >= 51 && code <= 57) return { label: "Drizzle", emoji: "🌦️" };
  if (code >= 61 && code <= 67) return { label: "Rain", emoji: "🌧️" };
  if (code >= 71 && code <= 77) return { label: "Snow", emoji: "🌨️" };
  if (code >= 80 && code <= 82) return { label: "Rain showers", emoji: "🌦️" };
  if (code === 85 || code === 86) return { label: "Snow showers", emoji: "🌨️" };
  if (code >= 95) return { label: "Thunderstorm", emoji: "⛈️" };
  return { label: "—", emoji: "🌡️" };
}

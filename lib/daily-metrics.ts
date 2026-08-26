// Daily wearable context — sleep, steps, distance — reported per calendar day
// rather than per session. Sleep is stored as total minutes so "7h 32m" and
// "7.53 h" are the same row; the form takes hours + minutes because that is
// how the band reports it.

export type DailyMetricInput = {
  sleepMinutes: number | null;
  sleepScore: number | null;
  steps: number | null;
  distanceMi: number | null;
};

export const MAX_SLEEP_MINUTES = 24 * 60;
export const MAX_STEPS = 200_000;
export const MAX_DISTANCE_MI = 500;

export function formatSleepDuration(minutes: number | null | undefined) {
  if (minutes == null || !Number.isFinite(minutes) || minutes <= 0) return null;
  const whole = Math.round(minutes);
  return `${Math.floor(whole / 60)}h ${String(whole % 60).padStart(2, "0")}m`;
}

export function sleepHoursDecimal(minutes: number | null | undefined) {
  if (minutes == null || !Number.isFinite(minutes) || minutes <= 0) return null;
  return minutes / 60;
}

/** Fitbit's own published bands. Encoding them is the point of storing the
 *  score at all — "82" means nothing until it reads as "good". */
export type SleepScoreBand = "excellent" | "good" | "fair" | "poor";

export function sleepScoreBand(score: number): SleepScoreBand {
  if (score >= 90) return "excellent";
  if (score >= 80) return "good";
  if (score >= 60) return "fair";
  return "poor";
}

export const SLEEP_BAND_LABELS: Record<SleepScoreBand, string> = {
  excellent: "Excellent",
  good: "Good",
  fair: "Fair",
  poor: "Poor",
};

export const SLEEP_BAND_COLORS: Record<SleepScoreBand, string> = {
  excellent: "#7ce8aa",
  good: "#bfdbfe",
  fair: "#fcd34d",
  poor: "#fca5a5",
};

export function sleepScoreColor(score: number | null | undefined) {
  if (score == null || !Number.isFinite(score)) return "rgba(255,255,255,0.55)";
  return SLEEP_BAND_COLORS[sleepScoreBand(score)];
}

export function formatSteps(steps: number | null | undefined) {
  if (steps == null || !Number.isFinite(steps)) return null;
  return Math.round(steps).toLocaleString();
}

export function formatMiles(distanceMi: number | null | undefined) {
  if (distanceMi == null || !Number.isFinite(distanceMi)) return null;
  return `${distanceMi.toFixed(2)} mi`;
}

export function averageOf(values: Array<number | null | undefined>) {
  const present = values.filter((v): v is number => v != null && Number.isFinite(v));
  if (present.length === 0) return null;
  return present.reduce((sum, v) => sum + v, 0) / present.length;
}

export function sumOf(values: Array<number | null | undefined>) {
  const present = values.filter((v): v is number => v != null && Number.isFinite(v));
  if (present.length === 0) return null;
  return present.reduce((sum, v) => sum + v, 0);
}

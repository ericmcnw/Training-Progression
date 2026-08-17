import type { LoadUnit } from "@/generated/prisma";

export type PrescriptionShape = {
  sets: number | null;
  repsMin: number | null;
  repsMax: number | null;
  seconds: number | null;
  load: number | null;
  loadUnit: LoadUnit;
  tempo: string | null;
  restSec: number | null;
  cue: string | null;
};

export type ExerciseMetricUnit = "REPS" | "TIME";

export const LOAD_UNIT_OPTIONS: { value: LoadUnit; label: string }[] = [
  { value: "LB", label: "lb" },
  { value: "KG", label: "kg" },
  { value: "PCT_1RM", label: "% 1RM" },
  { value: "RPE", label: "RPE" },
  { value: "STACK", label: "stack" },
  { value: "BODYWEIGHT", label: "bodyweight" },
];

export function emptyPrescription(): PrescriptionShape {
  return {
    sets: null,
    repsMin: null,
    repsMax: null,
    seconds: null,
    load: null,
    loadUnit: "LB",
    tempo: null,
    restSec: null,
    cue: null,
  };
}

export function hasPrescription(p: PrescriptionShape | null | undefined): p is PrescriptionShape {
  if (!p) return false;
  return (
    p.sets != null ||
    p.repsMin != null ||
    p.repsMax != null ||
    p.seconds != null ||
    p.load != null ||
    (p.tempo?.trim().length ?? 0) > 0 ||
    p.restSec != null ||
    (p.cue?.trim().length ?? 0) > 0
  );
}

function formatNumber(value: number) {
  return Number.isInteger(value) ? String(value) : String(Number(value.toFixed(2)));
}

function formatLoad(p: PrescriptionShape): string | null {
  if (p.loadUnit === "BODYWEIGHT") return "BW";
  if (p.load == null) return null;
  const value = formatNumber(p.load);
  if (p.loadUnit === "LB") return `${value} lb`;
  if (p.loadUnit === "KG") return `${value} kg`;
  if (p.loadUnit === "PCT_1RM") return `${value}% 1RM`;
  if (p.loadUnit === "RPE") return `RPE ${value}`;
  return `stack ${value}`;
}

function formatMetric(p: PrescriptionShape, unit: ExerciseMetricUnit): string | null {
  if (unit === "TIME") return p.seconds != null ? `${formatNumber(p.seconds)}s` : null;
  if (p.repsMin != null && p.repsMax != null && p.repsMax !== p.repsMin) {
    return `${p.repsMin}–${p.repsMax}`;
  }
  const single = p.repsMin ?? p.repsMax;
  return single != null ? String(single) : null;
}

/** The one-line target shown under an exercise name, e.g. `3×8–10 @ 135 lb · 3s ecc`. */
export function formatPrescription(
  p: PrescriptionShape | null | undefined,
  unit: ExerciseMetricUnit
): string | null {
  if (!hasPrescription(p)) return null;

  const metric = formatMetric(p, unit);
  const volume =
    p.sets != null && metric ? `${p.sets}×${metric}` : p.sets != null ? `${p.sets} sets` : metric;

  const parts: string[] = [];
  if (volume) parts.push(volume);

  const load = formatLoad(p);
  if (load) parts.push(parts.length > 0 ? `@ ${load}` : load);

  const head = parts.join(" ");
  const tail: string[] = [];
  if (p.tempo?.trim()) tail.push(p.tempo.trim());

  if (!head) return tail.length > 0 ? tail.join(" · ") : null;
  return [head, ...tail].join(" · ");
}

/**
 * Placeholder hints for the log form. Weight is only offered when the target is
 * in pounds — the input is literally labelled "Weight lb", so a kg/%1RM/RPE
 * target would be a wrong number in a right-looking box.
 */
export function prescriptionHints(p: PrescriptionShape | null | undefined) {
  if (!hasPrescription(p)) return null;
  const reps = p.repsMin ?? p.repsMax;
  return {
    reps: reps != null ? String(reps) : undefined,
    seconds: p.seconds != null ? String(p.seconds) : undefined,
    weightLb: p.loadUnit === "LB" && p.load != null ? formatNumber(p.load) : undefined,
  };
}

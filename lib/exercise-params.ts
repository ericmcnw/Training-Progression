// Setup parameters: values that change how hard the *same* movement is,
// without making it a different exercise. Edge size on a hangboard or edge
// lift, slant-board angle, step-down box height.
//
// They live here rather than in the exercise name so that dropping 20mm ->
// 15mm reads as progression on one continuous series instead of a brand-new
// exercise with no history.

export const EXERCISE_PARAM_KEYS = ["edgeMm", "angleDeg", "boxHeightIn", "pinchWidthMm"] as const;

export type ExerciseParamKey = (typeof EXERCISE_PARAM_KEYS)[number];

export type ExerciseParamValues = Partial<Record<ExerciseParamKey, number>>;

export type ExerciseParamDef = {
  key: ExerciseParamKey;
  label: string;
  unit: string;
  /** Which direction is harder. Left undefined where it depends on the
   *  movement — a steeper board deepens a calf raise but eases an ATG squat. */
  harder?: "lower" | "higher";
  min: number;
  max: number;
  step: number;
  /** One-tap values, so a normal session costs no typing. */
  presets: number[];
};

const DEFS: Record<ExerciseParamKey, ExerciseParamDef> = {
  edgeMm: {
    key: "edgeMm",
    label: "Edge",
    unit: "mm",
    harder: "lower",
    min: 4,
    max: 60,
    step: 1,
    presets: [8, 10, 12, 15, 20, 25, 30],
  },
  angleDeg: {
    key: "angleDeg",
    label: "Angle",
    unit: "\u00b0",
    min: 0,
    max: 45,
    step: 1,
    presets: [10, 15, 20, 25, 30, 35],
  },
  boxHeightIn: {
    key: "boxHeightIn",
    label: "Box",
    unit: "in",
    harder: "higher",
    min: 2,
    max: 36,
    step: 1,
    presets: [6, 8, 12, 16, 18, 20, 24],
  },
  pinchWidthMm: {
    key: "pinchWidthMm",
    label: "Pinch",
    unit: "mm",
    harder: "lower",
    min: 10,
    max: 90,
    step: 1,
    presets: [20, 25, 30, 40, 50, 60],
  },
};

export function exerciseParamDef(key: string): ExerciseParamDef | null {
  return DEFS[key as ExerciseParamKey] ?? null;
}

/** Exercise.paramKeys is an untyped String[] out of the database. */
export function exerciseParamKeys(raw: readonly string[] | null | undefined): ExerciseParamKey[] {
  if (!raw) return [];
  return raw.filter((k): k is ExerciseParamKey => k in DEFS);
}

/** SessionExercise.params is an untyped Json blob out of the database. */
export function readExerciseParams(raw: unknown): ExerciseParamValues {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const out: ExerciseParamValues = {};
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    const def = exerciseParamDef(key);
    if (!def) continue;
    const num = typeof value === "number" ? value : Number(value);
    if (Number.isFinite(num)) out[def.key] = num;
  }
  return out;
}

function trimNumber(value: number): string {
  return Number.isInteger(value) ? String(value) : String(Math.round(value * 10) / 10);
}

export function formatExerciseParam(key: string, value: number): string {
  const def = exerciseParamDef(key);
  return def ? `${trimNumber(value)}${def.unit}` : trimNumber(value);
}

/** "20mm" / "25\u00b0 \u00b7 18in". Empty string when nothing was recorded. */
export function formatExerciseParams(params: ExerciseParamValues): string {
  return EXERCISE_PARAM_KEYS.filter((k) => params[k] !== undefined)
    .map((k) => formatExerciseParam(k, params[k] as number))
    .join(" \u00b7 ");
}

/** Numbers -> the string map the log form edits. */
export function exerciseParamsToInput(
  params: ExerciseParamValues,
): Partial<Record<ExerciseParamKey, string>> {
  const out: Partial<Record<ExerciseParamKey, string>> = {};
  for (const key of EXERCISE_PARAM_KEYS) {
    const value = params[key];
    if (value !== undefined) out[key] = trimNumber(value);
  }
  return out;
}

/** Clamp + round form input into the shape stored on SessionExercise.params. */
export function normalizeExerciseParamInput(
  keys: readonly ExerciseParamKey[],
  input: Partial<Record<ExerciseParamKey, string | number | null | undefined>>,
): ExerciseParamValues | null {
  const out: ExerciseParamValues = {};
  for (const key of keys) {
    const def = DEFS[key];
    const raw = input[key];
    if (raw === null || raw === undefined || raw === "") continue;
    const num = typeof raw === "number" ? raw : Number(String(raw).trim());
    if (!Number.isFinite(num)) continue;
    out[key] = Math.min(def.max, Math.max(def.min, Math.round(num * 10) / 10));
  }
  return Object.keys(out).length > 0 ? out : null;
}

export type ParamShift = "harder" | "easier" | "same" | "changed";

/** How this session's setup compares to a previous one. "changed" means the
 *  value moved but the axis has no fixed direction, so the caller should
 *  report the change without calling it progress. */
export function compareExerciseParam(key: string, previous: number, current: number): ParamShift | null {
  const def = exerciseParamDef(key);
  if (!def) return null;
  if (previous === current) return "same";
  if (!def.harder) return "changed";
  const harder = def.harder === "lower" ? current < previous : current > previous;
  return harder ? "harder" : "easier";
}

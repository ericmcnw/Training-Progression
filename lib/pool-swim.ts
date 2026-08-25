// Pool swimming structured payload. Lives on RoutineLog.sportData under the
// `sport: "pool-swim"` discriminator (see CLAUDE.md rule 2) rather than in
// intervalsConfig: that column holds a single reps/work/rest block, and a
// swim workout is an ordered list of differently-shaped sets.
//
// Distances are stored in the log's own pool unit (yd or m), never miles.
// RoutineLog.distanceMi is still written on save — converted here — so the
// existing endurance charts, goals, and rollups keep working unchanged.

export type PoolUnit = "yd" | "m";

export type PoolSwimStroke =
  | "free"
  | "back"
  | "breast"
  | "fly"
  | "im"
  | "kick"
  | "pull"
  | "drill"
  | "choice";

export type PoolSwimEquipment = "fins" | "paddles" | "pull-buoy" | "kickboard" | "snorkel";

export type PoolSwimSet = {
  reps: number;
  /** Distance per rep, in the log's pool unit. */
  distance: number | null;
  stroke: PoolSwimStroke;
  equipment: PoolSwimEquipment[];
  /** Send-off — "on the 2:00" — as total seconds per rep. */
  sendOffSec: number | null;
  /** Fixed rest between reps, as seconds. Swimmers use one or the other. */
  restSec: number | null;
  note: string | null;
};

export type PoolSwimData = {
  sport: "pool-swim";
  poolLength: number;
  poolUnit: PoolUnit;
  sets: PoolSwimSet[];
};

export const POOL_UNIT_LABELS: Record<PoolUnit, string> = {
  yd: "yd",
  m: "m",
};

export const POOL_PRESETS: Array<{ length: number; unit: PoolUnit; label: string }> = [
  { length: 25, unit: "yd", label: "25 yd" },
  { length: 25, unit: "m", label: "25 m" },
  { length: 50, unit: "m", label: "50 m" },
];

export const DEFAULT_POOL_LENGTH = 25;
export const DEFAULT_POOL_UNIT: PoolUnit = "yd";

export const STROKE_LABELS: Record<PoolSwimStroke, string> = {
  free: "Freestyle",
  back: "Backstroke",
  breast: "Breaststroke",
  fly: "Butterfly",
  im: "IM",
  kick: "Kick",
  pull: "Pull",
  drill: "Drill",
  choice: "Choice",
};

export const STROKE_SHORT: Record<PoolSwimStroke, string> = {
  free: "free",
  back: "back",
  breast: "breast",
  fly: "fly",
  im: "IM",
  kick: "kick",
  pull: "pull",
  drill: "drill",
  choice: "choice",
};

export const STROKE_ORDER: PoolSwimStroke[] = [
  "free",
  "back",
  "breast",
  "fly",
  "im",
  "kick",
  "pull",
  "drill",
  "choice",
];

export const EQUIPMENT_LABELS: Record<PoolSwimEquipment, string> = {
  fins: "Fins",
  paddles: "Paddles",
  "pull-buoy": "Pull buoy",
  kickboard: "Kickboard",
  snorkel: "Snorkel",
};

export const EQUIPMENT_ORDER: PoolSwimEquipment[] = [
  "fins",
  "paddles",
  "pull-buoy",
  "kickboard",
  "snorkel",
];

const YARDS_PER_MILE = 1760;
const METERS_PER_MILE = 1609.344;

export function poolDistanceToMiles(distance: number, unit: PoolUnit) {
  return unit === "yd" ? distance / YARDS_PER_MILE : distance / METERS_PER_MILE;
}

export function milesToPoolDistance(miles: number, unit: PoolUnit) {
  return unit === "yd" ? miles * YARDS_PER_MILE : miles * METERS_PER_MILE;
}

export function emptyPoolSwimSet(): PoolSwimSet {
  return {
    reps: 1,
    distance: null,
    stroke: "free",
    equipment: [],
    sendOffSec: null,
    restSec: null,
    note: null,
  };
}

export function emptyPoolSwimData(
  poolLength = DEFAULT_POOL_LENGTH,
  poolUnit: PoolUnit = DEFAULT_POOL_UNIT,
): PoolSwimData {
  return { sport: "pool-swim", poolLength, poolUnit, sets: [emptyPoolSwimSet()] };
}

export type PoolSwimTotals = {
  distance: number;
  lengths: number | null;
  distanceMi: number;
  /** Seconds per 100 pool units. Null without a duration or distance. */
  paceSecPer100: number | null;
  setCount: number;
  repCount: number;
};

export function poolSwimTotals(data: PoolSwimData, durationSec?: number | null): PoolSwimTotals {
  let distance = 0;
  let repCount = 0;
  let setCount = 0;
  for (const set of data.sets) {
    const reps = Number.isFinite(set.reps) && set.reps > 0 ? Math.floor(set.reps) : 0;
    const per = set.distance != null && Number.isFinite(set.distance) && set.distance > 0 ? set.distance : 0;
    if (reps > 0 && per > 0) {
      distance += reps * per;
      repCount += reps;
      setCount += 1;
    }
  }
  const lengths = data.poolLength > 0 ? distance / data.poolLength : null;
  const paceSecPer100 =
    durationSec != null && durationSec > 0 && distance > 0 ? durationSec / (distance / 100) : null;
  return {
    distance,
    lengths,
    distanceMi: poolDistanceToMiles(distance, data.poolUnit),
    paceSecPer100,
    setCount,
    repCount,
  };
}

export function formatClock(totalSec: number) {
  const safe = Math.max(0, Math.round(totalSec));
  const mins = Math.floor(safe / 60);
  const secs = safe % 60;
  return `${mins}:${String(secs).padStart(2, "0")}`;
}

export function formatSwimPace(paceSecPer100: number | null, unit: PoolUnit) {
  if (paceSecPer100 == null || !Number.isFinite(paceSecPer100) || paceSecPer100 <= 0) return null;
  return `${formatClock(paceSecPer100)} /100${POOL_UNIT_LABELS[unit]}`;
}

export function formatPoolDistance(distance: number, unit: PoolUnit) {
  return `${Math.round(distance).toLocaleString()} ${POOL_UNIT_LABELS[unit]}`;
}

/** "4 × 100 free @ 2:00 (fins)" — the way a swimmer writes a set down. */
export function describePoolSwimSet(set: PoolSwimSet, unit: PoolUnit) {
  const reps = Number.isFinite(set.reps) && set.reps > 0 ? Math.floor(set.reps) : 0;
  const parts: string[] = [];
  if (set.distance != null && set.distance > 0) {
    const distance = `${set.distance} ${POOL_UNIT_LABELS[unit]}`;
    parts.push(reps > 1 ? `${reps} × ${distance}` : distance);
  } else if (reps > 0) {
    parts.push(`${reps} ×`);
  }
  parts.push(STROKE_SHORT[set.stroke]);
  if (set.sendOffSec != null && set.sendOffSec > 0) {
    parts.push(`@ ${formatClock(set.sendOffSec)}`);
  } else if (set.restSec != null && set.restSec > 0) {
    parts.push(`:${String(Math.round(set.restSec)).padStart(2, "0")} rest`);
  }
  if (set.equipment.length > 0) {
    parts.push(`(${set.equipment.map((e) => EQUIPMENT_LABELS[e].toLowerCase()).join(", ")})`);
  }
  return parts.join(" ");
}

function coerceStroke(raw: unknown): PoolSwimStroke {
  return typeof raw === "string" && (STROKE_ORDER as string[]).includes(raw)
    ? (raw as PoolSwimStroke)
    : "free";
}

function coerceEquipment(raw: unknown): PoolSwimEquipment[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter(
    (v): v is PoolSwimEquipment => typeof v === "string" && (EQUIPMENT_ORDER as string[]).includes(v),
  );
}

function coerceNumber(raw: unknown): number | null {
  return typeof raw === "number" && Number.isFinite(raw) && raw > 0 ? raw : null;
}

/** Boundary parser — sportData is a deserialized JSON blob, so every field
 *  is validated here even though the writer is our own form. */
export function parsePoolSwimData(raw: unknown): PoolSwimData | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const obj = raw as Record<string, unknown>;
  if (obj.sport !== "pool-swim") return null;

  const poolUnit: PoolUnit = obj.poolUnit === "m" ? "m" : "yd";
  const poolLength = coerceNumber(obj.poolLength) ?? DEFAULT_POOL_LENGTH;
  const rawSets = Array.isArray(obj.sets) ? obj.sets : [];
  const sets: PoolSwimSet[] = rawSets
    .filter((s): s is Record<string, unknown> => Boolean(s) && typeof s === "object" && !Array.isArray(s))
    .map((s) => ({
      reps: coerceNumber(s.reps) ?? 1,
      distance: coerceNumber(s.distance),
      stroke: coerceStroke(s.stroke),
      equipment: coerceEquipment(s.equipment),
      sendOffSec: coerceNumber(s.sendOffSec),
      restSec: coerceNumber(s.restSec),
      note: typeof s.note === "string" && s.note.trim() ? s.note.trim() : null,
    }));

  return { sport: "pool-swim", poolLength, poolUnit, sets };
}

/** Strips empty rows so a half-filled set builder doesn't persist noise.
 *  Returns null when nothing meaningful was entered. */
export function normalizePoolSwimData(data: PoolSwimData): PoolSwimData | null {
  const sets = data.sets.filter(
    (set) => set.reps > 0 && set.distance != null && set.distance > 0,
  );
  if (sets.length === 0) return null;
  return { sport: "pool-swim", poolLength: data.poolLength, poolUnit: data.poolUnit, sets };
}

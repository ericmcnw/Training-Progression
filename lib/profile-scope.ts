// Models that carry their own profileKey column.
const OWNED_MODELS = new Set([
  "ActiveInjury", "ActivitySpot", "BackpackingTrip", "BodyMeasurement", "ClimbLocation",
  "ClimbMedia", "ClimbProblem", "CoachThread", "DailyMetric", "DaySpan", "DayTodo",
  "Focus", "FrequencyGoal", "Gear", "GearList", "Goal", "GoalMilestone", "LocationPing",
  "PainLog", "Progression", "ProgressionMilestone", "Rotation", "Routine", "RoutineLog",
  "RoutineTag", "ScheduleManualEntry", "SchedulePlan", "UserActivityTypePreference", "ZoneActivity",
]);

// Child models have no column of their own; they're scoped through the
// required relation path to an owned parent. Every child must be listed here,
// or direct queries on it (e.g. "all sets for this exercise") leak across profiles.
const CHILD_PATHS: Record<string, string[]> = {
  CardioRoutineDetails: ["routine"],
  ClimbArea: ["location"],
  ClimbAttempt: ["sessionLog"],
  CoachMessage: ["thread"],
  FocusContributor: ["focus"],
  FrequencyGoalRoutine: ["goal"],
  FrequencyGoalTriggerExercise: ["goal"],
  GearListItem: ["list"],
  GoalCheckpoint: ["goal"],
  GuidedStep: ["routine"],
  GuidedStepLog: ["routineLog"],
  GuidedStepMetadataGroup: ["guidedStep", "routine"],
  InjuryZone: ["injury"],
  PlannedSession: ["program"],
  Prescription: ["routineExercise", "routine"],
  ProgramBlock: ["program"],
  ProgramBlockItem: ["block", "program"],
  ProgramBlockPrescription: ["blockItem", "block", "program"],
  ProgramFrequencyGoal: ["program"],
  ProgramGoal: ["program"],
  ProgramLogContext: ["routineLog"],
  ProgramRoutine: ["program"],
  ProgramStage: ["program"],
  ProgramStageGate: ["stage", "program"],
  ProgramTargetList: ["program"],
  ProgramTargetListItem: ["list", "program"],
  RotationSlot: ["rotation"],
  RotationSlotCoverage: ["slot", "rotation"],
  RoutineExercise: ["routine"],
  RoutineLogGear: ["routineLog"],
  RoutineLogMetric: ["routineLog"],
  RoutineLogStimulus: ["routineLog"],
  RoutineMetadataGroup: ["routine"],
  RoutineTagAssignment: ["routine"],
  ScheduleEntry: ["schedulePlan"],
  SchedulePlanActivation: ["schedulePlan"],
  SessionExercise: ["routineLog"],
  SessionLogMetricValue: ["routineLog"],
  SessionRoutineDetails: ["routine"],
  SetEntry: ["sessionExercise", "routineLog"],
};

const DEFAULT_PROFILE_KEY = "default";

const READ_OPS = new Set(["findFirst", "findFirstOrThrow", "findMany", "count", "aggregate", "groupBy"]);
const UNIQUE_READ_OPS = new Set(["findUnique", "findUniqueOrThrow"]);
const UNIQUE_WRITE_OPS = new Set(["update", "delete"]);
const MANY_WRITE_OPS = new Set(["updateMany", "updateManyAndReturn", "deleteMany"]);
const CREATE_OPS = new Set(["create", "createMany", "createManyAndReturn"]);

type Where = Record<string, unknown>;
type Scope = { where: Where; stamp: boolean };

function nest(path: string[], leaf: Where): Where {
  return path.reduceRight<Where>((inner, field) => ({ [field]: inner }), leaf);
}

// Exercise rows with a null profileKey are the shared catalog: readable by
// everyone, editable only by the default (catalog-owning) profile.
function exerciseScope(profileKey: string, operation: string): Where {
  const isRead = READ_OPS.has(operation) || UNIQUE_READ_OPS.has(operation);
  if (!isRead && profileKey !== DEFAULT_PROFILE_KEY) return { profileKey };
  return { OR: [{ profileKey: null }, { profileKey }] };
}

function scopeFor(model: string, operation: string, profileKey: string): Scope | null {
  if (model === "Exercise") return { where: exerciseScope(profileKey, operation), stamp: true };
  if (model === "UserStimulusPreference") return { where: { profile: { key: profileKey } }, stamp: false };
  if (OWNED_MODELS.has(model)) return { where: { profileKey }, stamp: true };
  const path = CHILD_PATHS[model];
  return path ? { where: nest(path, { profileKey }), stamp: false } : null;
}

function stamp<T>(data: T, profileKey: string): T {
  if (Array.isArray(data)) return data.map((row) => stamp(row, profileKey)) as T;
  if (data && typeof data === "object") return { profileKey, ...(data as object) } as T;
  return data;
}

function andWhere(where: unknown, scope: Where): Where {
  return where ? { AND: [where, scope] } : scope;
}

export function scopeArgs(model: string, operation: string, args: unknown, profileKey: string) {
  const scope = scopeFor(model, operation, profileKey);
  if (!scope) return args;

  const a = { ...(args as Record<string, unknown>) };
  if (READ_OPS.has(operation) || MANY_WRITE_OPS.has(operation)) {
    a.where = andWhere(a.where, scope.where);
  } else if (UNIQUE_READ_OPS.has(operation) || UNIQUE_WRITE_OPS.has(operation) || operation === "upsert") {
    const where = (a.where ?? {}) as Where;
    const and = where.AND === undefined ? [] : Array.isArray(where.AND) ? where.AND : [where.AND];
    a.where = { ...where, AND: [...and, scope.where] };
  }
  if (scope.stamp && operation === "upsert") a.create = stamp(a.create, profileKey);
  if (scope.stamp && CREATE_OPS.has(operation)) a.data = stamp(a.data, profileKey);
  return a;
}

export const SCOPED_MODEL_NAMES = [...OWNED_MODELS, ...Object.keys(CHILD_PATHS), "Exercise", "UserStimulusPreference"];

// Synthetic placeholder routines (endurance, one per sport) have fixed ids that
// code and clients reference directly. Only the default profile stores them
// verbatim; every other profile stores `<base>~<tag>-synthetic` and this layer
// translates at the query boundary, so app code only ever sees the logical id.
// The physical form keeps the `sports-` prefix and `-synthetic` suffix so
// startsWith/endsWith filters still match.
// `fg_<routineId>` frequency goals derive their id from the routine id.
const LOGICAL_SYNTHETIC_ID = /^((?:fg_)?(?:endurance|sports-[a-z0-9-]+))-synthetic$/;
const PHYSICAL_SYNTHETIC_ID = /^(?:fg_)?(?:endurance|sports-[a-z0-9-]+)~[a-z0-9]+-synthetic$/;

function profileTag(profileKey: string) {
  return profileKey.toLowerCase().replace(/[^a-z0-9]/g, "");
}

export function physicalSyntheticId(logicalId: string, profileKey: string) {
  if (profileKey === DEFAULT_PROFILE_KEY) return logicalId;
  const match = LOGICAL_SYNTHETIC_ID.exec(logicalId);
  return match ? `${match[1]}~${profileTag(profileKey)}-synthetic` : logicalId;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (!value || typeof value !== "object") return false;
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

function mapStrings(value: unknown, fn: (s: string) => string): unknown {
  if (typeof value === "string") return fn(value);
  if (Array.isArray(value)) return value.map((v) => mapStrings(v, fn));
  if (!isPlainObject(value)) return value;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(value)) out[k] = mapStrings(v, fn);
  return out;
}

export function toPhysicalSyntheticIds(args: unknown, profileKey: string) {
  if (profileKey === DEFAULT_PROFILE_KEY) return args;
  return mapStrings(args, (s) => (LOGICAL_SYNTHETIC_ID.test(s) ? physicalSyntheticId(s, profileKey) : s));
}

export function toLogicalSyntheticIds<T>(result: T, profileKey: string): T {
  if (profileKey === DEFAULT_PROFILE_KEY) return result;
  return mapStrings(result, (s) => (PHYSICAL_SYNTHETIC_ID.test(s) ? s.replace(/~[a-z0-9]+-synthetic$/, "-synthetic") : s)) as T;
}

export type RelationMap = Record<string, Record<string, { target: string; isList: boolean }>>;

// Nested reads that start at a shared model (BodyZone → painLogs, ActivityType
// → userPreferences, Exercise → sessionExercises) never pass through the
// owned model's own query, so the extension never sees them. Filter those
// list relations here. Relations from an owned/child parent are already
// confined by the parent's scope.
function confinesChildren(model: string) {
  return OWNED_MODELS.has(model) || model in CHILD_PATHS || model === "UserStimulusPreference";
}

function withWhere(value: unknown, scope: Where): Record<string, unknown> {
  if (value === true) return { where: scope };
  const v = value as Record<string, unknown>;
  return { ...v, where: andWhere(v.where, scope) };
}

function scopeSelection(model: string, selection: unknown, profileKey: string, relations: RelationMap): unknown {
  if (!isPlainObject(selection)) return selection;
  const fields = relations[model] ?? {};
  const out: Record<string, unknown> = {};
  for (const [field, value] of Object.entries(selection)) {
    if (field === "_count" && isPlainObject(value) && isPlainObject(value.select)) {
      const counted: Record<string, unknown> = {};
      for (const [rel, v] of Object.entries(value.select)) {
        const target = fields[rel]?.target;
        const scope = target && !confinesChildren(model) ? scopeFor(target, "findMany", profileKey) : null;
        counted[rel] = scope && v ? withWhere(v, scope.where) : v;
      }
      out[field] = { ...value, select: counted };
      continue;
    }
    const relation = fields[field];
    if (!relation || !value) {
      out[field] = value;
      continue;
    }
    const scope = relation.isList && !confinesChildren(model) ? scopeFor(relation.target, "findMany", profileKey) : null;
    let next: unknown = scope ? withWhere(value, scope.where) : value;
    if (isPlainObject(next)) {
      next = {
        ...next,
        ...(next.include ? { include: scopeSelection(relation.target, next.include, profileKey, relations) } : {}),
        ...(next.select ? { select: scopeSelection(relation.target, next.select, profileKey, relations) } : {}),
      };
    }
    out[field] = next;
  }
  return out;
}

export function scopeNestedReads(model: string, args: unknown, profileKey: string, relations: RelationMap) {
  if (!isPlainObject(args) || (!args.include && !args.select)) return args;
  return {
    ...args,
    ...(args.include ? { include: scopeSelection(model, args.include, profileKey, relations) } : {}),
    ...(args.select ? { select: scopeSelection(model, args.select, profileKey, relations) } : {}),
  };
}

export function canEditExercise(exerciseProfileKey: string | null, profileKey: string) {
  return exerciseProfileKey === profileKey || (exerciseProfileKey === null && profileKey === DEFAULT_PROFILE_KEY);
}

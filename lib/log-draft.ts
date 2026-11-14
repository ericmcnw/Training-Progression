import type { WorkoutBlock } from "@/app/routines/[id]/log/WorkoutExerciseEditor";
import type { SessionMetricDraftValue } from "@/app/routines/[id]/log-session/SessionMetricFields";
import type { ClimbAttemptDraft, QuickClimbRow } from "@/lib/climb-types";
import type { SpotPickerValue } from "@/lib/spot-picker-types";
import type { PoolSwimFormState } from "@/app/routines/[id]/log-cardio/PoolSwimSets";
import type { GearPick } from "@/lib/gear-pick-types";

const DRAFT_KEY_PREFIX = "log-draft:";
const DRAFT_INDEX_KEY = "log-draft-index";
const DRAFT_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

export type WorkoutDraft = {
  kind: "WORKOUT";
  routineId: string;
  routineName: string;
  startedAt: string;
  notes: string;
  performedAtLocal: string;
  blocks: WorkoutBlock[];
  // Perceived effort 1-10, or null until rated. Optional so drafts written
  // before the strain model deserialize cleanly.
  effort?: number | null;
};

export type SessionDraft = {
  kind: "SESSION";
  routineId: string;
  routineName: string;
  startedAt: string;
  notes: string;
  performedAtLocal: string;
  durationMin: string;
  // Legacy free-text location field. New drafts always set this empty —
  // the structured `spotValue` below is the canonical location record.
  // Kept in the schema so old drafts deserialize without crashing.
  location: string;
  sessionMetricValues: Record<string, SessionMetricDraftValue>;
  selectedClimbingGrades: string[];
  climbMode?: "quick" | "per-climb";
  climbAttempts?: ClimbAttemptDraft[];
  // Discipline-aware quick-mode rows. Replaces the legacy per-grade counts
  // (which lived in sessionMetricValues + quickAttemptedValues) so a single
  // session can mix bouldering + rope work without losing data on resume.
  quickClimbRows?: QuickClimbRow[];
  // Structured spot pick — covers both saved-ref and new-spot drafts for
  // any activity (climbing GYM/CRAG, cardio ActivitySpot, etc.). Preserved
  // verbatim across refresh so OSM identity + coords survive the round-trip.
  spotValue?: SpotPickerValue;
  // Legacy climbLocation fields. Older drafts wrote here; the restore code
  // promotes them into spotValue if spotValue is missing. New drafts no
  // longer write these.
  climbLocationId?: string | null;
  newClimbLocationName?: string;
  newClimbLocationType?: "GYM" | "CRAG";
  newClimbLocationRegion?: string;
  newClimbLocationLatitude?: number;
  newClimbLocationLongitude?: number;
};

export type CardioDraft = {
  kind: "CARDIO";
  routineId: string;
  routineName: string;
  startedAt: string;
  notes: string;
  performedAtLocal: string;
  // Form field state — preserved for refresh-safety in addition to
  // chip-strip visibility.
  distanceMi: string;
  elevationGainFt: string;
  /** Carried-load override in lb. Optional so drafts written before the
   *  field landed still deserialize. */
  packWeightLb?: string;
  minutes: string;
  seconds: string;
  // Active activity type — surfaced so the ActiveSessionTray chip shows
  // "Run" / "Hike" / etc. instead of literally "Endurance" when the draft
  // is against the synthetic Endurance routine. Optional so older drafts
  // (pre-endurance unification) still deserialize cleanly.
  activityTypeId?: string | null;
  activityTypeName?: string | null;
  // Legacy free-text location. Same back-compat story as SessionDraft.
  location: string;
  // Structured spot pick (saved-ref OR new-spot draft) — restored
  // verbatim into the SpotPicker on form remount.
  spotValue?: SpotPickerValue;
  // Perceived effort 1-10, or null when the user hasn't rated yet. Optional
  // so drafts written before the strain model deserialize cleanly.
  effort?: number | null;
  // Gear picks (footwear etc.) — restored into the GearPicker on remount.
  // Optional so older drafts deserialize cleanly.
  gear?: GearPick[];
  // Pool-swim set builder state, held as typed strings so a half-entered
  // set survives a refresh. Only present on Pool Swim logs.
  poolSwim?: PoolSwimFormState;
};

export type GuidedDraft = {
  kind: "GUIDED";
  routineId: string;
  routineName: string;
  startedAt: string;
  notes: string;
  performedAtLocal: string;
  // Player progression state — refresh-safe restoration of where the user
  // was in the guided sequence.
  screen: "entry" | "player" | "review";
  autoPlay: boolean;
  currentSegmentIndex: number;
  completedDurationSec: number;
  skippedStepIds: string[];
  reviewMode: "review" | "log-after";
};

export type LogDraft = WorkoutDraft | SessionDraft | CardioDraft | GuidedDraft;

// localStorage is per-browser but a draft belongs to one profile. Without the
// profile in the key, an admin who logs through view-as leaves drafts that
// resume on their own account (and the synthetic routine ids every profile
// shares collide outright).
function draftKey(profileKey: string, routineId: string) {
  return `${DRAFT_KEY_PREFIX}${profileKey}:${routineId}`;
}

function indexKey(profileKey: string) {
  return `${DRAFT_INDEX_KEY}:${profileKey}`;
}

function readIndex(profileKey: string): string[] {
  return JSON.parse(localStorage.getItem(indexKey(profileKey)) ?? "[]");
}

export function loadDraftFromStorage(profileKey: string, routineId: string): LogDraft | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(draftKey(profileKey, routineId));
    if (!raw) return null;
    const draft = JSON.parse(raw) as LogDraft;
    // Auto-expire drafts older than 7 days
    if (Date.now() - new Date(draft.startedAt).getTime() > DRAFT_MAX_AGE_MS) {
      clearDraftFromStorage(profileKey, routineId);
      return null;
    }
    return draft;
  } catch {
    return null;
  }
}

export function loadAllDraftsFromStorage(profileKey: string): LogDraft[] {
  if (typeof window === "undefined") return [];
  try {
    return readIndex(profileKey)
      .map((id) => loadDraftFromStorage(profileKey, id))
      .filter((d): d is LogDraft => d !== null);
  } catch {
    return [];
  }
}

export function saveDraftToStorage(profileKey: string, draft: LogDraft): void {
  if (typeof window === "undefined") return;
  try {
    const index = readIndex(profileKey);
    if (!index.includes(draft.routineId)) {
      localStorage.setItem(indexKey(profileKey), JSON.stringify([...index, draft.routineId]));
    }
    localStorage.setItem(draftKey(profileKey, draft.routineId), JSON.stringify(draft));
  } catch {
    // Ignore quota / private-mode errors
  }
}

export function clearDraftFromStorage(profileKey: string, routineId: string): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(draftKey(profileKey, routineId));
    const index = readIndex(profileKey);
    localStorage.setItem(indexKey(profileKey), JSON.stringify(index.filter((id) => id !== routineId)));
  } catch {
    // Ignore errors
  }
}

// Drafts written before the key carried a profile can't be attributed to one,
// so they're dropped rather than handed to whoever signs in next. A routine id
// never contains a colon, so an un-namespaced key is identifiable.
export function purgeUnscopedDrafts(): void {
  if (typeof window === "undefined") return;
  try {
    const stale: string[] = [];
    // Collected before removing — deleting mid-scan shifts the indices.
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key) continue;
      const isLegacyDraft =
        key.startsWith(DRAFT_KEY_PREFIX) && !key.slice(DRAFT_KEY_PREFIX.length).includes(":");
      if (key === DRAFT_INDEX_KEY || isLegacyDraft) stale.push(key);
    }
    for (const key of stale) localStorage.removeItem(key);
  } catch {
    // Ignore errors
  }
}

export function draftAgeLabel(draft: LogDraft): string {
  const ms = Date.now() - new Date(draft.startedAt).getTime();
  const minutes = Math.floor(ms / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(ms / 3600000);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(ms / 86400000);
  return `${days}d ago`;
}

export function draftIsRecent(draft: LogDraft): boolean {
  return Date.now() - new Date(draft.startedAt).getTime() < 3 * 60 * 60 * 1000;
}

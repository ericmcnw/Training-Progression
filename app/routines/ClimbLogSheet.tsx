"use client";

import { useEffect, useState, useTransition, type CSSProperties } from "react";
import {
  listAreasForClimbLocation,
  loadClimbSpotPickerData,
  logClimbAction,
  type ClimbLogInput,
} from "@/app/log/climb-log-actions";
import {
  climbOutcomeBg,
  climbOutcomeColor,
  outcomeUsesTriesCount,
  type ClimbingDiscipline,
  type ClimbGradeSystem,
  type ClimbOutcome,
  type ClimbProblemBasic,
} from "@/lib/climb-types";
import { climbingGradeOptionsForDiscipline } from "@/lib/session-templates";
import SportLogModal from "./SportLogModal";
import AreaCombobox from "./AreaCombobox";
import ProblemCombobox, { type ProblemPick } from "./ProblemCombobox";
import SpotPicker from "@/app/components/log/SpotPicker";
import type { SpotPickerValue } from "@/lib/spot-picker-types";
import type { ActivitySpotConfig, SpotPickerItem } from "@/lib/activity-spots";
import { inputStyle, textareaStyle } from "@/app/routines/[id]/log/form-ui";
import { EffortSlider } from "@/app/components/strain/EffortSlider";
import { useLearnedEffortPrefill } from "@/app/components/strain/useLearnedEffort";

// Synthetic SpotPicker config for climbing. getActivitySpotConfig() returns
// null for climbing (its spots live in ClimbLocation, not ActivitySpot), but
// the picker still needs GYM/CRAG type options so a newly-pinned location
// carries its type. SpotPicker only reads `spotTypes` off the config, so a
// local literal is safe — routing to ClimbLocation happens in the action.
const CLIMB_SPOT_CONFIG: ActivitySpotConfig = {
  supportsMap: true,
  spotTypes: [
    { value: "GYM", label: "Gym", emoji: "🧗", pinColor: "rgba(56,189,248,0.9)" },
    { value: "CRAG", label: "Crag", emoji: "⛰️", pinColor: "rgba(132,204,22,0.9)" },
  ],
  defaultPinColor: "rgba(56,189,248,0.9)",
  spotNoun: "crag / gym",
};

type ClimbRecentSpot = { ref: { kind: "climbLocation"; id: string }; name: string; region: string | null };

// Rich climb-log sheet — replaces the generic SportQuickLogRow sheet
// when the user taps the "Climbing" row. Per-attempt entry with
// discipline + grade + outcome, plus session-level date / location /
// duration / notes. Saves via logClimbAction → logSession (existing
// server action handles location resolution + ClimbAttempt creation).

type Attempt = {
  localId: string;
  discipline: ClimbingDiscipline;
  grade: string;
  outcome: ClimbOutcome;
  /** Existing ClimbProblem picked from the combobox — links by id so a
   *  repeat lands on the same problem regardless of grade edits. */
  problemId: string;
  /** OR a typed climb / route / problem name. Server resolves against
   *  existing ClimbProblem rows at the picked location, creates a new
   *  one otherwise. Ignored when problemId is set. */
  name: string;
  /** Pick a saved area at the location. */
  areaId: string;
  /** OR type a fresh area name. If areaId is set the typed name
   *  is ignored on save. */
  area: string;
  /** Tries-to-send. Only meaningful when outcome is SEND/REDPOINT;
   *  hidden in the UI otherwise. Stored as string so empty stays empty. */
  triesCount: string;
  notes: string;
};

const DISCIPLINE_OPTIONS: Array<{ value: ClimbingDiscipline; label: string }> = [
  { value: "BOULDER", label: "Boulder" },
  { value: "TOP_ROPE", label: "Top Rope" },
  { value: "SPORT_LEAD", label: "Sport / Lead" },
];

const OUTCOMES_BY_DISCIPLINE: Record<ClimbingDiscipline, ClimbOutcome[]> = {
  BOULDER: ["FLASH", "SEND", "PROJECT"],
  TOP_ROPE: ["ONSIGHT", "FLASH", "SEND", "PROJECT"],
  SPORT_LEAD: ["ONSIGHT", "FLASH", "REDPOINT", "PROJECT"],
};

const OUTCOME_LABEL: Record<ClimbOutcome, string> = {
  FLASH: "Flash",
  ONSIGHT: "Onsight",
  SEND: "Send",
  REDPOINT: "Redpoint",
  FELL: "Fell",
  PROJECT: "Project",
};

function gradeSystemFor(d: ClimbingDiscipline): ClimbGradeSystem {
  return d === "BOULDER" ? "BOULDER_V" : "YOSEMITE";
}

function defaultOutcome(d: ClimbingDiscipline): ClimbOutcome {
  return OUTCOMES_BY_DISCIPLINE[d][0];
}

function newAttempt(d: ClimbingDiscipline = "BOULDER"): Attempt {
  return {
    localId: Math.random().toString(36).slice(2),
    discipline: d,
    grade: "",
    outcome: defaultOutcome(d),
    problemId: "",
    name: "",
    areaId: "",
    area: "",
    triesCount: "",
    notes: "",
  };
}

export default function ClimbLogSheet({ onClose }: { onClose: () => void }) {
  const [performedAt, setPerformedAt] = useState(() => formatLocalDateTime(new Date()));
  const [duration, setDuration] = useState("");
  const [notes, setNotes] = useState("");
  const [effort, setEffort] = useState<number | null>(null);
  const [attempts, setAttempts] = useState<Attempt[]>(() => [newAttempt()]);
  const predictedEffort = useLearnedEffortPrefill({
    routineId: "sports-climbing-synthetic",
    durationMin: Number(duration) > 0 ? Number(duration) : null,
  });

  // Location — a single SpotPicker value: search any saved ClimbLocation,
  // pick a recent chip, or pin a new place via OSM. Saved picks are always
  // climbLocation refs (we only feed climb locations as saved spots).
  const [spotValue, setSpotValue] = useState<SpotPickerValue>(null);
  const [savedSpots, setSavedSpots] = useState<SpotPickerItem[]>([]);
  const [recentSpots, setRecentSpots] = useState<ClimbRecentSpot[]>([]);

  // The picked existing-location id, when the value is a saved climb
  // location — drives the per-attempt saved-area chips. A brand-new pin has
  // no id yet (created on save), so areas fall back to free-text.
  const pickedLocationId =
    spotValue?.kind === "saved" && spotValue.ref.kind === "climbLocation" ? spotValue.ref.id : null;

  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  // Load saved + recent climb locations once on mount.
  useEffect(() => {
    let cancelled = false;
    loadClimbSpotPickerData()
      .then((data) => {
        if (cancelled) return;
        setSavedSpots(data.savedSpots);
        setRecentSpots(data.recentSpots);
        // Auto-pick the most recent location — 95% of the time it's the
        // right answer and saves a tap.
        const top = data.recentSpots[0];
        if (top) {
          setSpotValue({ kind: "saved", ref: top.ref, display: { name: top.name, region: top.region } });
        }
      })
      .catch(() => {
        /* non-fatal — picker just won't show saved/recents */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Saved areas + problems for the picked location — fed into the
  // per-attempt area/name pickers. Re-fetches when locationId changes
  // (different gym → different areas/climbs). When the location changes,
  // also clear any picked areaId/problemId on existing attempts so a
  // chip for "Cave Wall @ Gym A" doesn't carry over and FK-violate
  // when saving against Gym B (both are scoped per-location).
  const [savedAreas, setSavedAreas] = useState<Array<{ id: string; name: string }>>([]);
  const [savedProblems, setSavedProblems] = useState<ClimbProblemBasic[]>([]);
  useEffect(() => {
    let cancelled = false;
    setAttempts((arr) =>
      arr.map((a) => (a.areaId || a.problemId ? { ...a, areaId: "", problemId: "" } : a))
    );
    if (!pickedLocationId) {
      setSavedAreas([]);
      setSavedProblems([]);
      return;
    }
    listAreasForClimbLocation(pickedLocationId)
      .then((rows) => {
        if (!cancelled) setSavedAreas(rows);
      })
      .catch(() => {});
    fetch(`/api/climb-problems?locationId=${pickedLocationId}`)
      .then((res) => (res.ok ? res.json() : []))
      .then((rows) => {
        if (!cancelled) setSavedProblems(rows);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [pickedLocationId]);

  function updateAttempt(localId: string, patch: Partial<Attempt>) {
    setAttempts((arr) =>
      arr.map((a) => {
        if (a.localId !== localId) return a;
        const merged = { ...a, ...patch };
        // When discipline changes, also flip the outcome to a valid
        // option for the new discipline (BOULDER's FLASH isn't valid
        // on SPORT_LEAD, etc.) — unless the patch already supplies one.
        if (patch.discipline && patch.discipline !== a.discipline) {
          if (patch.outcome === undefined) merged.outcome = defaultOutcome(patch.discipline);
          // Grade scale changes with discipline (V-scale ↔ YDS), so a
          // carried-over grade would be invalid for the new dropdown —
          // clear it and let the user re-pick. A patch that sets the
          // grade alongside the discipline (saved-problem pick) keeps it.
          if (patch.grade === undefined) merged.grade = "";
        }
        return merged;
      })
    );
  }

  function removeAttempt(localId: string) {
    setAttempts((arr) => (arr.length === 1 ? arr : arr.filter((a) => a.localId !== localId)));
  }

  function addAttempt() {
    // New attempts inherit the last attempt's discipline — most
    // sessions are mono-discipline so this saves taps.
    const last = attempts[attempts.length - 1];
    setAttempts((arr) => [...arr, newAttempt(last?.discipline ?? "BOULDER")]);
  }

  // One-tap repeat: clone the climb's identity (discipline / grade /
  // name / area) into a fresh card right below it. Outcome defaults to
  // the discipline's send outcome — a repeat lap is by definition not a
  // flash/onsight, and tries/notes are per-lap so they start empty.
  function repeatAttempt(localId: string) {
    setAttempts((arr) => {
      const idx = arr.findIndex((a) => a.localId === localId);
      if (idx === -1) return arr;
      const src = arr[idx];
      const clone: Attempt = {
        ...newAttempt(src.discipline),
        grade: src.grade,
        outcome: src.discipline === "SPORT_LEAD" ? "REDPOINT" : "SEND",
        problemId: src.problemId,
        name: src.name,
        areaId: src.areaId,
        area: src.area,
      };
      return [...arr.slice(0, idx + 1), clone, ...arr.slice(idx + 1)];
    });
  }

  // Wire a combobox pick into the attempt. Picking a saved problem also
  // autofills its grade / discipline / latest area; picking a name typed
  // earlier this session copies that card's grade + discipline so both
  // laps resolve to the same ClimbProblem on save.
  function applyProblemPick(localId: string, pick: ProblemPick) {
    const patch: Partial<Attempt> = { problemId: pick.problemId, name: pick.name };
    if (pick.problemId) {
      const p = savedProblems.find((sp) => sp.id === pick.problemId);
      if (p) {
        patch.grade = p.grade;
        if (p.gradeSystem === "BOULDER_V") {
          patch.discipline = "BOULDER";
        } else {
          const current = attempts.find((a) => a.localId === localId);
          patch.discipline = current?.discipline === "SPORT_LEAD" ? "SPORT_LEAD" : "TOP_ROPE";
        }
        if (p.areaId && savedAreas.some((s) => s.id === p.areaId)) {
          patch.areaId = p.areaId;
          patch.area = "";
        }
      }
    } else if (pick.name) {
      const src = attempts.find(
        (a) => a.localId !== localId && a.name.trim().toLowerCase() === pick.name.toLowerCase()
      );
      if (src) {
        patch.grade = src.grade;
        patch.discipline = src.discipline;
      }
    }
    updateAttempt(localId, patch);
  }

  function submit() {
    setError(null);
    const ms = Date.parse(performedAt);
    if (Number.isNaN(ms)) {
      setError("Invalid date/time.");
      return;
    }
    const validAttempts = attempts.filter((a) => a.grade.trim().length > 0);
    if (validAttempts.length === 0) {
      setError("Add at least one climb with a grade.");
      return;
    }
    const minutes = duration.trim() === "" ? undefined : Number(duration);
    if (minutes !== undefined && (Number.isNaN(minutes) || minutes < 0)) {
      setError("Duration must be a positive number.");
      return;
    }
    // Resolve the picked spot into climb-location params. Saved climb
    // location → id; a new pin → name/type/coords/osm (logSession dedups
    // by name+type+osm and backfills coordinates). No spot → null location.
    let locationParams: Pick<
      ClimbLogInput,
      | "climbLocationId"
      | "newLocationName"
      | "newLocationType"
      | "newLocationRegion"
      | "newLocationLatitude"
      | "newLocationLongitude"
      | "newLocationOsmType"
      | "newLocationOsmId"
    > = {};
    if (spotValue?.kind === "saved" && spotValue.ref.kind === "climbLocation") {
      locationParams = { climbLocationId: spotValue.ref.id };
    } else if (spotValue?.kind === "new") {
      const d = spotValue.draft;
      if (!d.name.trim()) {
        setError("Name the new location, or pick one from your saved list.");
        return;
      }
      locationParams = {
        newLocationName: d.name.trim(),
        newLocationType: d.type === "CRAG" ? "CRAG" : "GYM",
        newLocationRegion: d.region,
        newLocationLatitude: d.latitude,
        newLocationLongitude: d.longitude,
        newLocationOsmType: d.osmType,
        newLocationOsmId: d.osmId,
      };
    }

    startTransition(async () => {
      try {
        await logClimbAction({
          performedAtIso: new Date(ms).toISOString(),
          durationMinutes: minutes,
          notes: notes.trim() || undefined,
          effort,
          ...locationParams,
          attempts: validAttempts.map((a) => {
            const triesNum =
              outcomeUsesTriesCount(a.outcome) && a.triesCount.trim() !== ""
                ? Math.max(1, Math.round(Number(a.triesCount)))
                : undefined;
            return {
              discipline: a.discipline,
              grade: a.grade.trim(),
              gradeSystem: gradeSystemFor(a.discipline),
              outcome: a.outcome,
              problemId: a.problemId || undefined,
              name: a.problemId ? undefined : a.name.trim() || undefined,
              areaId: a.areaId || undefined,
              area: a.areaId ? undefined : a.area.trim() || undefined,
              triesCount: Number.isFinite(triesNum) ? triesNum : undefined,
              notes: a.notes.trim() || undefined,
            };
          }),
        });
        onClose();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to save climb log.");
      }
    });
  }

  // Area names typed during this session (free-text, no saved id yet) so
  // an area entered on climb #1 becomes a pickable option on climb #2+.
  const sessionAreas = Array.from(
    new Set(attempts.map((a) => a.area.trim()).filter((n) => n.length > 0))
  );

  // Same for climb names — a name typed on climb #1 becomes a pickable
  // option on climb #2+, so a repeat lap links to the same problem.
  const sessionNames = Array.from(
    new Map(
      attempts
        .map((a) => a.name.trim())
        .filter((n) => n.length > 0)
        .map((n) => [n.toLowerCase(), n] as const)
    ).values()
  );

  // Earlier attempt this session on the same climb (linked id, or same
  // typed name) — drives the ↻ badge so a repeat reads as one at a glance.
  function repeatOfIndex(idx: number): number {
    const a = attempts[idx];
    return attempts.findIndex(
      (b, j) =>
        j < idx &&
        ((a.problemId !== "" && b.problemId === a.problemId) ||
          (a.name.trim() !== "" && b.name.trim().toLowerCase() === a.name.trim().toLowerCase()))
    );
  }

  return (
    <SportLogModal
      title="Log Climbing"
      onClose={onClose}
      footer={
        <>
          <button type="button" onClick={onClose} style={btnSecondary} disabled={pending}>
            Cancel
          </button>
          <button type="button" onClick={submit} style={btnPrimary} disabled={pending}>
            {pending ? "Saving…" : "Save session"}
          </button>
        </>
      }
    >
      <>
          {/* Session-level fields */}
          <label style={fieldLabel}>
            When
            <input
              type="datetime-local"
              value={performedAt}
              onChange={(e) => setPerformedAt(e.target.value)}
              style={fieldInput}
            />
          </label>

          <div style={fieldGroup}>
            <span style={fieldGroupLabel}>Location</span>
            <SpotPicker
              config={CLIMB_SPOT_CONFIG}
              spotNoun="crag / gym"
              savedSpots={savedSpots}
              recentSpots={recentSpots}
              value={spotValue}
              onChange={setSpotValue}
            />
          </div>

          {/* Climbs list */}
          <div style={fieldGroup}>
            <span style={fieldGroupLabel}>Climbs</span>
            <div style={attemptStack}>
              {attempts.map((a, idx) => {
                const outcomes = OUTCOMES_BY_DISCIPLINE[a.discipline];
                const showTries = outcomeUsesTriesCount(a.outcome);
                const repeatIdx = repeatOfIndex(idx);
                const linkedProblem = a.problemId
                  ? savedProblems.find((p) => p.id === a.problemId)
                  : undefined;
                const isPriorSend = (linkedProblem?.priorSendCount ?? 0) > 0;
                return (
                  <div
                    key={a.localId}
                    style={{
                      ...attemptCard,
                      // Subtle tint per outcome so the card itself
                      // reads as flash/send/project at a glance.
                      borderLeft: `3px solid ${climbOutcomeColor(a.outcome)}`,
                    }}
                  >
                    <div style={attemptHeader}>
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                        <span style={attemptIndex}>#{idx + 1}</span>
                        {repeatIdx >= 0 ? (
                          <span style={repeatBadge} title={`Same climb as #${repeatIdx + 1}`}>
                            ↻ repeat of #{repeatIdx + 1}
                          </span>
                        ) : isPriorSend ? (
                          <span
                            style={repeatBadge}
                            title={`Previously sent ${linkedProblem!.priorSendCount}×`}
                          >
                            ↻ sent {linkedProblem!.priorSendCount}× before
                          </span>
                        ) : null}
                      </span>
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                        <button
                          type="button"
                          style={repeatAttemptBtn}
                          onClick={() => repeatAttempt(a.localId)}
                          aria-label={`Log climb ${idx + 1} again`}
                        >
                          ↻ Repeat
                        </button>
                        {attempts.length > 1 ? (
                          <button
                            type="button"
                            style={removeAttemptBtn}
                            onClick={() => removeAttempt(a.localId)}
                            aria-label={`Remove climb ${idx + 1}`}
                          >
                            ✕
                          </button>
                        ) : null}
                      </span>
                    </div>

                    {/* Discipline + grade (+ tries when SEND/REDPOINT) */}
                    <div style={attemptRow}>
                      <select
                        value={a.discipline}
                        onChange={(e) => updateAttempt(a.localId, { discipline: e.target.value as ClimbingDiscipline })}
                        style={{ ...fieldInput, flex: "1 1 110px", minWidth: 0 }}
                        aria-label="Discipline"
                      >
                        {DISCIPLINE_OPTIONS.map((d) => (
                          <option key={d.value} value={d.value}>{d.label}</option>
                        ))}
                      </select>
                      {(() => {
                        const gradeOpts = climbingGradeOptionsForDiscipline(a.discipline);
                        // Preserve an out-of-list grade (a legacy/elite value
                        // beyond the standard ladder) so a dropdown switch
                        // never silently drops it.
                        const showCustom = a.grade.trim() !== "" && !gradeOpts.includes(a.grade);
                        return (
                          <select
                            value={a.grade}
                            onChange={(e) => updateAttempt(a.localId, { grade: e.target.value })}
                            style={{ ...fieldInput, flex: "1 1 90px", minWidth: 0 }}
                            aria-label="Grade"
                          >
                            <option value="">Grade</option>
                            {showCustom ? <option value={a.grade}>{a.grade}</option> : null}
                            {gradeOpts.map((g) => (
                              <option key={g} value={g}>{g}</option>
                            ))}
                          </select>
                        );
                      })()}
                      {showTries ? (
                        <input
                          type="number"
                          inputMode="numeric"
                          placeholder="Tries"
                          value={a.triesCount}
                          onChange={(e) => updateAttempt(a.localId, { triesCount: e.target.value })}
                          style={{ ...fieldInput, flex: "0 0 70px", minWidth: 0 }}
                          aria-label="Tries to send"
                        />
                      ) : null}
                    </div>

                    {/* Outcome chips — color-coded so flash/send/project read
                        instantly. Selected chip uses the full outcome color;
                        unselected chips stay neutral. */}
                    <div style={outcomeChipRow}>
                      {outcomes.map((o) => {
                        const isOn = a.outcome === o;
                        return (
                          <button
                            key={o}
                            type="button"
                            onClick={() => updateAttempt(a.localId, { outcome: o })}
                            style={
                              isOn
                                ? outcomeChipActive(climbOutcomeColor(o), climbOutcomeBg(o))
                                : outcomeChipInactive
                            }
                            aria-pressed={isOn}
                          >
                            {OUTCOME_LABEL[o]}
                          </button>
                        );
                      })}
                    </div>

                    {/* Climb identity — name + area. Optional but
                        recommended; the server resolves them into
                        ClimbProblem / ClimbArea rows. Both comboboxes
                        search saved rows at the location + values typed
                        earlier this session, creating fresh ones when
                        nothing matches — so a repeat lap links to the
                        same climb instead of duplicating it. */}
                    <div style={attemptRow}>
                      <ProblemCombobox
                        problemId={a.problemId}
                        name={a.name}
                        savedProblems={savedProblems}
                        sessionNames={sessionNames.filter(
                          (n) => n.toLowerCase() !== a.name.trim().toLowerCase()
                        )}
                        onPick={(pick) => applyProblemPick(a.localId, pick)}
                      />
                      <AreaCombobox
                        areaId={a.areaId}
                        area={a.area}
                        savedAreas={savedAreas}
                        sessionAreas={sessionAreas}
                        onPick={(pick) => updateAttempt(a.localId, pick)}
                      />
                    </div>

                    <input
                      type="text"
                      placeholder="Notes (optional)"
                      value={a.notes}
                      onChange={(e) => updateAttempt(a.localId, { notes: e.target.value })}
                      style={{ ...fieldInput, width: "100%", marginTop: 6 }}
                    />
                  </div>
                );
              })}
              <button type="button" style={addAttemptBtn} onClick={addAttempt}>
                + Add climb
              </button>
            </div>
          </div>

          <div style={twoCol}>
            <label style={fieldLabel}>
              Duration (min)
              <input
                type="number"
                inputMode="numeric"
                placeholder="optional"
                value={duration}
                onChange={(e) => setDuration(e.target.value)}
                style={fieldInput}
              />
            </label>
            <div />
          </div>

          <div style={fieldGroup}>
            <span style={fieldGroupLabel}>Effort</span>
            <EffortSlider
              value={effort}
              predicted={predictedEffort}
              onChange={setEffort}
            />
          </div>

          <label style={fieldLabel}>
            Session notes
            <textarea
              placeholder="How'd the session go?"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              style={textareaStyle}
            />
          </label>

          {error ? <div style={errorText}>{error}</div> : null}
      </>
    </SportLogModal>
  );
}

function formatLocalDateTime(d: Date): string {
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

// ─── Styles ─────────────────────────────────────────────────────────────────

const fieldLabel: CSSProperties = {
  display: "grid",
  gap: 6,
  fontSize: 11,
  fontWeight: 800,
  opacity: 0.75,
  letterSpacing: 0.3,
  textTransform: "uppercase",
};
const fieldGroup: CSSProperties = { display: "grid", gap: 6 };
const fieldGroupLabel: CSSProperties = {
  fontSize: 11,
  fontWeight: 800,
  opacity: 0.75,
  letterSpacing: 0.3,
  textTransform: "uppercase",
};
// Match the endurance/session form's input chrome (form-ui.tsx). 16px
// font is required to block iOS Safari's focus-zoom behavior.
const fieldInput: CSSProperties = inputStyle;
const twoCol: CSSProperties = { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 };

const attemptStack: CSSProperties = { display: "grid", gap: 8 };
const attemptCard: CSSProperties = {
  padding: "10px 12px",
  borderRadius: 10,
  borderWidth: 1,
  borderStyle: "solid",
  borderColor: "rgba(255,255,255,0.10)",
  background: "rgba(255,255,255,0.025)",
};
const attemptHeader: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  marginBottom: 6,
};
const attemptIndex: CSSProperties = {
  fontSize: 10,
  fontWeight: 900,
  letterSpacing: 0.6,
  textTransform: "uppercase",
  opacity: 0.55,
};
const repeatBadge: CSSProperties = {
  fontSize: 10,
  fontWeight: 900,
  padding: "1px 5px",
  borderRadius: 6,
  background: "rgba(74,222,128,0.12)",
  border: "1px solid rgba(74,222,128,0.35)",
  color: "rgba(74,222,128,0.95)",
  whiteSpace: "nowrap",
  lineHeight: 1,
};
const repeatAttemptBtn: CSSProperties = {
  minHeight: 26,
  padding: "0 10px",
  borderRadius: 999,
  border: "1px solid rgba(255,255,255,0.16)",
  background: "rgba(255,255,255,0.04)",
  color: "rgba(255,255,255,0.8)",
  fontSize: 11,
  fontWeight: 800,
  cursor: "pointer",
};
const removeAttemptBtn: CSSProperties = {
  width: 26,
  height: 26,
  borderRadius: 999,
  border: "1px solid rgba(248,113,113,0.32)",
  background: "rgba(248,113,113,0.08)",
  color: "rgba(248,113,113,0.95)",
  fontSize: 12,
  fontWeight: 800,
  cursor: "pointer",
};
const attemptRow: CSSProperties = { display: "flex", gap: 6, flexWrap: "wrap", marginTop: 6 };

const outcomeChipRow: CSSProperties = {
  display: "flex",
  gap: 6,
  flexWrap: "wrap",
  marginTop: 8,
};

const outcomeChipInactive: CSSProperties = {
  padding: "6px 10px",
  borderRadius: 999,
  borderWidth: 1,
  borderStyle: "solid",
  borderColor: "rgba(255,255,255,0.10)",
  background: "rgba(255,255,255,0.03)",
  color: "rgba(255,255,255,0.65)",
  fontSize: 11,
  fontWeight: 800,
  letterSpacing: 0.3,
  cursor: "pointer",
};

function outcomeChipActive(color: string, bg: string): CSSProperties {
  return {
    ...outcomeChipInactive,
    borderColor: color.replace("0.9", "0.55"),
    background: bg,
    color,
  };
}
const addAttemptBtn: CSSProperties = {
  padding: "10px",
  borderRadius: 10,
  border: "1px dashed rgba(255,255,255,0.18)",
  background: "rgba(255,255,255,0.02)",
  color: "inherit",
  fontSize: 12,
  fontWeight: 800,
  cursor: "pointer",
  textAlign: "center",
};

const errorText: CSSProperties = {
  fontSize: 12,
  color: "rgba(248,113,113,0.95)",
  fontWeight: 700,
};
const btnPrimary: CSSProperties = {
  padding: "10px 16px",
  borderRadius: 10,
  border: "1px solid rgba(51,255,122,0.45)",
  background: "rgba(51,255,122,0.10)",
  color: "rgba(51,255,122,0.95)",
  fontSize: 13,
  fontWeight: 900,
  cursor: "pointer",
};
const btnSecondary: CSSProperties = {
  padding: "10px 16px",
  borderRadius: 10,
  border: "1px solid rgba(255,255,255,0.14)",
  background: "rgba(255,255,255,0.04)",
  color: "inherit",
  fontSize: 13,
  fontWeight: 800,
  cursor: "pointer",
};

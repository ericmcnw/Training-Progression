"use client";

import { useEffect, useState, useTransition, type CSSProperties } from "react";
import {
  listAreasForClimbLocation,
  listRecentClimbLocations,
  logClimbAction,
} from "@/app/log/climb-log-actions";
import {
  climbOutcomeBg,
  climbOutcomeColor,
  outcomeUsesTriesCount,
  type ClimbingDiscipline,
  type ClimbGradeSystem,
  type ClimbOutcome,
} from "@/lib/climb-types";
import SportLogModal from "./SportLogModal";
import { useSportLogDraft } from "./useSportLogDraft";
import { inputStyle, textareaStyle } from "@/app/routines/[id]/log/form-ui";

// Rich climb-log sheet — replaces the generic SportQuickLogRow sheet
// when the user taps the "Climbing" row. Per-attempt entry with
// discipline + grade + outcome, plus session-level date / location /
// duration / notes. Saves via logClimbAction → logSession (existing
// server action handles location resolution + ClimbAttempt creation).

type RecentLocation = {
  id: string;
  name: string;
  type: "GYM" | "CRAG";
  region: string | null;
};

type Attempt = {
  localId: string;
  discipline: ClimbingDiscipline;
  grade: string;
  outcome: ClimbOutcome;
  /** Climb / route / problem name. Server resolves against existing
   *  ClimbProblem rows at the picked location, creates a new one
   *  otherwise. */
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

function gradePlaceholder(d: ClimbingDiscipline): string {
  return d === "BOULDER" ? "V4" : "5.10a";
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
  const [attempts, setAttempts] = useState<Attempt[]>(() => [newAttempt()]);

  // Location state — three modes:
  //   • locationId set → user picked a recent location
  //   • newName set + locationId null → user typed a fresh location
  //   • both empty → no location attached (server allows null)
  const [recent, setRecent] = useState<RecentLocation[]>([]);
  const [locationId, setLocationId] = useState<string | null>(null);
  const [newName, setNewName] = useState("");
  const [newType, setNewType] = useState<"GYM" | "CRAG">("GYM");
  const [showNewLocation, setShowNewLocation] = useState(false);

  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  // Load the user's recent climb locations once on mount.
  useEffect(() => {
    let cancelled = false;
    listRecentClimbLocations()
      .then((rows) => {
        if (cancelled) return;
        setRecent(rows);
        // Auto-pick the most recent location if any — 95% of the
        // time it's the right answer and saves a tap.
        if (rows.length > 0) setLocationId(rows[0].id);
      })
      .catch(() => {
        /* non-fatal — picker just won't show recents */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Saved areas for the picked location — fed into the per-attempt
  // area picker as quick-tap chips. Re-fetches when locationId
  // changes (different gym → different areas).
  const [savedAreas, setSavedAreas] = useState<Array<{ id: string; name: string }>>([]);
  useEffect(() => {
    let cancelled = false;
    if (showNewLocation || !locationId) {
      setSavedAreas([]);
      return;
    }
    listAreasForClimbLocation(locationId)
      .then((rows) => {
        if (!cancelled) setSavedAreas(rows);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [locationId, showNewLocation]);

  function updateAttempt(localId: string, patch: Partial<Attempt>) {
    setAttempts((arr) =>
      arr.map((a) => {
        if (a.localId !== localId) return a;
        const merged = { ...a, ...patch };
        // When discipline changes, also flip the outcome to a valid
        // option for the new discipline (BOULDER's FLASH isn't valid
        // on SPORT_LEAD, etc.).
        if (patch.discipline && patch.discipline !== a.discipline) {
          merged.outcome = defaultOutcome(patch.discipline);
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
    if (showNewLocation && !newName.trim()) {
      setError("Name the new location, or pick one from the recent list.");
      return;
    }

    startTransition(async () => {
      try {
        await logClimbAction({
          performedAtIso: new Date(ms).toISOString(),
          durationMinutes: minutes,
          notes: notes.trim() || undefined,
          climbLocationId: showNewLocation ? undefined : locationId ?? undefined,
          newLocationName: showNewLocation ? newName.trim() : undefined,
          newLocationType: showNewLocation ? newType : undefined,
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
              name: a.name.trim() || undefined,
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
            {recent.length > 0 && !showNewLocation ? (
              <div style={chipRow}>
                {recent.map((loc) => {
                  const active = locationId === loc.id;
                  return (
                    <button
                      key={loc.id}
                      type="button"
                      style={active ? chipActive : chip}
                      onClick={() => setLocationId(loc.id)}
                    >
                      <span style={chipDot(loc.type === "GYM" ? "rgba(56,189,248,0.9)" : "rgba(132,204,22,0.9)")} />
                      {loc.name}
                    </button>
                  );
                })}
                <button
                  type="button"
                  style={chip}
                  onClick={() => {
                    setLocationId(null);
                    setShowNewLocation(true);
                  }}
                >
                  + New
                </button>
              </div>
            ) : null}
            {(showNewLocation || recent.length === 0) ? (
              <div style={newLocationRow}>
                <input
                  type="text"
                  placeholder="Location name (e.g. Movement Boulder)"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  style={{ ...fieldInput, flex: 1, minWidth: 0 }}
                />
                <div style={toggleRow}>
                  <button
                    type="button"
                    style={newType === "GYM" ? toggleActive : toggleInactive}
                    onClick={() => setNewType("GYM")}
                  >
                    Gym
                  </button>
                  <button
                    type="button"
                    style={newType === "CRAG" ? toggleActive : toggleInactive}
                    onClick={() => setNewType("CRAG")}
                  >
                    Crag
                  </button>
                </div>
                {recent.length > 0 ? (
                  <button
                    type="button"
                    style={cancelInlineBtn}
                    onClick={() => {
                      setShowNewLocation(false);
                      setNewName("");
                      setLocationId(recent[0].id);
                    }}
                  >
                    Cancel
                  </button>
                ) : null}
              </div>
            ) : null}
          </div>

          {/* Climbs list */}
          <div style={fieldGroup}>
            <span style={fieldGroupLabel}>Climbs</span>
            <div style={attemptStack}>
              {attempts.map((a, idx) => {
                const outcomes = OUTCOMES_BY_DISCIPLINE[a.discipline];
                const showTries = outcomeUsesTriesCount(a.outcome);
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
                      <span style={attemptIndex}>#{idx + 1}</span>
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
                      <input
                        type="text"
                        placeholder={gradePlaceholder(a.discipline)}
                        value={a.grade}
                        onChange={(e) => updateAttempt(a.localId, { grade: e.target.value })}
                        style={{ ...fieldInput, flex: "1 1 70px", minWidth: 0 }}
                        aria-label="Grade"
                      />
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
                        ClimbProblem / ClimbArea rows so a future "this
                        route again" picker can find them. */}
                    <div style={attemptRow}>
                      <input
                        type="text"
                        placeholder="Climb / route name (optional)"
                        value={a.name}
                        onChange={(e) => updateAttempt(a.localId, { name: e.target.value })}
                        style={{ ...fieldInput, flex: "2 1 160px", minWidth: 0 }}
                      />
                      <input
                        type="text"
                        placeholder="New area name"
                        value={a.area}
                        onChange={(e) =>
                          updateAttempt(a.localId, { area: e.target.value, areaId: "" })
                        }
                        disabled={Boolean(a.areaId)}
                        style={{
                          ...fieldInput,
                          flex: "1 1 110px",
                          minWidth: 0,
                          opacity: a.areaId ? 0.45 : 1,
                        }}
                      />
                    </div>

                    {/* Saved-area chips — only when the user picked
                        an existing location (not a fresh one). Tap a
                        chip to attribute to that area; tap again to
                        clear and free-type. */}
                    {savedAreas.length > 0 ? (
                      <div style={areaChipRow}>
                        <span style={areaChipRowLabel}>Areas:</span>
                        {savedAreas.map((area) => {
                          const isOn = a.areaId === area.id;
                          return (
                            <button
                              key={area.id}
                              type="button"
                              onClick={() =>
                                updateAttempt(a.localId, {
                                  areaId: isOn ? "" : area.id,
                                  area: isOn ? a.area : "",
                                })
                              }
                              style={isOn ? areaChipActive : areaChipInactive}
                            >
                              {area.name}
                            </button>
                          );
                        })}
                      </div>
                    ) : null}

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

const chipRow: CSSProperties = { display: "flex", gap: 6, flexWrap: "wrap" };
const chip: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
  padding: "6px 10px",
  borderRadius: 999,
  border: "1px solid rgba(255,255,255,0.12)",
  background: "rgba(255,255,255,0.04)",
  color: "inherit",
  fontSize: 12,
  fontWeight: 700,
  cursor: "pointer",
};
const chipActive: CSSProperties = {
  ...chip,
  borderColor: "rgba(51,255,122,0.45)",
  background: "rgba(51,255,122,0.10)",
  color: "rgba(51,255,122,0.95)",
};
function chipDot(bg: string): CSSProperties {
  return { width: 7, height: 7, borderRadius: 999, background: bg, flexShrink: 0 };
}

const newLocationRow: CSSProperties = { display: "flex", gap: 6, alignItems: "stretch", flexWrap: "wrap" };
const toggleRow: CSSProperties = { display: "flex", gap: 4 };
const toggleInactive: CSSProperties = {
  padding: "8px 12px",
  borderRadius: 9,
  border: "1px solid rgba(255,255,255,0.12)",
  background: "rgba(255,255,255,0.04)",
  color: "inherit",
  fontSize: 12,
  fontWeight: 800,
  cursor: "pointer",
};
const toggleActive: CSSProperties = {
  ...toggleInactive,
  borderColor: "rgba(51,255,122,0.45)",
  background: "rgba(51,255,122,0.10)",
  color: "rgba(51,255,122,0.95)",
};
const cancelInlineBtn: CSSProperties = {
  padding: "8px 12px",
  borderRadius: 9,
  border: "1px solid rgba(255,255,255,0.12)",
  background: "transparent",
  color: "inherit",
  fontSize: 12,
  fontWeight: 700,
  cursor: "pointer",
};

const attemptStack: CSSProperties = { display: "grid", gap: 8 };
const attemptCard: CSSProperties = {
  padding: "10px 12px",
  borderRadius: 10,
  border: "1px solid rgba(255,255,255,0.10)",
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

const areaChipRow: CSSProperties = {
  display: "flex",
  gap: 6,
  flexWrap: "wrap",
  alignItems: "center",
  marginTop: 6,
};

const areaChipRowLabel: CSSProperties = {
  fontSize: 9.5,
  fontWeight: 800,
  letterSpacing: 0.6,
  textTransform: "uppercase",
  opacity: 0.45,
  marginRight: 2,
};

const areaChipInactive: CSSProperties = {
  padding: "5px 10px",
  borderRadius: 999,
  border: "1px solid rgba(255,255,255,0.10)",
  background: "rgba(255,255,255,0.03)",
  color: "rgba(255,255,255,0.65)",
  fontSize: 11,
  fontWeight: 700,
  cursor: "pointer",
};

const areaChipActive: CSSProperties = {
  ...areaChipInactive,
  borderColor: "rgba(51,255,122,0.45)",
  background: "rgba(51,255,122,0.10)",
  color: "rgba(51,255,122,0.95)",
};

const outcomeChipRow: CSSProperties = {
  display: "flex",
  gap: 6,
  flexWrap: "wrap",
  marginTop: 8,
};

const outcomeChipInactive: CSSProperties = {
  padding: "6px 10px",
  borderRadius: 999,
  border: "1px solid rgba(255,255,255,0.10)",
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

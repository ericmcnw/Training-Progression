"use client";

import { useEffect, useMemo, useState, useTransition, type CSSProperties } from "react";
import { logGolfAction } from "@/app/log/golf-log-actions";
import { loadSportLogContext, type SportLogContext } from "@/app/log/sport-actions";
import SportLogModal from "./SportLogModal";
import SpotPicker from "@/app/components/log/SpotPicker";
import type { SpotPickerValue } from "@/lib/spot-picker-types";
import { inputStyle } from "@/app/routines/[id]/log/form-ui";
import { EffortSlider } from "@/app/components/strain/EffortSlider";
import { predictEffortDefault } from "@/lib/strain";

// Rich golf log sheet. Two modes — COURSE (per-hole detail) and
// RANGE (per-club shot detail) — sharing the same session header
// (when / duration / notes). Per-hole defaults to a 9- or 18-hole
// grid the user can edit row-by-row; per-club starts empty and
// accumulates as the user adds clubs hit.

type Mode = "COURSE" | "RANGE";

type Hole = {
  number: number;
  par: string; // string in state so empty inputs stay empty
  score: string;
  club: string;
  notes: string;
};

type Shot = {
  localId: string;
  club: string;
  distanceYards: string;
  ballCount: string;
  notes: string;
};

const DEFAULT_PAR_9 = [4, 4, 3, 5, 4, 3, 4, 5, 4];
const DEFAULT_PAR_18 = [4, 4, 3, 5, 4, 3, 4, 5, 4, 4, 4, 3, 5, 4, 3, 4, 5, 4];

function buildDefaultHoles(count: number): Hole[] {
  const defaults = count === 9 ? DEFAULT_PAR_9 : DEFAULT_PAR_18;
  return Array.from({ length: count }, (_, i) => ({
    number: i + 1,
    par: defaults[i]?.toString() ?? "",
    score: "",
    club: "",
    notes: "",
  }));
}

function newShot(): Shot {
  return {
    localId: Math.random().toString(36).slice(2),
    club: "",
    distanceYards: "",
    ballCount: "",
    notes: "",
  };
}

export default function GolfLogSheet({ onClose }: { onClose: () => void }) {
  const [mode, setMode] = useState<Mode>("COURSE");
  const [performedAt, setPerformedAt] = useState(() => formatLocalDateTime(new Date()));
  const [duration, setDuration] = useState("");
  const [sessionNotes, setSessionNotes] = useState("");
  const [effort, setEffort] = useState<number | null>(null);

  // COURSE mode state
  // Spot picker — replaces the prior free-text courseName field.
  // Ties golf logs into the same map/recents infrastructure other
  // sports use; same SpotPicker UX, "course" noun.
  const [spotValue, setSpotValue] = useState<SpotPickerValue>(null);
  const [spotCtx, setSpotCtx] = useState<SportLogContext | null>(null);
  useEffect(() => {
    let cancelled = false;
    loadSportLogContext("golf")
      .then((ctx) => {
        if (!cancelled) setSpotCtx(ctx);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);
  const [holeCount, setHoleCount] = useState<9 | 18>(18);
  const [holes, setHoles] = useState<Hole[]>(() => buildDefaultHoles(18));
  const [showHoleDetail, setShowHoleDetail] = useState(false);

  // RANGE mode state
  const [ballCount, setBallCount] = useState("");
  const [shots, setShots] = useState<Shot[]>(() => [newShot()]);

  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const totals = useMemo(() => {
    const totalPar = holes.reduce((sum, h) => sum + (Number(h.par) || 0), 0);
    const totalScore = holes.reduce((sum, h) => sum + (Number(h.score) || 0), 0);
    return { totalPar, totalScore, diff: totalScore - totalPar };
  }, [holes]);

  function setHoleField(idx: number, patch: Partial<Hole>) {
    setHoles((arr) => arr.map((h, i) => (i === idx ? { ...h, ...patch } : h)));
  }

  function changeHoleCount(next: 9 | 18) {
    setHoleCount(next);
    setHoles(buildDefaultHoles(next));
  }

  function updateShot(localId: string, patch: Partial<Shot>) {
    setShots((arr) => arr.map((s) => (s.localId === localId ? { ...s, ...patch } : s)));
  }
  function removeShot(localId: string) {
    setShots((arr) => (arr.length === 1 ? arr : arr.filter((s) => s.localId !== localId)));
  }
  function addShot() {
    setShots((arr) => [...arr, newShot()]);
  }

  function submit() {
    setError(null);
    const ms = Date.parse(performedAt);
    if (Number.isNaN(ms)) {
      setError("Invalid date/time.");
      return;
    }
    const minutes = duration.trim() === "" ? undefined : Number(duration);
    if (minutes !== undefined && (Number.isNaN(minutes) || minutes < 0)) {
      setError("Duration must be a positive number.");
      return;
    }

    if (mode === "COURSE") {
      const anyScored = holes.some((h) => h.score.trim() !== "" || h.par.trim() !== "");
      if (!anyScored) {
        setError("Enter at least one hole's par or score.");
        return;
      }
    } else {
      const validShots = shots.filter((s) => s.club.trim().length > 0);
      if (validShots.length === 0) {
        setError("Add at least one club + distance.");
        return;
      }
    }

    startTransition(async () => {
      try {
        if (mode === "COURSE") {
          await logGolfAction({
            mode: "COURSE",
            performedAtIso: new Date(ms).toISOString(),
            durationMinutes: minutes,
            notes: sessionNotes.trim() || undefined,
            spotValue,
            effort,
            holes: holes.map((h) => ({
              number: h.number,
              par: h.par.trim() === "" ? undefined : Number(h.par),
              score: h.score.trim() === "" ? undefined : Number(h.score),
              club: h.club.trim() || undefined,
              notes: h.notes.trim() || undefined,
            })),
          });
        } else {
          const validShots = shots.filter((s) => s.club.trim().length > 0);
          await logGolfAction({
            mode: "RANGE",
            performedAtIso: new Date(ms).toISOString(),
            durationMinutes: minutes,
            notes: sessionNotes.trim() || undefined,
            spotValue,
            effort,
            ballCount: ballCount.trim() === "" ? undefined : Number(ballCount),
            shots: validShots.map((s) => ({
              club: s.club.trim(),
              distanceYards: s.distanceYards.trim() === "" ? undefined : Number(s.distanceYards),
              ballCount: s.ballCount.trim() === "" ? undefined : Number(s.ballCount),
              notes: s.notes.trim() || undefined,
            })),
          });
        }
        onClose();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to save golf log.");
      }
    });
  }

  return (
    <SportLogModal
      title="Log Golf"
      onClose={onClose}
      footer={
        <>
          <button type="button" onClick={onClose} style={btnSecondary} disabled={pending}>
            Cancel
          </button>
          <button type="button" onClick={submit} style={btnPrimary} disabled={pending}>
            {pending ? "Saving…" : "Save round"}
          </button>
        </>
      }
    >
      <>
          {/* Mode toggle */}
          <div style={modeRow}>
            <button
              type="button"
              style={mode === "COURSE" ? modeActive : modeInactive}
              onClick={() => setMode("COURSE")}
            >
              Course
            </button>
            <button
              type="button"
              style={mode === "RANGE" ? modeActive : modeInactive}
              onClick={() => setMode("RANGE")}
            >
              Range
            </button>
          </div>

          <label style={fieldLabel}>
            When
            <input
              type="datetime-local"
              value={performedAt}
              onChange={(e) => setPerformedAt(e.target.value)}
              style={fieldInput}
            />
          </label>

          {/* Spot picker — applies to both COURSE and RANGE modes;
              just a different noun ("course" / "range"). Same map +
              recent-list infrastructure other sports use. */}
          {spotCtx?.config ? (
            <div style={fieldGroup}>
              <span style={fieldGroupLabel}>{mode === "COURSE" ? "Course" : "Range"}</span>
              <SpotPicker
                config={spotCtx.config}
                spotNoun={mode === "COURSE" ? "course" : "range"}
                savedSpots={spotCtx.savedSpots}
                recentSpots={spotCtx.recentSpots}
                value={spotValue}
                onChange={setSpotValue}
              />
            </div>
          ) : null}

          {mode === "COURSE" ? (
            <>

              <div style={fieldGroup}>
                <span style={fieldGroupLabel}>Holes played</span>
                <div style={modeRow}>
                  <button
                    type="button"
                    style={holeCount === 9 ? modeActive : modeInactive}
                    onClick={() => changeHoleCount(9)}
                  >
                    Front 9
                  </button>
                  <button
                    type="button"
                    style={holeCount === 18 ? modeActive : modeInactive}
                    onClick={() => changeHoleCount(18)}
                  >
                    Full 18
                  </button>
                </div>
              </div>

              <div style={totalsRow}>
                <Stat label="Par" value={totals.totalPar || "—"} />
                <Stat label="Score" value={totals.totalScore || "—"} />
                <Stat
                  label="vs Par"
                  value={
                    totals.totalScore && totals.totalPar
                      ? (totals.diff > 0 ? `+${totals.diff}` : totals.diff === 0 ? "E" : `${totals.diff}`)
                      : "—"
                  }
                  accent={
                    totals.totalScore && totals.totalPar
                      ? totals.diff > 0
                        ? "rgba(248,113,113,0.95)"
                        : "rgba(51,255,122,0.95)"
                      : undefined
                  }
                />
              </div>

              {/* Hole grid */}
              <div style={fieldGroup}>
                <div style={holesHeaderRow}>
                  <span style={holesHeaderCell}>Hole</span>
                  <span style={holesHeaderCell}>Par</span>
                  <span style={holesHeaderCell}>You</span>
                </div>
                {holes.map((h, idx) => (
                  <HoleRow
                    key={h.number}
                    hole={h}
                    showDetail={showHoleDetail}
                    onChange={(patch) => setHoleField(idx, patch)}
                  />
                ))}
                <button
                  type="button"
                  style={detailToggle}
                  onClick={() => setShowHoleDetail((v) => !v)}
                >
                  {showHoleDetail ? "− Hide club + notes" : "+ Add club / notes per hole"}
                </button>
              </div>
            </>
          ) : (
            <>
              <label style={fieldLabel}>
                Total balls hit (optional)
                <input
                  type="number"
                  inputMode="numeric"
                  placeholder="e.g. 60"
                  value={ballCount}
                  onChange={(e) => setBallCount(e.target.value)}
                  style={fieldInput}
                />
              </label>

              <div style={fieldGroup}>
                <span style={fieldGroupLabel}>Clubs hit</span>
                <div style={{ display: "grid", gap: 8 }}>
                  {shots.map((s, idx) => (
                    <div key={s.localId} style={attemptCard}>
                      <div style={attemptHeader}>
                        <span style={attemptIndex}>#{idx + 1}</span>
                        {shots.length > 1 ? (
                          <button
                            type="button"
                            style={removeAttemptBtn}
                            onClick={() => removeShot(s.localId)}
                            aria-label={`Remove club ${idx + 1}`}
                          >
                            ✕
                          </button>
                        ) : null}
                      </div>
                      <div style={attemptRow}>
                        <input
                          type="text"
                          placeholder="Club (e.g. 7i)"
                          value={s.club}
                          onChange={(e) => updateShot(s.localId, { club: e.target.value })}
                          style={{ ...fieldInput, flex: "1 1 100px", minWidth: 0 }}
                        />
                        <input
                          type="number"
                          inputMode="numeric"
                          placeholder="Yards"
                          value={s.distanceYards}
                          onChange={(e) => updateShot(s.localId, { distanceYards: e.target.value })}
                          style={{ ...fieldInput, flex: "1 1 80px", minWidth: 0 }}
                        />
                        <input
                          type="number"
                          inputMode="numeric"
                          placeholder="# balls"
                          value={s.ballCount}
                          onChange={(e) => updateShot(s.localId, { ballCount: e.target.value })}
                          style={{ ...fieldInput, flex: "1 1 80px", minWidth: 0 }}
                        />
                      </div>
                      <input
                        type="text"
                        placeholder="Notes (optional)"
                        value={s.notes}
                        onChange={(e) => updateShot(s.localId, { notes: e.target.value })}
                        style={{ ...fieldInput, width: "100%", marginTop: 6 }}
                      />
                    </div>
                  ))}
                  <button type="button" style={addAttemptBtn} onClick={addShot}>
                    + Add club
                  </button>
                </div>
              </div>
            </>
          )}

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
              predicted={predictEffortDefault(Number(duration) > 0 ? Number(duration) : null)}
              onChange={setEffort}
            />
          </div>

          <label style={fieldLabel}>
            Session notes
            <textarea
              placeholder="How'd it go?"
              value={sessionNotes}
              onChange={(e) => setSessionNotes(e.target.value)}
              style={{ ...inputStyle, minHeight: 96, resize: "vertical" as const }}
            />
          </label>

          {error ? <div style={errorText}>{error}</div> : null}
      </>
    </SportLogModal>
  );
}

function HoleRow({
  hole,
  showDetail,
  onChange,
}: {
  hole: Hole;
  showDetail: boolean;
  onChange: (patch: Partial<Hole>) => void;
}) {
  return (
    <div style={{ display: "grid", gap: 4 }}>
      <div style={holesRow}>
        <span style={holesNumCell}>{hole.number}</span>
        <input
          type="number"
          inputMode="numeric"
          value={hole.par}
          onChange={(e) => onChange({ par: e.target.value })}
          style={holesInput}
        />
        <input
          type="number"
          inputMode="numeric"
          value={hole.score}
          onChange={(e) => onChange({ score: e.target.value })}
          style={holesInput}
        />
      </div>
      {showDetail ? (
        <div style={holesDetailRow}>
          <input
            type="text"
            placeholder="Club"
            value={hole.club}
            onChange={(e) => onChange({ club: e.target.value })}
            style={{ ...fieldInput, flex: 1, minWidth: 0 }}
          />
          <input
            type="text"
            placeholder="Notes"
            value={hole.notes}
            onChange={(e) => onChange({ notes: e.target.value })}
            style={{ ...fieldInput, flex: 2, minWidth: 0 }}
          />
        </div>
      ) : null}
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: string | number; accent?: string }) {
  return (
    <div style={statCell}>
      <span style={statLabel}>{label}</span>
      <span style={{ ...statValue, color: accent ?? statValue.color }}>{value}</span>
    </div>
  );
}

function formatLocalDateTime(d: Date): string {
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

// ─── Styles ─────────────────────────────────────────────────────────────────

const modeRow: CSSProperties = { display: "flex", gap: 6 };
const modeInactive: CSSProperties = {
  flex: "1 1 0",
  padding: "10px 12px",
  borderRadius: 10,
  border: "1px solid rgba(255,255,255,0.12)",
  background: "rgba(255,255,255,0.04)",
  color: "inherit",
  fontSize: 13,
  fontWeight: 800,
  cursor: "pointer",
};
const modeActive: CSSProperties = {
  ...modeInactive,
  borderColor: "rgba(40,212,160,0.5)",
  background: "rgba(40,212,160,0.12)",
  color: "rgba(140,232,200,0.95)",
};

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

const totalsRow: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(3, 1fr)",
  gap: 6,
  padding: 10,
  borderRadius: 10,
  border: "1px solid rgba(40,212,160,0.18)",
  background: "rgba(40,212,160,0.05)",
};
const statCell: CSSProperties = { display: "grid", gap: 2, textAlign: "center" };
const statLabel: CSSProperties = {
  fontSize: 9.5,
  fontWeight: 900,
  letterSpacing: 0.6,
  textTransform: "uppercase",
  opacity: 0.55,
};
const statValue: CSSProperties = {
  fontSize: 18,
  fontWeight: 900,
  color: "rgba(255,255,255,0.95)",
  fontVariantNumeric: "tabular-nums",
};

const holesHeaderRow: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "44px 1fr 1fr",
  gap: 6,
  paddingBottom: 4,
};
const holesHeaderCell: CSSProperties = {
  fontSize: 9.5,
  fontWeight: 900,
  letterSpacing: 0.6,
  textTransform: "uppercase",
  opacity: 0.55,
  textAlign: "center",
};
const holesRow: CSSProperties = { display: "grid", gridTemplateColumns: "44px 1fr 1fr", gap: 6 };
const holesNumCell: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  fontSize: 13,
  fontWeight: 900,
  opacity: 0.7,
};
const holesInput: CSSProperties = {
  ...inputStyle,
  padding: "10px 8px",
  borderRadius: 8,
  fontWeight: 700,
  textAlign: "center",
  fontVariantNumeric: "tabular-nums",
};
const holesDetailRow: CSSProperties = {
  display: "flex",
  gap: 6,
  paddingLeft: 50,
  paddingBottom: 4,
};

const detailToggle: CSSProperties = {
  marginTop: 4,
  padding: "8px 10px",
  borderRadius: 9,
  border: "1px dashed rgba(255,255,255,0.16)",
  background: "transparent",
  color: "inherit",
  fontSize: 11,
  fontWeight: 800,
  cursor: "pointer",
  textAlign: "center",
};

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
const attemptRow: CSSProperties = { display: "flex", gap: 6, flexWrap: "wrap" };
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

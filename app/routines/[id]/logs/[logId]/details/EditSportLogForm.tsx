"use client";

// Edit-side dispatch for sport-shaped session logs. Climbing keeps
// using EditSessionLogForm (ClimbAttempt-heavy); everything else
// (golf, basketball, surfing, snow, etc.) routes through here.
//
// Two render shapes:
//   - Golf — full course/range scorecard editor with running totals
//   - Other sports — date / spot / duration / sessionType dropdown /
//     extras grid / notes (mirrors the create-time generic LogSheet)
//
// Both reuse the same form-ui inputStyle / textareaStyle as endurance
// (16px font, matching modal chrome) so editing reads identical to
// creating.

import { useMemo, useState, useTransition, type CSSProperties } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import SpotPicker from "@/app/components/log/SpotPicker";
import type { SpotPickerValue } from "@/lib/spot-picker-types";
import type { SpotPickerItem } from "@/lib/activity-spots";
import { getActivitySpotConfig } from "@/lib/activity-spots";
import { inputStyle, textareaStyle } from "@/app/routines/[id]/log/form-ui";
import { updateSportLogAction } from "@/app/log/sport-actions";
import { updateGolfLogAction } from "@/app/log/golf-log-actions";
import { getSportLogConfig } from "@/app/routines/sportLogConfig";

type CommonProps = {
  routineId: string;
  logId: string;
  sportSlug: string;
  initialPerformedAt: Date;
  initialDurationSec: number;
  initialNotes: string;
  initialSpot: SpotPickerValue;
  savedSpots: SpotPickerItem[];
  activitySlug: string | null;
  /** Raw RoutineLog.sportData — parsed per-sport. */
  sportData: unknown;
  returnTo: string;
  /** Drawer-mounted callers override navigation: onComplete closes
   *  the drawer + refreshes the dashboard instead of routing to
   *  returnTo. Page-mounted callers leave both undefined and get
   *  the default router.push(returnTo). */
  onComplete?: () => void;
  onCancel?: () => void;
};

export default function EditSportLogForm(props: CommonProps) {
  if (props.sportSlug === "golf") {
    return <EditGolfLog {...props} />;
  }
  return <EditGenericSport {...props} />;
}

// ─── Golf ────────────────────────────────────────────────────────────────────

type GolfMode = "COURSE" | "RANGE";

type EditGolfHole = {
  number: number;
  par: string;
  score: string;
  club: string;
  notes: string;
};
type EditGolfShot = {
  localId: string;
  club: string;
  distanceYards: string;
  ballCount: string;
  notes: string;
};

function parseGolfSportData(
  raw: unknown
): { mode: GolfMode; holes: EditGolfHole[]; shots: EditGolfShot[]; ballCount: string } {
  const empty = { mode: "COURSE" as GolfMode, holes: defaultHoles(18), shots: [emptyShot()], ballCount: "" };
  if (!raw || typeof raw !== "object") return empty;
  const obj = raw as Record<string, unknown>;
  if (obj.mode !== "COURSE" && obj.mode !== "RANGE") return empty;
  if (obj.mode === "COURSE") {
    const course = obj.course as Record<string, unknown> | undefined;
    const holes = Array.isArray(course?.holes) ? (course!.holes as Array<Record<string, unknown>>) : [];
    const expanded: EditGolfHole[] = (holes.length === 9 || holes.length === 18 ? holes : defaultHoles(18).slice(0, Math.max(9, holes.length || 18))).map(
      (h, idx) => ({
        number: typeof h.number === "number" ? h.number : idx + 1,
        par: typeof h.par === "number" ? String(h.par) : "",
        score: typeof h.score === "number" ? String(h.score) : "",
        club: typeof h.club === "string" ? h.club : "",
        notes: typeof h.notes === "string" ? h.notes : "",
      })
    );
    return { mode: "COURSE", holes: expanded, shots: [emptyShot()], ballCount: "" };
  }
  const range = obj.range as Record<string, unknown> | undefined;
  const shotRows = Array.isArray(range?.shots) ? (range!.shots as Array<Record<string, unknown>>) : [];
  const shots: EditGolfShot[] = shotRows.map((s, idx) => ({
    localId: `loaded-${idx}`,
    club: typeof s.club === "string" ? s.club : "",
    distanceYards: typeof s.distanceYards === "number" ? String(s.distanceYards) : "",
    ballCount: typeof s.ballCount === "number" ? String(s.ballCount) : "",
    notes: typeof s.notes === "string" ? s.notes : "",
  }));
  return {
    mode: "RANGE",
    holes: defaultHoles(18),
    shots: shots.length > 0 ? shots : [emptyShot()],
    ballCount: typeof range?.ballCount === "number" ? String(range!.ballCount) : "",
  };
}

function defaultHoles(count: 9 | 18): EditGolfHole[] {
  const pars =
    count === 9
      ? [4, 4, 3, 5, 4, 3, 4, 5, 4]
      : [4, 4, 3, 5, 4, 3, 4, 5, 4, 4, 4, 3, 5, 4, 3, 4, 5, 4];
  return Array.from({ length: count }, (_, i) => ({
    number: i + 1,
    par: String(pars[i]),
    score: "",
    club: "",
    notes: "",
  }));
}

function emptyShot(): EditGolfShot {
  return { localId: Math.random().toString(36).slice(2), club: "", distanceYards: "", ballCount: "", notes: "" };
}

function EditGolfLog({
  logId,
  initialPerformedAt,
  initialDurationSec,
  initialNotes,
  initialSpot,
  savedSpots,
  sportData,
  returnTo,
  onComplete,
  onCancel,
}: CommonProps) {
  const router = useRouter();
  const parsed = useMemo(() => parseGolfSportData(sportData), [sportData]);
  const [performedAt, setPerformedAt] = useState(formatLocal(initialPerformedAt));
  const [duration, setDuration] = useState(initialDurationSec > 0 ? String(Math.round(initialDurationSec / 60)) : "");
  const [notes, setNotes] = useState(initialNotes);
  const [spot, setSpot] = useState<SpotPickerValue>(initialSpot);
  const [mode, setMode] = useState<GolfMode>(parsed.mode);
  const [holes, setHoles] = useState<EditGolfHole[]>(parsed.holes);
  const [shots, setShots] = useState<EditGolfShot[]>(parsed.shots);
  const [ballCount, setBallCount] = useState(parsed.ballCount);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const spotConfig = getActivitySpotConfig("golf");
  const totals = useMemo(() => {
    const totalPar = holes.reduce((sum, h) => sum + (Number(h.par) || 0), 0);
    const totalScore = holes.reduce((sum, h) => sum + (Number(h.score) || 0), 0);
    return { totalPar, totalScore, diff: totalScore - totalPar };
  }, [holes]);

  function save() {
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
    startTransition(async () => {
      try {
        if (mode === "COURSE") {
          await updateGolfLogAction({
            logId,
            mode: "COURSE",
            performedAtIso: new Date(ms).toISOString(),
            durationMinutes: minutes,
            notes: notes.trim() || undefined,
            spotValue: spot,
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
          await updateGolfLogAction({
            logId,
            mode: "RANGE",
            performedAtIso: new Date(ms).toISOString(),
            durationMinutes: minutes,
            notes: notes.trim() || undefined,
            spotValue: spot,
            ballCount: ballCount.trim() === "" ? undefined : Number(ballCount),
            shots: validShots.map((s) => ({
              club: s.club.trim(),
              distanceYards: s.distanceYards.trim() === "" ? undefined : Number(s.distanceYards),
              ballCount: s.ballCount.trim() === "" ? undefined : Number(s.ballCount),
              notes: s.notes.trim() || undefined,
            })),
          });
        }
        if (onComplete) {
          onComplete();
        } else {
          router.push(returnTo);
          router.refresh();
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to save changes.");
      }
    });
  }

  return (
    <form style={form} onSubmit={(e) => { e.preventDefault(); save(); }}>
      <Field label="When">
        <input
          type="datetime-local"
          value={performedAt}
          onChange={(e) => setPerformedAt(e.target.value)}
          style={inputStyle}
        />
      </Field>

      <div style={modeRow}>
        <button
          type="button"
          style={mode === "COURSE" ? modeBtnActive : modeBtnInactive}
          onClick={() => setMode("COURSE")}
        >
          Course
        </button>
        <button
          type="button"
          style={mode === "RANGE" ? modeBtnActive : modeBtnInactive}
          onClick={() => setMode("RANGE")}
        >
          Range
        </button>
      </div>

      {spotConfig ? (
        <Field label={mode === "COURSE" ? "Course" : "Range"}>
          <SpotPicker
            config={spotConfig}
            spotNoun={mode === "COURSE" ? "course" : "range"}
            savedSpots={savedSpots}
            value={spot}
            onChange={setSpot}
          />
        </Field>
      ) : null}

      {mode === "COURSE" ? (
        <>
          <div style={totalsRow}>
            <Stat label="Par" value={totals.totalPar || "—"} />
            <Stat label="Score" value={totals.totalScore || "—"} />
            <Stat
              label="vs Par"
              value={
                totals.totalScore && totals.totalPar
                  ? totals.diff > 0 ? `+${totals.diff}` : totals.diff === 0 ? "E" : `${totals.diff}`
                  : "—"
              }
              accent={
                totals.totalScore && totals.totalPar
                  ? totals.diff > 0 ? "rgba(248,113,113,0.95)" : "rgba(51,255,122,0.95)"
                  : undefined
              }
            />
          </div>
          <div style={fieldGroup}>
            <div style={holesHeaderRow}>
              <span style={holesHeaderCell}>Hole</span>
              <span style={holesHeaderCell}>Par</span>
              <span style={holesHeaderCell}>You</span>
            </div>
            {holes.map((h, idx) => (
              <div key={h.number} style={holesRow}>
                <span style={holesNumCell}>{h.number}</span>
                <input
                  type="number"
                  inputMode="numeric"
                  value={h.par}
                  onChange={(e) => {
                    const v = e.target.value;
                    setHoles((arr) => arr.map((row, i) => i === idx ? { ...row, par: v } : row));
                  }}
                  style={holesInput}
                />
                <input
                  type="number"
                  inputMode="numeric"
                  value={h.score}
                  onChange={(e) => {
                    const v = e.target.value;
                    setHoles((arr) => arr.map((row, i) => i === idx ? { ...row, score: v } : row));
                  }}
                  style={holesInput}
                />
              </div>
            ))}
          </div>
        </>
      ) : (
        <>
          <Field label="Total balls hit (optional)">
            <input
              type="number"
              inputMode="numeric"
              value={ballCount}
              onChange={(e) => setBallCount(e.target.value)}
              style={inputStyle}
            />
          </Field>
          <div style={fieldGroup}>
            <div style={fieldLabel}>Clubs hit</div>
            <div style={{ display: "grid", gap: 8 }}>
              {shots.map((s, idx) => (
                <div key={s.localId} style={attemptCard}>
                  <div style={attemptRow}>
                    <input
                      type="text"
                      placeholder="Club"
                      value={s.club}
                      onChange={(e) => {
                        const v = e.target.value;
                        setShots((arr) => arr.map((row, i) => i === idx ? { ...row, club: v } : row));
                      }}
                      style={{ ...inputStyle, flex: "1 1 100px", minWidth: 0 }}
                    />
                    <input
                      type="number"
                      inputMode="numeric"
                      placeholder="Yards"
                      value={s.distanceYards}
                      onChange={(e) => {
                        const v = e.target.value;
                        setShots((arr) => arr.map((row, i) => i === idx ? { ...row, distanceYards: v } : row));
                      }}
                      style={{ ...inputStyle, flex: "1 1 80px", minWidth: 0 }}
                    />
                    <input
                      type="number"
                      inputMode="numeric"
                      placeholder="# balls"
                      value={s.ballCount}
                      onChange={(e) => {
                        const v = e.target.value;
                        setShots((arr) => arr.map((row, i) => i === idx ? { ...row, ballCount: v } : row));
                      }}
                      style={{ ...inputStyle, flex: "1 1 80px", minWidth: 0 }}
                    />
                  </div>
                </div>
              ))}
              <button
                type="button"
                onClick={() => setShots((arr) => [...arr, emptyShot()])}
                style={addRowBtn}
              >
                + Add club
              </button>
            </div>
          </div>
        </>
      )}

      <Field label="Duration (min)">
        <input
          type="number"
          inputMode="numeric"
          value={duration}
          onChange={(e) => setDuration(e.target.value)}
          style={inputStyle}
        />
      </Field>

      <Field label="Notes">
        <textarea value={notes} onChange={(e) => setNotes(e.target.value)} style={textareaStyle} />
      </Field>

      {error ? <div style={errorStyle}>{error}</div> : null}
      <div style={actions}>
        <button type="submit" disabled={pending} style={primaryBtn}>
          {pending ? "Saving…" : "Save changes"}
        </button>
        {onCancel ? (
          <button type="button" onClick={onCancel} style={secondaryBtn}>Cancel</button>
        ) : (
          <Link href={returnTo} style={secondaryBtn}>Cancel</Link>
        )}
      </div>
    </form>
  );
}

// ─── Generic sport (basketball, surfing, snow, etc.) ─────────────────────

type GenericSportExtras = Record<string, string>;

function parseGenericSportData(raw: unknown): { sessionType: string; extras: GenericSportExtras } {
  if (!raw || typeof raw !== "object") return { sessionType: "", extras: {} };
  const obj = raw as Record<string, unknown>;
  const sessionType = typeof obj.sessionType === "string" ? obj.sessionType : "";
  const extrasRaw = obj.extras as Record<string, unknown> | undefined;
  const extras: GenericSportExtras = {};
  if (extrasRaw && typeof extrasRaw === "object") {
    for (const [k, v] of Object.entries(extrasRaw)) {
      if (typeof v === "string" || typeof v === "number") extras[k] = String(v);
    }
  }
  return { sessionType, extras };
}

function EditGenericSport({
  logId,
  sportSlug,
  initialPerformedAt,
  initialDurationSec,
  initialNotes,
  initialSpot,
  savedSpots,
  sportData,
  returnTo,
  onComplete,
  onCancel,
}: CommonProps) {
  const router = useRouter();
  const parsed = useMemo(() => parseGenericSportData(sportData), [sportData]);
  const config = getSportLogConfig(sportSlug);
  const spotConfig = getActivitySpotConfig(sportSlug);

  const [performedAt, setPerformedAt] = useState(formatLocal(initialPerformedAt));
  const [duration, setDuration] = useState(initialDurationSec > 0 ? String(Math.round(initialDurationSec / 60)) : "");
  const [notes, setNotes] = useState(initialNotes);
  const [spot, setSpot] = useState<SpotPickerValue>(initialSpot);
  const [sessionType, setSessionType] = useState(parsed.sessionType);
  const [extras, setExtras] = useState<GenericSportExtras>(parsed.extras);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function save() {
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
    const extrasOut: Record<string, string | number | undefined> = {};
    for (const f of config.extras ?? []) {
      const raw = (extras[f.key] ?? "").trim();
      if (raw === "") continue;
      extrasOut[f.key] = f.type === "number" ? Number(raw) : raw;
    }
    startTransition(async () => {
      try {
        await updateSportLogAction({
          logId,
          sportSlug,
          performedAtIso: new Date(ms).toISOString(),
          durationMinutes: minutes,
          notes: notes.trim() || undefined,
          spotValue: spot,
          sessionType: sessionType.trim() || undefined,
          extras: extrasOut,
        });
        if (onComplete) {
          onComplete();
        } else {
          router.push(returnTo);
          router.refresh();
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to save changes.");
      }
    });
  }

  return (
    <form style={form} onSubmit={(e) => { e.preventDefault(); save(); }}>
      <Field label="When">
        <input
          type="datetime-local"
          value={performedAt}
          onChange={(e) => setPerformedAt(e.target.value)}
          style={inputStyle}
        />
      </Field>

      {config.sessionTypeOptions && config.sessionTypeOptions.length > 0 ? (
        <Field label={config.sessionTypeLabel ?? "Type"}>
          <select
            value={sessionType}
            onChange={(e) => setSessionType(e.target.value)}
            style={inputStyle}
          >
            <option value="">— select —</option>
            {config.sessionTypeOptions.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </Field>
      ) : null}

      {spotConfig ? (
        <Field label="Where">
          <SpotPicker
            config={spotConfig}
            spotNoun={spotConfig.spotNoun}
            savedSpots={savedSpots}
            value={spot}
            onChange={setSpot}
          />
        </Field>
      ) : null}

      <Field label="Duration (min)">
        <input
          type="number"
          inputMode="numeric"
          value={duration}
          onChange={(e) => setDuration(e.target.value)}
          style={inputStyle}
        />
      </Field>

      {config.extras && config.extras.length > 0 ? (
        <div style={extrasGrid}>
          {config.extras.map((f) => (
            <Field key={f.key} label={f.label}>
              {f.type === "textarea" ? (
                <textarea
                  value={extras[f.key] ?? ""}
                  onChange={(e) => setExtras((prev) => ({ ...prev, [f.key]: e.target.value }))}
                  style={{ ...textareaStyle, minHeight: 70 }}
                />
              ) : (
                <input
                  type={f.type === "number" ? "number" : "text"}
                  inputMode={f.type === "number" ? (f.numericHint === "decimal" ? "decimal" : "numeric") : undefined}
                  placeholder={f.placeholder}
                  value={extras[f.key] ?? ""}
                  onChange={(e) => setExtras((prev) => ({ ...prev, [f.key]: e.target.value }))}
                  style={inputStyle}
                />
              )}
            </Field>
          ))}
        </div>
      ) : null}

      <Field label="Notes">
        <textarea value={notes} onChange={(e) => setNotes(e.target.value)} style={textareaStyle} />
      </Field>

      {error ? <div style={errorStyle}>{error}</div> : null}
      <div style={actions}>
        <button type="submit" disabled={pending} style={primaryBtn}>
          {pending ? "Saving…" : "Save changes"}
        </button>
        {onCancel ? (
          <button type="button" onClick={onCancel} style={secondaryBtn}>Cancel</button>
        ) : (
          <Link href={returnTo} style={secondaryBtn}>Cancel</Link>
        )}
      </div>
    </form>
  );
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatLocal(d: Date): string {
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label style={fieldLabel}>
      {label}
      {children}
    </label>
  );
}

function Stat({ label, value, accent }: { label: string; value: string | number; accent?: string }) {
  return (
    <div style={statCell}>
      <span style={statLabelStyle}>{label}</span>
      <span style={{ ...statValueStyle, color: accent ?? statValueStyle.color }}>{value}</span>
    </div>
  );
}

// ─── Styles ─────────────────────────────────────────────────────────────────

const form: CSSProperties = { display: "grid", gap: 16 };
const fieldLabel: CSSProperties = { display: "grid", gap: 8, fontWeight: 900 };
const fieldGroup: CSSProperties = { display: "grid", gap: 6 };

const modeRow: CSSProperties = { display: "flex", gap: 6 };
const modeBtnInactive: CSSProperties = {
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
const modeBtnActive: CSSProperties = {
  ...modeBtnInactive,
  borderColor: "rgba(40,212,160,0.5)",
  background: "rgba(40,212,160,0.12)",
  color: "rgba(140,232,200,0.95)",
};

const totalsRow: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(3, 1fr)",
  gap: 8,
  padding: 10,
  borderRadius: 10,
  border: "1px solid rgba(40,212,160,0.18)",
  background: "rgba(40,212,160,0.05)",
};
const statCell: CSSProperties = { display: "grid", gap: 2, textAlign: "center" };
const statLabelStyle: CSSProperties = {
  fontSize: 9.5,
  fontWeight: 900,
  letterSpacing: 0.6,
  textTransform: "uppercase",
  opacity: 0.55,
};
const statValueStyle: CSSProperties = {
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

const attemptCard: CSSProperties = {
  padding: "10px 12px",
  borderRadius: 10,
  border: "1px solid rgba(255,255,255,0.10)",
  background: "rgba(255,255,255,0.025)",
};
const attemptRow: CSSProperties = { display: "flex", gap: 6, flexWrap: "wrap" };
const addRowBtn: CSSProperties = {
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

const extrasGrid: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
  gap: 12,
};

const actions: CSSProperties = { display: "flex", gap: 10, flexWrap: "wrap" };
const primaryBtn: CSSProperties = {
  padding: "12px 18px",
  borderRadius: 12,
  border: "1px solid rgba(51,255,122,0.45)",
  background: "rgba(51,255,122,0.10)",
  color: "rgba(51,255,122,0.95)",
  fontSize: 14,
  fontWeight: 900,
  cursor: "pointer",
};
const secondaryBtn: CSSProperties = {
  padding: "12px 18px",
  borderRadius: 12,
  border: "1px solid rgba(255,255,255,0.14)",
  background: "rgba(255,255,255,0.04)",
  color: "inherit",
  fontSize: 14,
  fontWeight: 800,
  textDecoration: "none",
  textAlign: "center",
};
const errorStyle: CSSProperties = {
  fontSize: 13,
  color: "rgba(248,113,113,0.95)",
  fontWeight: 700,
};

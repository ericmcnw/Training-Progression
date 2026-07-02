"use client";

// THROWAWAY PROTOTYPE — not wired to any action or DB. Sample data only.
// Purpose: feel the "type → unified grouped target → (metric) → amount" flow
// and see the decision count vs today's scope-indirection form. Delete the
// whole app/scratch/goal-picker folder once we've decided on the real design.

import { useMemo, useState } from "react";

type GoalType = "FREQUENCY" | "VOLUME" | "PERFORMANCE" | "COMPLETION";
type GroupKey = "domain" | "sport" | "activity" | "routine" | "exercise" | "grade" | "session";

type TargetItem = { id: string; label: string; sub?: string; accent?: string };
type Metric = { key: string; label: string; hint?: string };

const TYPE_META: Record<GoalType, { label: string; blurb: string }> = {
  FREQUENCY: { label: "Frequency", blurb: "How often you show up" },
  VOLUME: { label: "Volume", blurb: "Total output over time" },
  PERFORMANCE: { label: "Performance", blurb: "A personal best or benchmark" },
  COMPLETION: { label: "Completion", blurb: "Finish something N times" },
};

const GROUP_LABEL: Record<GroupKey, string> = {
  domain: "Training domains",
  sport: "Sports",
  activity: "Activities",
  routine: "Routines",
  exercise: "Exercises",
  grade: "Grades",
  session: "Session types",
};

// Which target groups are valid per goal type (faithful to the real
// METRICS_BY_COMBINATION matrix; "domain" is the new primitive).
const GROUPS_BY_TYPE: Record<GoalType, GroupKey[]> = {
  FREQUENCY: ["domain", "sport", "activity", "routine", "session"],
  VOLUME: ["routine", "exercise", "activity", "session"],
  PERFORMANCE: ["exercise", "activity", "grade", "routine", "session"],
  COMPLETION: ["domain", "routine", "activity"],
};

// Sample targets per group — representative sizes so search/scroll friction
// is honest (exercises list is intentionally long).
const SAMPLE: Record<GroupKey, TargetItem[]> = {
  domain: [
    { id: "d-strength", label: "Strength", accent: "rgba(129,140,248,0.9)" },
    { id: "d-endurance", label: "Endurance", accent: "rgba(56,189,248,0.9)" },
    { id: "d-mobility", label: "Mobility", accent: "rgba(192,132,252,0.9)" },
    { id: "d-sport", label: "Sport", accent: "rgba(251,191,36,0.9)" },
    { id: "d-lifestyle", label: "Lifestyle", accent: "rgba(84,203,130,0.9)" },
  ],
  sport: [
    { id: "s-climbing", label: "Climbing", accent: "rgba(251,146,60,0.9)" },
    { id: "s-golf", label: "Golf", accent: "rgba(84,203,130,0.9)" },
    { id: "s-basketball", label: "Basketball", accent: "rgba(248,113,113,0.9)" },
  ],
  activity: [
    { id: "a-running", label: "Running", sub: "family · any run type" },
    { id: "a-trailrun", label: "Trail Run", sub: "exact type" },
    { id: "a-cycling", label: "Cycling", sub: "family" },
    { id: "a-swimming", label: "Swimming", sub: "family" },
    { id: "a-rowing", label: "Rowing", sub: "family" },
    { id: "a-hiking", label: "Hiking", sub: "exact type" },
  ],
  routine: [
    { id: "r-push", label: "Push Day", sub: "Strength" },
    { id: "r-pull", label: "Pull Day", sub: "Strength" },
    { id: "r-legs", label: "Leg Day", sub: "Strength" },
    { id: "r-fingers", label: "Fingerboard", sub: "Strength · supports Climbing" },
    { id: "r-yoga", label: "Morning Yoga", sub: "Mobility" },
    { id: "r-hammy", label: "Hamstring PT", sub: "Mobility · Rehab" },
    { id: "r-water", label: "Drink 3L water", sub: "Lifestyle" },
    { id: "r-custom", label: "Custom group…", sub: "pick several routines" },
  ],
  exercise: [
    { id: "e-bench", label: "Bench Press" },
    { id: "e-squat", label: "Back Squat" },
    { id: "e-dead", label: "Deadlift" },
    { id: "e-ohp", label: "Overhead Press" },
    { id: "e-row", label: "Barbell Row" },
    { id: "e-pullup", label: "Pull-up" },
    { id: "e-dip", label: "Dip" },
    { id: "e-curl", label: "Barbell Curl" },
    { id: "e-hammy", label: "Hamstring Curl" },
    { id: "e-calf", label: "Calf Raise" },
    { id: "e-lunge", label: "Walking Lunge" },
    { id: "e-plank", label: "Plank" },
    { id: "e-rdl", label: "Romanian Deadlift" },
    { id: "e-hip", label: "Hip Thrust" },
    { id: "e-lat", label: "Lat Pulldown" },
    { id: "e-legpress", label: "Leg Press" },
    { id: "e-facepull", label: "Face Pull" },
    { id: "e-hang", label: "Dead Hang" },
  ],
  grade: [
    { id: "g-boulder", label: "Bouldering", sub: "V scale" },
    { id: "g-sport", label: "Sport Lead", sub: "YDS" },
    { id: "g-toprope", label: "Top Rope", sub: "YDS" },
  ],
  session: [
    { id: "t-climb", label: "Climbing Session", sub: "template" },
    { id: "t-basket", label: "Basketball Pickup", sub: "template" },
  ],
};

// Metric options per (type, group). Empty/one-item = auto-inferred (no step).
function metricsFor(type: GoalType, group: GroupKey): Metric[] {
  if (type === "FREQUENCY") return []; // always sessions
  if (type === "COMPLETION") return []; // always completed
  if (type === "VOLUME") {
    if (group === "routine")
      return [
        { key: "SETS", label: "Sets" },
        { key: "REPS", label: "Reps" },
        { key: "VOLUME", label: "Volume", hint: "sets × reps × weight" },
        { key: "DURATION", label: "Time" },
        { key: "DISTANCE", label: "Distance" },
      ];
    if (group === "exercise")
      return [
        { key: "SETS", label: "Sets" },
        { key: "REPS", label: "Reps" },
        { key: "VOLUME", label: "Volume" },
        { key: "DURATION", label: "Time" },
      ];
    if (group === "activity")
      return [
        { key: "DISTANCE", label: "Distance" },
        { key: "DURATION", label: "Time" },
        { key: "ELEVATION_GAIN", label: "Elevation" },
      ];
    if (group === "session")
      return [
        { key: "DURATION", label: "Time" },
        { key: "SESSION_METRIC", label: "Session metric" },
      ];
  }
  if (type === "PERFORMANCE") {
    if (group === "exercise")
      return [
        { key: "MAX_WEIGHT", label: "Top weight", hint: "optional 'for N reps' floor" },
        { key: "MAX_DURATION", label: "Best time" },
      ];
    if (group === "activity")
      return [
        { key: "PACE", label: "Pace", hint: "needs a benchmark distance" },
        { key: "DISTANCE", label: "Distance" },
        { key: "ELEVATION_GAIN", label: "Elevation" },
      ];
    if (group === "grade") return []; // single: the grade
    if (group === "routine")
      return [
        { key: "SESSION_METRIC", label: "Session metric" },
        { key: "DISTANCE", label: "Distance" },
      ];
    if (group === "session") return []; // session metric
  }
  return [];
}

export default function GoalPickerPrototype() {
  const [type, setType] = useState<GoalType | null>(null);
  const [target, setTarget] = useState<{ group: GroupKey; item: TargetItem } | null>(null);
  const [metric, setMetric] = useState<Metric | null>(null);
  const [query, setQuery] = useState("");
  const [amount, setAmount] = useState("3");
  const [unit, setUnit] = useState<"DAY" | "WEEK" | "MONTH" | "ONE_TIME">("WEEK");
  const [advancedOpen, setAdvancedOpen] = useState(false);

  const groups = type ? GROUPS_BY_TYPE[type] : [];
  const metricOptions = type && target ? metricsFor(type, target.group) : [];
  const needsMetric = metricOptions.length > 1;

  // Decision count: type + target + (metric?) + amount.
  const decisions = [type ? 1 : 0, target ? 1 : 0, needsMetric ? (metric ? 1 : 0) : 0, 1].reduce(
    (a, b) => a + b,
    0
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return groups.map((g) => ({
      group: g,
      items: SAMPLE[g].filter((it) => !q || it.label.toLowerCase().includes(q) || it.sub?.toLowerCase().includes(q)),
    }));
  }, [groups, query]);

  function reset() {
    setType(null);
    setTarget(null);
    setMetric(null);
    setQuery("");
  }

  const stage: "type" | "target" | "metric" | "amount" = !type
    ? "type"
    : !target
    ? "target"
    : needsMetric && !metric
    ? "metric"
    : "amount";

  const preview = buildPreview(type, target, metric, needsMetric, amount, unit);

  return (
    <div style={wrap}>
      <div style={banner}>⚗️ Prototype · not saved · sample data</div>

      <Breadcrumb type={type} target={target} metric={needsMetric ? metric : null} stage={stage} onReset={reset} />

      {stage === "type" && (
        <section style={card}>
          <div style={cardTitle}>What kind of goal?</div>
          <div style={tileGrid}>
            {(Object.keys(TYPE_META) as GoalType[]).map((t) => (
              <button key={t} type="button" style={tile} onClick={() => setType(t)}>
                <div style={tileLabel}>{TYPE_META[t].label}</div>
                <div style={tileBlurb}>{TYPE_META[t].blurb}</div>
              </button>
            ))}
          </div>
        </section>
      )}

      {stage === "target" && (
        <section style={card}>
          <div style={cardTitle}>What are you targeting?</div>
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search domains, sports, routines, exercises…"
            style={search}
          />
          <div style={{ display: "grid", gap: 16, marginTop: 12 }}>
            {filtered.map(({ group, items }) =>
              items.length === 0 ? null : (
                <div key={group}>
                  <div style={groupHeader}>{GROUP_LABEL[group]}</div>
                  <div style={group === "domain" || group === "sport" || group === "grade" ? chipRow : itemList}>
                    {items.map((it) => {
                      const chip = group === "domain" || group === "sport" || group === "grade";
                      return (
                        <button
                          key={it.id}
                          type="button"
                          onClick={() => {
                            setTarget({ group, item: it });
                            setMetric(null);
                          }}
                          style={chip ? { ...chipBtn, borderColor: it.accent ?? chipBtn.borderColor } : rowBtn}
                        >
                          {it.accent ? <span style={{ ...dot, background: it.accent }} /> : null}
                          <span style={{ fontWeight: 800 }}>{it.label}</span>
                          {it.sub ? <span style={rowSub}>{it.sub}</span> : null}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )
            )}
          </div>
        </section>
      )}

      {stage === "metric" && target && (
        <section style={card}>
          <div style={cardTitle}>Measure it by…</div>
          <div style={cardSub}>
            {target.item.label} supports a few — pick one. (Frequency &amp; Completion skip this step.)
          </div>
          <div style={chipRow}>
            {metricOptions.map((m) => (
              <button key={m.key} type="button" style={chipBtn} onClick={() => setMetric(m)}>
                <span style={{ fontWeight: 800 }}>{m.label}</span>
                {m.hint ? <span style={rowSub}>{m.hint}</span> : null}
              </button>
            ))}
          </div>
        </section>
      )}

      {stage === "amount" && (
        <section style={card}>
          <div style={cardTitle}>How much?</div>
          {type === "FREQUENCY" ? (
            <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
              <input value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="numeric" style={numInput} />
              <span style={{ opacity: 0.7, fontWeight: 800 }}>times per</span>
              <div style={chipRow}>
                {(["DAY", "WEEK", "MONTH"] as const).map((u) => (
                  <button
                    key={u}
                    type="button"
                    onClick={() => setUnit(u)}
                    style={u === unit ? { ...pill, ...pillOn } : pill}
                  >
                    {u.toLowerCase()}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
              <input value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="numeric" style={numInput} />
              <span style={{ opacity: 0.7, fontWeight: 800 }}>{metric?.label ?? "target"} · per</span>
              <div style={chipRow}>
                {(["WEEK", "MONTH", "ONE_TIME"] as const).map((u) => (
                  <button
                    key={u}
                    type="button"
                    onClick={() => setUnit(u)}
                    style={u === unit ? { ...pill, ...pillOn } : pill}
                  >
                    {u === "ONE_TIME" ? "one-time" : u.toLowerCase()}
                  </button>
                ))}
              </div>
            </div>
          )}

          <button type="button" style={advToggle} onClick={() => setAdvancedOpen((v) => !v)}>
            {advancedOpen ? "▾" : "▸"} Advanced (optional)
          </button>
          {advancedOpen && (
            <div style={advBox}>
              <div style={rowSub}>These stay available but hidden by default — nothing was removed:</div>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 8 }}>
                {["Only certain weekdays", "Substitute routines count", "Also count trigger exercises", "Min sets threshold"].map(
                  (s) => (
                    <span key={s} style={advChip}>{s}</span>
                  )
                )}
              </div>
            </div>
          )}
        </section>
      )}

      <div style={footer}>
        <div>
          <div style={previewLabel}>Goal</div>
          <div style={previewText}>{preview}</div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={decCount}>{decisions}</div>
          <div style={previewLabel}>decisions</div>
        </div>
      </div>
    </div>
  );
}

function buildPreview(
  type: GoalType | null,
  target: { group: GroupKey; item: TargetItem } | null,
  metric: Metric | null,
  needsMetric: boolean,
  amount: string,
  unit: string
): string {
  if (!type) return "Pick a goal type to begin.";
  if (!target) return `${TYPE_META[type].label} goal — pick a target.`;
  const per = unit === "ONE_TIME" ? "" : ` / ${unit.toLowerCase()}`;
  if (type === "FREQUENCY") return `${target.item.label} — ${amount || "?"}× per ${unit.toLowerCase()}`;
  if (type === "COMPLETION") return `Complete ${target.item.label} ${amount || "?"}×${per}`;
  if (needsMetric && !metric) return `${target.item.label} — pick how to measure it.`;
  const m = metric ? metric.label.toLowerCase() : "";
  if (type === "VOLUME") return `${target.item.label} — ${amount || "?"} ${m}${per}`;
  return `${target.item.label} — ${m} PR of ${amount || "?"}`;
}

function Breadcrumb({
  type,
  target,
  metric,
  stage,
  onReset,
}: {
  type: GoalType | null;
  target: { group: GroupKey; item: TargetItem } | null;
  metric: Metric | null;
  stage: string;
  onReset: () => void;
}) {
  const crumbs = [
    { k: "type", v: type ? TYPE_META[type].label : "Type" },
    { k: "target", v: target ? target.item.label : "Target" },
    ...(metric !== null || (target && metricsFor(type!, target.group).length > 1)
      ? [{ k: "metric", v: metric ? metric.label : "Measure" }]
      : []),
    { k: "amount", v: "Amount" },
  ];
  return (
    <div style={crumbRow}>
      {crumbs.map((c, i) => (
        <span key={c.k} style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
          {i > 0 ? <span style={{ opacity: 0.3 }}>›</span> : null}
          <span style={c.k === stage ? { ...crumb, ...crumbOn } : crumb}>{c.v}</span>
        </span>
      ))}
      {type ? (
        <button type="button" onClick={onReset} style={resetBtn}>
          reset
        </button>
      ) : null}
    </div>
  );
}

// ── styles ────────────────────────────────────────────────────────────────
const wrap: React.CSSProperties = { maxWidth: 640, margin: "0 auto", padding: 16, display: "grid", gap: 14 };
const banner: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 800,
  opacity: 0.6,
  textAlign: "center",
  letterSpacing: 0.4,
};
const card: React.CSSProperties = {
  border: "1px solid rgba(255,255,255,0.1)",
  borderRadius: 16,
  padding: 16,
  background: "rgba(255,255,255,0.03)",
  display: "grid",
  gap: 10,
};
const cardTitle: React.CSSProperties = { fontSize: 15, fontWeight: 900 };
const cardSub: React.CSSProperties = { fontSize: 12.5, opacity: 0.65, marginTop: -4 };
const tileGrid: React.CSSProperties = { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 };
const tile: React.CSSProperties = {
  textAlign: "left",
  border: "1px solid rgba(255,255,255,0.12)",
  borderRadius: 14,
  padding: "14px 14px",
  background: "rgba(255,255,255,0.04)",
  color: "inherit",
  cursor: "pointer",
  minHeight: 74,
};
const tileLabel: React.CSSProperties = { fontSize: 15, fontWeight: 900 };
const tileBlurb: React.CSSProperties = { fontSize: 12, opacity: 0.6, marginTop: 3 };
const search: React.CSSProperties = {
  width: "100%",
  boxSizing: "border-box",
  padding: "11px 12px",
  borderRadius: 12,
  border: "1px solid rgba(255,255,255,0.16)",
  background: "#111827",
  color: "#fff",
  fontSize: 16,
};
const groupHeader: React.CSSProperties = {
  fontSize: 10.5,
  fontWeight: 900,
  letterSpacing: 0.6,
  textTransform: "uppercase",
  opacity: 0.5,
  marginBottom: 8,
};
const chipRow: React.CSSProperties = { display: "flex", gap: 8, flexWrap: "wrap" };
const itemList: React.CSSProperties = { display: "grid", gap: 6 };
const chipBtn: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 8,
  padding: "9px 13px",
  borderRadius: 999,
  border: "1px solid rgba(255,255,255,0.16)",
  background: "rgba(255,255,255,0.05)",
  color: "inherit",
  cursor: "pointer",
  fontSize: 13,
  minHeight: 40,
};
const rowBtn: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 10,
  padding: "11px 13px",
  borderRadius: 12,
  border: "1px solid rgba(255,255,255,0.1)",
  background: "rgba(255,255,255,0.03)",
  color: "inherit",
  cursor: "pointer",
  textAlign: "left",
  minHeight: 44,
};
const rowSub: React.CSSProperties = { fontSize: 11.5, opacity: 0.55, fontWeight: 700 };
const dot: React.CSSProperties = { width: 9, height: 9, borderRadius: 999, flexShrink: 0 };
const numInput: React.CSSProperties = {
  width: 84,
  padding: "10px 12px",
  borderRadius: 12,
  border: "1px solid rgba(255,255,255,0.16)",
  background: "#111827",
  color: "#fff",
  fontSize: 16,
  fontWeight: 800,
  textAlign: "center",
};
const pill: React.CSSProperties = {
  padding: "8px 13px",
  borderRadius: 999,
  border: "1px solid rgba(255,255,255,0.14)",
  background: "transparent",
  color: "inherit",
  cursor: "pointer",
  fontSize: 12.5,
  fontWeight: 800,
  minHeight: 38,
};
const pillOn: React.CSSProperties = { background: "rgba(147,197,253,0.16)", borderColor: "rgba(147,197,253,0.5)" };
const advToggle: React.CSSProperties = {
  marginTop: 6,
  padding: 0,
  border: "none",
  background: "none",
  color: "rgba(147,197,253,0.9)",
  fontWeight: 800,
  fontSize: 12.5,
  cursor: "pointer",
  textAlign: "left",
};
const advBox: React.CSSProperties = {
  border: "1px dashed rgba(255,255,255,0.14)",
  borderRadius: 12,
  padding: 12,
  background: "rgba(255,255,255,0.02)",
};
const advChip: React.CSSProperties = {
  fontSize: 11.5,
  fontWeight: 800,
  padding: "5px 10px",
  borderRadius: 999,
  border: "1px solid rgba(255,255,255,0.12)",
  opacity: 0.75,
};
const footer: React.CSSProperties = {
  position: "sticky",
  bottom: 0,
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 12,
  padding: "12px 14px",
  borderRadius: 14,
  border: "1px solid rgba(147,197,253,0.3)",
  background: "rgba(30,41,59,0.9)",
  backdropFilter: "blur(6px)",
};
const previewLabel: React.CSSProperties = {
  fontSize: 9.5,
  fontWeight: 900,
  letterSpacing: 0.5,
  textTransform: "uppercase",
  opacity: 0.5,
};
const previewText: React.CSSProperties = { fontSize: 14, fontWeight: 800, marginTop: 3 };
const decCount: React.CSSProperties = { fontSize: 22, fontWeight: 900, lineHeight: 1, color: "rgba(147,197,253,0.95)" };
const crumbRow: React.CSSProperties = { display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" };
const crumb: React.CSSProperties = { fontSize: 12, fontWeight: 800, opacity: 0.5 };
const crumbOn: React.CSSProperties = { opacity: 1, color: "rgba(147,197,253,0.95)" };
const resetBtn: React.CSSProperties = {
  marginLeft: "auto",
  border: "none",
  background: "none",
  color: "inherit",
  opacity: 0.5,
  fontSize: 11.5,
  fontWeight: 800,
  cursor: "pointer",
};

"use client";

// Guided front door for goal creation (Goal System v2, P2). Subject-first:
// pick the thing you're working on → only the intents valid for it → hand off
// to the full GoalForm with everything prefilled. The form itself is unchanged,
// so every advanced capability (weekday masks, substitutes, triggers, rep
// floors, pace benchmarks) survives — this layer only removes the scope
// indirection on the way in. Prefill flows ("add a goal for THIS routine")
// bypass this and land on the form directly, as before.
//
// Per-routine habits are the one path that skips the form: they post straight
// to createGoal, which routes FREQUENCY/ROUTINE/SESSIONS to the canonical
// fg_<routineId> FrequencyGoal (see app/goals/actions.ts).

import { useMemo, useState, useTransition } from "react";
import type { CSSProperties } from "react";
import GoalForm, { type GoalFormInitial } from "./GoalForm";
import type { GoalFormOptions } from "@/lib/goals";
import { formInputStyle } from "./ui";

type Subject =
  | { kind: "domain"; id: string; label: string; color: string }
  | { kind: "sport"; id: string; label: string; color: string }
  | { kind: "family"; id: string; label: string }
  | { kind: "activityType"; id: string; label: string; familyName: string }
  | { kind: "routine"; id: string; label: string; sub?: string; hasMetrics: boolean }
  | { kind: "exercise"; id: string; label: string }
  | { kind: "grade"; id: string; label: string; isTemplate: boolean }
  | { kind: "template"; id: string; label: string };

// Domain subjects — first-class "Strength 3×/week" targets. Sport-domain and
// Lifestyle ship later (freeform-Activity edge case + design call); "any"
// covers the "just work out N times a week" mental model.
const DOMAIN_SUBJECTS: Array<Extract<Subject, { kind: "domain" }>> = [
  { kind: "domain", id: "strength", label: "Strength", color: "rgba(129,140,248,0.9)" },
  { kind: "domain", id: "cardio", label: "Endurance", color: "rgba(56,189,248,0.9)" },
  { kind: "domain", id: "mobility", label: "Mobility", color: "rgba(192,132,252,0.9)" },
  { kind: "domain", id: "any", label: "Any training", color: "rgba(148,163,184,0.9)" },
];

type Intent = "habit" | "total" | "best";

const INTENT_META: Record<Intent, { label: string; tagline: string; icon: string }> = {
  habit: { label: "Build a habit", tagline: "Show up N times per week", icon: "🔁" },
  total: { label: "Hit a total", tagline: "Accumulate an amount over time", icon: "📈" },
  best: { label: "Beat my best", tagline: "A new personal record", icon: "🏆" },
};

const GROUP_ORDER: Array<{ key: Subject["kind"] | "grade"; title: string }> = [
  { key: "domain", title: "Training domains" },
  { key: "sport", title: "Sports" },
  { key: "family", title: "Activities" },
  { key: "routine", title: "Routines" },
  { key: "exercise", title: "Exercises" },
  { key: "grade", title: "Grades" },
  { key: "template", title: "Session types" },
];

const VISIBLE_PER_GROUP = 6;

function localTodayYmd(): string {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

function baseInitial(): GoalFormInitial {
  return {
    name: "",
    goalType: "FREQUENCY",
    targetType: "ROUTINE",
    targetId: "",
    metricType: "SESSIONS",
    timeframe: "WEEK",
    targetValue: 3,
    startDate: localTodayYmd(),
    endDate: "",
    isActive: true,
    notes: "",
    benchmarkDistanceMi: "3.11",
    benchmarkLabel: "5K",
    sessionMetricDefinitionId: "",
    sessionMetricTarget: "",
    minReps: "",
  };
}

// Which intents make sense for a subject. Grades and session types have a
// single intent, so the intent stage auto-skips for them.
function intentsFor(subject: Subject): Intent[] {
  switch (subject.kind) {
    case "domain":
      return ["habit"];
    case "sport":
      return ["habit"];
    case "family":
    case "activityType":
      return ["habit", "total", "best"];
    case "routine":
      return subject.hasMetrics ? ["habit", "total", "best"] : ["habit", "total"];
    case "exercise":
      return ["best", "total", "habit"];
    case "grade":
      return ["best"];
    case "template":
      return ["habit"];
  }
}

// Map subject + intent onto a prefilled GoalFormInitial. deriveInitialScope
// inside GoalForm turns these shapes into the right scope UI.
function buildInitial(subject: Subject, intent: Intent): GoalFormInitial {
  const init = baseInitial();
  if (intent === "habit") {
    init.goalType = "FREQUENCY";
    if (subject.kind === "template") {
      init.targetType = "SESSION_TEMPLATE";
      init.targetId = subject.id;
      init.name = `${subject.label} 3×/week`;
      return init;
    }
    init.name = `${subject.label} ${subject.kind === "sport" ? 2 : 3}×/week`;
    init.groupFrequency = {
      targetCount: subject.kind === "sport" ? 2 : 3,
      targetInterval: 1,
      targetUnit: "WEEK",
      routineIds: subject.kind === "sport" ? [subject.id] : [],
      triggerActivityFamilyIds: subject.kind === "family" ? [subject.id] : [],
      triggerActivityTypeIds: subject.kind === "activityType" ? [subject.id] : [],
      triggerExerciseIds: subject.kind === "exercise" ? [subject.id] : [],
    };
    return init;
  }
  if (intent === "total") {
    init.goalType = "VOLUME";
    if (subject.kind === "exercise") {
      init.targetType = "EXERCISE";
      init.targetId = subject.id;
      init.metricType = "VOLUME";
      init.targetValue = 0;
      init.name = `${subject.label} weekly volume`;
      return init;
    }
    if (subject.kind === "family" || subject.kind === "activityType") {
      init.targetType = "CARDIO";
      init.targetId = "";
      init.metricType = "DISTANCE";
      init.targetValue = 0;
      init.name = `${subject.label} weekly distance`;
      return init;
    }
    init.targetType = "ROUTINE";
    init.targetId = subject.id;
    init.metricType = "SETS";
    init.targetValue = 0;
    init.name = `${subject.label} weekly total`;
    return init;
  }
  // best
  init.goalType = "PERFORMANCE";
  init.timeframe = "ONE_TIME";
  init.targetValue = 0;
  if (subject.kind === "exercise") {
    init.targetType = "EXERCISE";
    init.targetId = subject.id;
    init.metricType = "MAX_WEIGHT";
    init.name = `${subject.label} PR`;
    return init;
  }
  if (subject.kind === "family" || subject.kind === "activityType") {
    init.targetType = "CARDIO";
    init.targetId = "";
    init.metricType = "PACE";
    init.name = `${subject.label} pace PR`;
    return init;
  }
  // grade targets + metric-carrying routines → the form's grade scope
  init.targetType = subject.kind === "grade" && subject.isTemplate ? "SESSION_TEMPLATE" : "ROUTINE";
  init.targetId = subject.id;
  init.metricType = "SESSION_METRIC";
  init.name = `${subject.label} PR`;
  return init;
}

export default function GoalCreatorEntry({
  options,
  defaultInitial,
  createAction,
  createFrequencyAction,
  onSuccess,
}: {
  options: GoalFormOptions;
  defaultInitial: GoalFormInitial;
  createAction: (formData: FormData) => void | Promise<void>;
  createFrequencyAction: (formData: FormData) => void | Promise<void>;
  onSuccess?: () => void;
}) {
  const [stage, setStage] = useState<
    "subject" | "intent" | "form" | "routineHabit" | "domainHabit" | "manual"
  >("subject");
  const [subject, setSubject] = useState<Subject | null>(null);
  const [formInitial, setFormInitial] = useState<GoalFormInitial | null>(null);
  const [query, setQuery] = useState("");
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

  const subjects = useMemo(() => buildSubjectCatalog(options), [options]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return subjects;
    const matches = (s: Subject) =>
      s.label.toLowerCase().includes(q) ||
      (s.kind === "activityType" && s.familyName.toLowerCase().includes(q)) ||
      // grade-ish queries ("v7", "v grade", "5.11") should surface Grades
      (s.kind === "grade" && /^v\s?\d|^5\.|grade|boulder|climb/.test(q)) ||
      // "work out 4x a week" style queries surface the domain chips
      (s.kind === "domain" && /work\s?out|train|exercise|fitness|domain/.test(q));
    return subjects.filter(matches);
  }, [subjects, query]);

  function pickSubject(next: Subject) {
    setSubject(next);
    const intents = intentsFor(next);
    if (intents.length === 1) {
      pickIntent(next, intents[0]);
      return;
    }
    setStage("intent");
  }

  function pickIntent(forSubject: Subject, intent: Intent) {
    if (intent === "habit" && forSubject.kind === "routine") {
      setSubject(forSubject);
      setStage("routineHabit");
      return;
    }
    if (forSubject.kind === "domain") {
      setSubject(forSubject);
      setStage("domainHabit");
      return;
    }
    setFormInitial(buildInitial(forSubject, intent));
    setStage("form");
  }

  function reset() {
    setStage("subject");
    setSubject(null);
    setFormInitial(null);
  }

  if (stage === "form" && formInitial) {
    return (
      <div style={{ display: "grid", gap: 10 }}>
        <button type="button" onClick={reset} style={backLink}>
          ‹ Start over
        </button>
        <GoalForm
          action={createAction}
          groupFrequencyAction={createFrequencyAction}
          options={options}
          submitLabel="Save Goal"
          initial={formInitial}
          inDrawer
          onSuccess={onSuccess}
        />
      </div>
    );
  }

  if (stage === "manual") {
    return (
      <div style={{ display: "grid", gap: 10 }}>
        <button type="button" onClick={reset} style={backLink}>
          ‹ Start over
        </button>
        <GoalForm
          action={createAction}
          groupFrequencyAction={createFrequencyAction}
          options={options}
          submitLabel="Save Goal"
          initial={defaultInitial}
          inDrawer
          onSuccess={onSuccess}
        />
      </div>
    );
  }

  if (stage === "domainHabit" && subject && subject.kind === "domain") {
    return (
      <DomainHabitPane
        domain={subject}
        createFrequencyAction={createFrequencyAction}
        onBack={reset}
        onSuccess={onSuccess}
      />
    );
  }

  if (stage === "routineHabit" && subject && subject.kind === "routine") {
    return (
      <RoutineHabitPane
        routine={subject}
        createAction={createAction}
        onBack={() => setStage("intent")}
        onManualCompletion={() => {
          const init = baseInitial();
          init.goalType = "COMPLETION";
          init.targetType = "ROUTINE";
          init.targetId = subject.id;
          init.metricType = "COMPLETED";
          init.timeframe = "ONE_TIME";
          init.targetValue = 10;
          init.name = `Complete ${subject.label}`;
          setFormInitial(init);
          setStage("form");
        }}
        onSuccess={onSuccess}
      />
    );
  }

  if (stage === "intent" && subject) {
    const intents = intentsFor(subject);
    return (
      <div style={{ display: "grid", gap: 14 }}>
        <button type="button" onClick={reset} style={backLink}>
          ‹ {subject.label}
        </button>
        <div style={stageTitle}>What kind of goal for {subject.label}?</div>
        <div style={intentGrid}>
          {intents.map((intent) => (
            <button key={intent} type="button" style={intentTile} onClick={() => pickIntent(subject, intent)}>
              <span style={{ fontSize: 18 }} aria-hidden>{INTENT_META[intent].icon}</span>
              <span style={intentLabel}>{INTENT_META[intent].label}</span>
              <span style={intentTagline}>{INTENT_META[intent].tagline}</span>
            </button>
          ))}
        </div>
      </div>
    );
  }

  // ── subject stage ──────────────────────────────────────────────────────────
  const gallery = buildGallery(subjects);
  const showGallery = !query.trim() && gallery.length > 0;

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <input
        autoFocus={false}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search sports, routines, exercises…"
        style={{ ...formInputStyle, fontSize: 16 }}
        aria-label="Search goal subjects"
      />

      {showGallery ? (
        <div style={{ display: "grid", gap: 8 }}>
          <div style={groupHeader}>Quick start</div>
          <div style={chipWrap}>
            {gallery.map((g) => (
              <button key={g.key} type="button" style={galleryChip} onClick={() => pickSubject(g.subject)}>
                {g.label}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      <div style={{ display: "grid", gap: 8 }}>
        {showGallery ? <div style={groupHeader}>Or pick what you’re working on</div> : null}
        {GROUP_ORDER.map(({ key, title }) => {
          const items = filtered.filter((s) => s.kind === key);
          if (items.length === 0) return null;
          const expanded = expandedGroups.has(key) || query.trim().length > 0;
          const visible = expanded ? items : items.slice(0, VISIBLE_PER_GROUP);
          const hidden = items.length - visible.length;
          const chipStyleGroups = key === "domain" || key === "sport" || key === "grade";
          return (
            <div key={key} style={{ display: "grid", gap: 7 }}>
              <div style={groupHeader}>{title}</div>
              <div style={chipStyleGroups ? chipWrap : rowList}>
                {visible.map((s) => (
                  <button
                    key={`${s.kind}:${s.id}`}
                    type="button"
                    style={chipStyleGroups ? subjectChip : subjectRow}
                    onClick={() => pickSubject(s)}
                  >
                    {s.kind === "sport" || s.kind === "domain" ? (
                      <span style={{ ...sportDot, background: s.color }} aria-hidden />
                    ) : null}
                    <span style={{ fontWeight: 800, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {s.label}
                    </span>
                    {"sub" in s && s.sub ? <span style={rowSub}>{s.sub}</span> : null}
                    {s.kind === "activityType" ? <span style={rowSub}>{s.familyName}</span> : null}
                  </button>
                ))}
              </div>
              {hidden > 0 ? (
                <button
                  type="button"
                  style={moreLink}
                  onClick={() => setExpandedGroups((prev) => new Set(prev).add(key))}
                >
                  Show {hidden} more
                </button>
              ) : null}
            </div>
          );
        })}
        {query.trim() && filtered.length === 0 ? (
          <div style={emptyNote}>
            Nothing matches “{query.trim()}”. Try another word — or build the goal manually below.
          </div>
        ) : null}
      </div>

      <button type="button" style={manualLink} onClick={() => setStage("manual")}>
        Build it manually instead →
      </button>
    </div>
  );
}

// Domain habit — "Strength 3×/week" counts every log in the domain. Posts to
// createFrequencyGoal with targetDomain set; no routine roster needed (the
// matcher resolves membership from each log's effective domain).
function DomainHabitPane({
  domain,
  createFrequencyAction,
  onBack,
  onSuccess,
}: {
  domain: Extract<Subject, { kind: "domain" }>;
  createFrequencyAction: (formData: FormData) => void | Promise<void>;
  onBack: () => void;
  onSuccess?: () => void;
}) {
  const [count, setCount] = useState("3");
  const [unit, setUnit] = useState<"DAY" | "WEEK" | "MONTH">("WEEK");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function save() {
    const parsed = Math.floor(Number(count));
    if (!Number.isFinite(parsed) || parsed < 1) {
      setError("Set how many times (1 or more).");
      return;
    }
    setError(null);
    const unitWord = unit === "DAY" ? "day" : unit === "WEEK" ? "week" : "month";
    const fd = new FormData();
    fd.set("name", `${domain.label} ${parsed}×/${unitWord}`);
    fd.set("targetCount", String(parsed));
    fd.set("targetInterval", "1");
    fd.set("targetUnit", unit);
    fd.set("targetDomain", domain.id);
    fd.set("noRedirect", "1");
    startTransition(async () => {
      try {
        await createFrequencyAction(fd);
        onSuccess?.();
      } catch (err) {
        setError(err instanceof Error && err.message ? err.message : "Couldn't save. Please try again.");
      }
    });
  }

  return (
    <div style={{ display: "grid", gap: 14 }}>
      <button type="button" onClick={onBack} style={backLink}>
        ‹ Back
      </button>
      <div style={stageTitle}>
        <span style={{ ...sportDot, background: domain.color, marginRight: 8, display: "inline-block" }} aria-hidden />
        How often for {domain.label.toLowerCase() === "any training" ? "any training" : domain.label}?
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <input
          value={count}
          onChange={(e) => setCount(e.target.value)}
          inputMode="numeric"
          style={{ ...formInputStyle, width: 84, textAlign: "center", fontWeight: 800, fontSize: 16 }}
          aria-label="Times per period"
        />
        <span style={{ fontSize: 13, fontWeight: 800, opacity: 0.7 }}>times per</span>
        <div style={chipWrap}>
          {(["DAY", "WEEK", "MONTH"] as const).map((u) => (
            <button
              key={u}
              type="button"
              onClick={() => setUnit(u)}
              style={u === unit ? { ...unitPill, ...unitPillOn } : unitPill}
            >
              {u === "DAY" ? "day" : u === "WEEK" ? "week" : "month"}
            </button>
          ))}
        </div>
      </div>

      <div style={helperNote}>
        {domain.id === "any"
          ? "Every logged session counts — any routine, sport, or activity."
          : `Every ${domain.label.toLowerCase()} session counts — no need to pick routines. New ones count automatically.`}{" "}
        It shows on your home grid with streaks.
      </div>

      {error ? <div style={errorNote} role="alert">{error}</div> : null}

      <button type="button" onClick={save} disabled={pending} style={savePrimary}>
        {pending ? "Saving…" : "Save Goal"}
      </button>
    </div>
  );
}

// Per-routine habit — posts straight to createGoal, which routes
// FREQUENCY/ROUTINE/SESSIONS to the canonical fg_<routineId> record (the same
// row the routine form's frequency block manages).
function RoutineHabitPane({
  routine,
  createAction,
  onBack,
  onManualCompletion,
  onSuccess,
}: {
  routine: Extract<Subject, { kind: "routine" }>;
  createAction: (formData: FormData) => void | Promise<void>;
  onBack: () => void;
  onManualCompletion: () => void;
  onSuccess?: () => void;
}) {
  const [count, setCount] = useState("3");
  const [unit, setUnit] = useState<"DAY" | "WEEK" | "MONTH">("WEEK");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function save() {
    const parsed = Math.floor(Number(count));
    if (!Number.isFinite(parsed) || parsed < 1) {
      setError("Set how many times (1 or more).");
      return;
    }
    setError(null);
    const fd = new FormData();
    fd.set("goalType", "FREQUENCY");
    fd.set("targetType", "ROUTINE");
    fd.set("metricType", "SESSIONS");
    fd.set("targetId", routine.id);
    fd.set("timeframe", unit);
    fd.set("targetValue", String(parsed));
    fd.set("noRedirect", "1");
    startTransition(async () => {
      try {
        await createAction(fd);
        onSuccess?.();
      } catch (err) {
        setError(err instanceof Error && err.message ? err.message : "Couldn't save. Please try again.");
      }
    });
  }

  return (
    <div style={{ display: "grid", gap: 14 }}>
      <button type="button" onClick={onBack} style={backLink}>
        ‹ Back
      </button>
      <div style={stageTitle}>How often for {routine.label}?</div>

      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <input
          value={count}
          onChange={(e) => setCount(e.target.value)}
          inputMode="numeric"
          style={{ ...formInputStyle, width: 84, textAlign: "center", fontWeight: 800, fontSize: 16 }}
          aria-label="Times per period"
        />
        <span style={{ fontSize: 13, fontWeight: 800, opacity: 0.7 }}>times per</span>
        <div style={chipWrap}>
          {(["DAY", "WEEK", "MONTH"] as const).map((u) => (
            <button
              key={u}
              type="button"
              onClick={() => setUnit(u)}
              style={u === unit ? { ...unitPill, ...unitPillOn } : unitPill}
            >
              {u === "DAY" ? "day" : u === "WEEK" ? "week" : "month"}
            </button>
          ))}
        </div>
      </div>

      <div style={helperNote}>
        This becomes the routine’s frequency goal — it shows on your home grid with streaks.
        Weekday scheduling and substitute routines live on the routine’s edit page.
      </div>

      {error ? <div style={errorNote} role="alert">{error}</div> : null}

      <button type="button" onClick={save} disabled={pending} style={savePrimary}>
        {pending ? "Saving…" : "Save Goal"}
      </button>

      <button type="button" onClick={onManualCompletion} style={manualLink}>
        Want a one-time “complete it N times” goal instead? →
      </button>
    </div>
  );
}

// ── catalog + gallery builders ─────────────────────────────────────────────

function buildSubjectCatalog(options: GoalFormOptions): Subject[] {
  const gradeRoutineIds = new Set(
    Object.entries(options.sessionMetricsByRoutineId)
      .filter(([, metrics]) => metrics.length > 0)
      .map(([id]) => id)
  );
  const gradeTemplateIds = new Set(
    Object.entries(options.sessionMetricsByTemplateId)
      .filter(([, metrics]) => metrics.length > 0)
      .map(([id]) => id)
  );

  const sports: Subject[] = options.sportTargets.map((s) => ({
    kind: "sport",
    id: s.id,
    label: s.label,
    color: s.color,
  }));
  const families: Subject[] = options.activityFamilies.map((f) => ({
    kind: "family",
    id: f.id,
    label: f.name,
  }));
  const types: Subject[] = options.activityTypes.map((t) => ({
    kind: "activityType",
    id: t.id,
    label: t.name,
    familyName: t.familyName,
  }));
  const routines: Subject[] = options.routines.map((r) => ({
    kind: "routine",
    id: r.id,
    label: r.label,
    sub: r.subtitle ?? undefined,
    hasMetrics: gradeRoutineIds.has(r.id),
  }));
  const exercises: Subject[] = options.exercises.map((e) => ({
    kind: "exercise",
    id: e.id,
    label: e.label,
  }));
  const grades: Subject[] = [
    ...options.routines
      .filter((r) => gradeRoutineIds.has(r.id))
      .map((r): Subject => ({ kind: "grade", id: r.id, label: r.label, isTemplate: false })),
    ...options.sessionTemplates
      .filter((t) => gradeTemplateIds.has(t.id))
      .map((t): Subject => ({ kind: "grade", id: t.id, label: t.label, isTemplate: true })),
  ];
  const templates: Subject[] = options.sessionTemplates.map((t) => ({
    kind: "template",
    id: t.id,
    label: t.label,
  }));
  // Activity types fold in after families so search finds "Trail Run" while
  // the unqueried Activities group leads with the broader families.
  return [...DOMAIN_SUBJECTS, ...sports, ...families, ...types, ...routines, ...exercises, ...grades, ...templates];
}

function buildGallery(subjects: Subject[]): Array<{ key: string; label: string; subject: Subject }> {
  const strengthDomain = subjects.find((s) => s.kind === "domain" && s.id === "strength");
  const sports = subjects.filter((s) => s.kind === "sport").slice(0, 2);
  const families = subjects.filter((s) => s.kind === "family").slice(0, 2);
  const routines = subjects.filter((s) => s.kind === "routine").slice(0, 2);
  return [
    ...(strengthDomain ? [{ key: "g-strength", label: "Strength 3×/week", subject: strengthDomain }] : []),
    ...sports.map((s) => ({ key: `g-${s.id}`, label: `${s.label} 2×/week`, subject: s })),
    ...families.map((s) => ({ key: `g-${s.id}`, label: `${s.label} 3×/week`, subject: s })),
    ...routines.map((s) => ({ key: `g-${s.id}`, label: `${s.label} 3×/week`, subject: s })),
  ].slice(0, 6);
}

// ── styles — same dark theme tokens as the drawer + goal form ──────────────

const stageTitle: CSSProperties = { fontSize: 15, fontWeight: 900 };

const backLink: CSSProperties = {
  justifySelf: "start",
  border: "none",
  background: "none",
  padding: "4px 0",
  color: "rgba(147,197,253,0.9)",
  fontSize: 13,
  fontWeight: 800,
  cursor: "pointer",
};

const groupHeader: CSSProperties = {
  fontSize: 10.5,
  fontWeight: 900,
  letterSpacing: 0.6,
  textTransform: "uppercase",
  opacity: 0.5,
};

const chipWrap: CSSProperties = { display: "flex", gap: 8, flexWrap: "wrap" };

const subjectChip: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 8,
  padding: "9px 13px",
  borderRadius: 999,
  border: "1px solid rgba(255,255,255,0.14)",
  background: "rgba(255,255,255,0.04)",
  color: "inherit",
  cursor: "pointer",
  fontSize: 13,
  minHeight: 40,
};

const galleryChip: CSSProperties = {
  ...subjectChip,
  border: "1px solid rgba(147,197,253,0.35)",
  background: "rgba(147,197,253,0.08)",
  fontWeight: 800,
};

const rowList: CSSProperties = { display: "grid", gap: 6 };

const subjectRow: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 10,
  padding: "11px 13px",
  borderRadius: 12,
  border: "1px solid rgba(255,255,255,0.09)",
  background: "rgba(255,255,255,0.025)",
  color: "inherit",
  cursor: "pointer",
  textAlign: "left",
  minHeight: 44,
  width: "100%",
};

const rowSub: CSSProperties = { fontSize: 11, opacity: 0.55, fontWeight: 700, flexShrink: 0, marginLeft: "auto" };

const sportDot: CSSProperties = { width: 9, height: 9, borderRadius: 999, flexShrink: 0 };

const moreLink: CSSProperties = {
  justifySelf: "start",
  border: "none",
  background: "none",
  padding: "2px 0",
  color: "rgba(255,255,255,0.5)",
  fontSize: 12,
  fontWeight: 800,
  cursor: "pointer",
};

const manualLink: CSSProperties = {
  justifySelf: "start",
  border: "none",
  background: "none",
  padding: "6px 0",
  color: "rgba(147,197,253,0.85)",
  fontSize: 12.5,
  fontWeight: 800,
  cursor: "pointer",
};

const emptyNote: CSSProperties = {
  fontSize: 12.5,
  opacity: 0.65,
  lineHeight: 1.5,
  padding: "6px 2px",
};

const intentGrid: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
  gap: 10,
};

const intentTile: CSSProperties = {
  display: "grid",
  gap: 4,
  justifyItems: "start",
  textAlign: "left",
  padding: "14px 14px",
  borderRadius: 14,
  border: "1px solid rgba(255,255,255,0.12)",
  background: "rgba(255,255,255,0.035)",
  color: "inherit",
  cursor: "pointer",
  minHeight: 84,
};

const intentLabel: CSSProperties = { fontSize: 14.5, fontWeight: 900 };
const intentTagline: CSSProperties = { fontSize: 11.5, opacity: 0.6, fontWeight: 700 };

const unitPill: CSSProperties = {
  padding: "9px 14px",
  borderRadius: 999,
  border: "1px solid rgba(255,255,255,0.14)",
  background: "transparent",
  color: "inherit",
  cursor: "pointer",
  fontSize: 13,
  fontWeight: 800,
  minHeight: 40,
};

const unitPillOn: CSSProperties = {
  background: "rgba(147,197,253,0.16)",
  borderColor: "rgba(147,197,253,0.5)",
};

const helperNote: CSSProperties = {
  fontSize: 12,
  opacity: 0.6,
  lineHeight: 1.5,
};

const errorNote: CSSProperties = {
  fontSize: 13,
  fontWeight: 700,
  color: "rgba(252,165,165,0.98)",
  background: "rgba(248,113,113,0.1)",
  border: "1px solid rgba(248,113,113,0.32)",
  borderRadius: 10,
  padding: "8px 12px",
};

const savePrimary: CSSProperties = {
  width: "100%",
  minHeight: 48,
  padding: "13px 16px",
  border: "none",
  borderRadius: 14,
  background: "rgba(34,197,94,0.88)",
  color: "#000",
  fontWeight: 900,
  fontSize: 15,
  cursor: "pointer",
};

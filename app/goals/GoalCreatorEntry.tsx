"use client";

// Guided goal creator (Goal System v2.2) — intent-first with a global search.
//
// Structure (small fan-out → large fan-out):
//   1. Home: search + data-driven quick-start + THREE intent tiles. No
//      catalog — the wall lives behind a choice, never in front of one.
//   2. Subject: only the subjects valid for the chosen intent, small groups
//      first, long groups as top-5-by-recency + "Search all N…" (focuses the
//      search — expand-in-place is banned).
//   3. Habit intents end in a 3-field pane (stepper, unit chips, save) with
//      a live "counted last 7 days" preview and a gentle overlap note.
//      Total/Best hand off to GoalForm prefilled.
//   4. Saved: one confirmation beat saying where the goal now lives.
//
// Searching from Home is the subject-first path for people who think in
// subjects ("bench", "V7") — picking a single-intent match skips ahead;
// multi-intent matches show the three tiles scoped to that subject.
// Prefilled contextual flows ("goal for THIS routine") bypass this entirely
// (see FormDrawer).

import { useMemo, useRef, useState, useTransition } from "react";
import type { CSSProperties } from "react";
import GoalForm, { type GoalFormInitial } from "./GoalForm";
import type { GoalFormOptions } from "@/lib/goals";
import { formInputStyle } from "./ui";

// ── Subjects + intents ──────────────────────────────────────────────────────

type Subject =
  | { kind: "domain"; id: string; label: string; color: string }
  | { kind: "sport"; id: string; label: string; slug: string; color: string }
  | { kind: "family"; id: string; label: string }
  | { kind: "activityType"; id: string; label: string; familyId: string; familyName: string }
  | { kind: "routine"; id: string; label: string; sub?: string; hasMetrics: boolean }
  | { kind: "exercise"; id: string; label: string }
  | { kind: "grade"; id: string; label: string; isTemplate: boolean }
  | { kind: "template"; id: string; label: string };

type Intent = "habit" | "total" | "best";

const INTENT_META: Record<Intent, { label: string; tagline: string; icon: string }> = {
  habit: { label: "Build a habit", tagline: "Show up N times a week", icon: "🔁" },
  total: { label: "Hit a total", tagline: "Add up miles, reps, or sets", icon: "📈" },
  best: { label: "Beat my best", tagline: "Set a personal record", icon: "🏆" },
};

const DOMAIN_SUBJECTS: Array<Extract<Subject, { kind: "domain" }>> = [
  { kind: "domain", id: "strength", label: "Strength", color: "rgba(129,140,248,0.9)" },
  { kind: "domain", id: "cardio", label: "Endurance", color: "rgba(56,189,248,0.9)" },
  { kind: "domain", id: "mobility", label: "Mobility", color: "rgba(192,132,252,0.9)" },
  { kind: "domain", id: "lifestyle", label: "Lifestyle", color: "rgba(84,203,130,0.9)" },
  { kind: "domain", id: "any", label: "Any training", color: "rgba(148,163,184,0.9)" },
];

const DOMAIN_HUB: Record<string, string | null> = {
  strength: "the Strength page",
  cardio: "the Endurance page",
  mobility: "the Mobility page",
  lifestyle: "the Lifestyle page",
  any: null,
};

function intentsFor(subject: Subject): Intent[] {
  switch (subject.kind) {
    case "domain":
    case "sport":
    case "template":
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
  }
}

// ── Handoff mapping (total / best → GoalForm) ───────────────────────────────

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

function buildInitial(subject: Subject, intent: Intent): GoalFormInitial {
  const init = baseInitial();
  if (intent === "total") {
    init.goalType = "VOLUME";
    init.targetValue = 0;
    if (subject.kind === "exercise") {
      init.targetType = "EXERCISE";
      init.targetId = subject.id;
      init.metricType = "VOLUME";
      init.name = `${subject.label} weekly volume`;
      return init;
    }
    if (subject.kind === "family" || subject.kind === "activityType") {
      // The endurance target is a metadata group, not a family — the form
      // keeps its target dropdown visible for this one path (locked-mode
      // exception; see the creator audit).
      init.targetType = "CARDIO";
      init.targetId = "";
      init.metricType = "DISTANCE";
      init.name = `${subject.label} weekly distance`;
      return init;
    }
    init.targetType = "ROUTINE";
    init.targetId = subject.id;
    init.metricType = "SETS";
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
  init.targetType = subject.kind === "grade" && subject.isTemplate ? "SESSION_TEMPLATE" : "ROUTINE";
  init.targetId = subject.id;
  init.metricType = "SESSION_METRIC";
  init.name = `${subject.label} PR`;
  return init;
}

// ── Component ───────────────────────────────────────────────────────────────

type SavedInfo = { name: string; where: string };

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
  const [stage, setStage] = useState<"home" | "subject" | "intent" | "pane" | "form" | "manual" | "saved">("home");
  const [intentFilter, setIntentFilter] = useState<Intent | null>(null);
  const [subject, setSubject] = useState<Subject | null>(null);
  const [formInitial, setFormInitial] = useState<GoalFormInitial | null>(null);
  const [lockedMeta, setLockedMeta] = useState<{ icon: string; summary: string } | null>(null);
  const [saved, setSaved] = useState<SavedInfo | null>(null);
  const [query, setQuery] = useState("");
  const [searchHint, setSearchHint] = useState<string | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const subjects = useMemo(() => buildCatalog(options), [options]);
  const quickStart = useMemo(() => buildQuickStart(subjects, options), [subjects, options]);

  const searchResults = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    const pool = intentFilter ? subjects.filter((s) => intentsFor(s).includes(intentFilter)) : subjects;
    return pool
      .filter(
        (s) =>
          s.label.toLowerCase().includes(q) ||
          (s.kind === "activityType" && s.familyName.toLowerCase().includes(q)) ||
          (s.kind === "grade" && /^v\s?\d|^5\.|grade|boulder|climb/.test(q)) ||
          (s.kind === "domain" && /work\s?out|train|exercise|fitness/.test(q))
      )
      .slice(0, 24);
  }, [subjects, query, intentFilter]);

  function reset() {
    setStage("home");
    setIntentFilter(null);
    setSubject(null);
    setFormInitial(null);
    setLockedMeta(null);
    setSaved(null);
    setQuery("");
    setSearchHint(null);
  }

  function pickIntent(intent: Intent) {
    setIntentFilter(intent);
    setQuery("");
    setStage("subject");
  }

  function pickSubject(next: Subject, intent?: Intent | null) {
    const valid = intentsFor(next);
    const chosen = intent && valid.includes(intent) ? intent : valid.length === 1 ? valid[0] : null;
    setSubject(next);
    setQuery("");
    if (!chosen) {
      setStage("intent");
      return;
    }
    if (chosen === "habit") {
      setStage("pane");
      return;
    }
    const init = buildInitial(next, chosen);
    // Endurance handoffs target a cardio metadata group, not the family —
    // preselect by label match when one clearly corresponds ("Running" →
    // the Running group). No match → leave empty so the form's dropdown
    // stays visible and the user picks.
    if (init.targetType === "CARDIO" && !init.targetId) {
      const label = next.label.toLowerCase();
      const match = options.cardioTargets.find(
        (t) => t.label.toLowerCase() === label || t.label.toLowerCase().includes(label) || label.includes(t.label.toLowerCase())
      );
      if (match) init.targetId = match.id;
    }
    setFormInitial(init);
    setLockedMeta({ icon: INTENT_META[chosen].icon, summary: `${INTENT_META[chosen].label} · ${next.label}` });
    setStage("form");
  }

  function focusSearch(hint: string) {
    setSearchHint(hint);
    searchRef.current?.focus();
  }

  function handleSaved(info: SavedInfo) {
    setSaved(info);
    setStage("saved");
  }

  // ── Saved beat ─────────────────────────────────────────────────────────
  if (stage === "saved" && saved) {
    return (
      <div style={{ display: "grid", gap: 14, padding: "10px 2px" }}>
        <div style={{ fontSize: 30 }} aria-hidden>✓</div>
        <div style={stageTitle}>Added</div>
        <div style={savedBody}>
          <strong>{saved.name}</strong> is live — see it on {saved.where}.
        </div>
        <button type="button" style={savePrimary} onClick={() => onSuccess?.()}>
          Done
        </button>
        <button type="button" style={quietLink} onClick={reset}>
          Create another →
        </button>
      </div>
    );
  }

  // ── Handoff / manual form ──────────────────────────────────────────────
  if ((stage === "form" && formInitial) || stage === "manual") {
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
          initial={stage === "manual" ? defaultInitial : formInitial!}
          inDrawer
          onSuccess={onSuccess}
          lockedContext={
            stage === "form" && lockedMeta ? { ...lockedMeta, onChange: reset } : undefined
          }
        />
      </div>
    );
  }

  // ── Habit pane ─────────────────────────────────────────────────────────
  if (stage === "pane" && subject) {
    return (
      <HabitPane
        subject={subject}
        options={options}
        createAction={createAction}
        createFrequencyAction={createFrequencyAction}
        onBack={() => setStage(intentFilter ? "subject" : "home")}
        onSaved={handleSaved}
        onCompletionInstead={
          subject.kind === "routine"
            ? () => {
                const init = baseInitial();
                init.goalType = "COMPLETION";
                init.targetType = "ROUTINE";
                init.targetId = subject.id;
                init.metricType = "COMPLETED";
                init.timeframe = "ONE_TIME";
                init.targetValue = 10;
                init.name = `Complete ${subject.label}`;
                setFormInitial(init);
                setLockedMeta({ icon: "☑️", summary: `Finish it · ${subject.label}` });
                setStage("form");
              }
            : undefined
        }
      />
    );
  }

  // ── Intent picker for a multi-intent subject (arrived via search) ──────
  if (stage === "intent" && subject) {
    const valid = intentsFor(subject);
    return (
      <div style={{ display: "grid", gap: 14 }}>
        <button type="button" onClick={reset} style={backLink}>
          ‹ Start over
        </button>
        <div style={stageTitle}>What kind of goal for {subject.label}?</div>
        <div style={{ display: "grid", gap: 8 }}>
          {valid.map((intent) => (
            <IntentTile key={intent} intent={intent} onPick={() => pickSubject(subject, intent)} />
          ))}
        </div>
      </div>
    );
  }

  // ── Subject screen (intent chosen) ─────────────────────────────────────
  if (stage === "subject" && intentFilter) {
    const pool = subjects.filter((s) => intentsFor(s).includes(intentFilter));
    const showingSearch = query.trim().length > 0;
    return (
      <div style={{ display: "grid", gap: 14 }}>
        <button type="button" onClick={reset} style={backLink}>
          ‹ {INTENT_META[intentFilter].icon} {INTENT_META[intentFilter].label}
        </button>
        <div style={stageTitle}>…for what?</div>
        <input
          ref={searchRef}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={searchHint ?? "Search"}
          style={{ ...formInputStyle, fontSize: 16 }}
          aria-label="Search subjects"
        />
        {showingSearch ? (
          <SearchResults results={searchResults} onPick={(s) => pickSubject(s, intentFilter)} query={query} onManual={() => setStage("manual")} />
        ) : (
          <SubjectGroups
            pool={pool}
            intent={intentFilter}
            options={options}
            onPick={(s) => pickSubject(s, intentFilter)}
            onFocusSearch={focusSearch}
            onMixOfRoutines={() => {
              const init = baseInitial();
              init.goalType = "FREQUENCY";
              init.name = "";
              init.groupFrequency = {
                targetCount: 2,
                targetInterval: 1,
                targetUnit: "WEEK",
                routineIds: [],
              };
              setFormInitial(init);
              setStage("form");
            }}
          />
        )}
      </div>
    );
  }

  // ── Home ───────────────────────────────────────────────────────────────
  const showingSearch = query.trim().length > 0;
  return (
    <div style={{ display: "grid", gap: 16 }}>
      <input
        ref={searchRef}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search — try “bench”, “climbing”, “V7”…"
        style={{ ...formInputStyle, fontSize: 16 }}
        aria-label="Search anything"
      />

      {showingSearch ? (
        <SearchResults results={searchResults} onPick={(s) => pickSubject(s, null)} query={query} onManual={() => setStage("manual")} />
      ) : (
        <>
          {quickStart.length > 0 ? (
            <div style={{ display: "grid", gap: 8 }}>
              <div style={groupHeader}>Quick start</div>
              <div style={chipWrap}>
                {quickStart.map((qs) => (
                  <button key={qs.key} type="button" style={galleryChip} onClick={() => pickSubject(qs.subject, "habit")}>
                    {qs.label}
                  </button>
                ))}
                <button type="button" style={galleryChipQuiet} onClick={() => pickIntent("best")}>
                  🏆 New PR…
                </button>
              </div>
            </div>
          ) : null}

          <div style={{ display: "grid", gap: 8 }}>
            <div style={stageTitle}>What kind of goal?</div>
            <div style={{ display: "grid", gap: 8 }}>
              {(Object.keys(INTENT_META) as Intent[]).map((intent) => (
                <IntentTile key={intent} intent={intent} onPick={() => pickIntent(intent)} />
              ))}
            </div>
          </div>

          <button type="button" style={quietLink} onClick={() => setStage("manual")}>
            Build it manually →
          </button>
        </>
      )}
    </div>
  );
}

// ── Pieces ──────────────────────────────────────────────────────────────────

function IntentTile({ intent, onPick }: { intent: Intent; onPick: () => void }) {
  const meta = INTENT_META[intent];
  return (
    <button type="button" style={intentTile} onClick={onPick}>
      <span style={{ fontSize: 20 }} aria-hidden>{meta.icon}</span>
      <span style={{ display: "grid", gap: 2, textAlign: "left" }}>
        <span style={intentLabel}>{meta.label}</span>
        <span style={intentTagline}>{meta.tagline}</span>
      </span>
    </button>
  );
}

function SearchResults({
  results,
  query,
  onPick,
  onManual,
}: {
  results: Subject[];
  query: string;
  onPick: (s: Subject) => void;
  onManual: () => void;
}) {
  if (results.length === 0) {
    return (
      <div style={emptyNote}>
        Nothing matches “{query.trim()}”. Try another word — or{" "}
        <button type="button" style={inlineLink} onClick={onManual}>
          build it manually
        </button>
        .
      </div>
    );
  }
  return (
    <div style={rowList}>
      {results.map((s) => (
        <SubjectRow key={`${s.kind}:${s.id}`} subject={s} onPick={() => onPick(s)} />
      ))}
    </div>
  );
}

const KIND_TAG: Record<Subject["kind"], string> = {
  domain: "category",
  sport: "sport",
  family: "activity",
  activityType: "activity",
  routine: "routine",
  exercise: "exercise",
  grade: "grade",
  template: "session type",
};

function SubjectRow({ subject, onPick }: { subject: Subject; onPick: () => void }) {
  return (
    <button type="button" style={subjectRow} onClick={onPick}>
      {"color" in subject ? <span style={{ ...dot, background: subject.color }} aria-hidden /> : null}
      <span style={rowLabel}>{subject.label}</span>
      <span style={rowSub}>
        {subject.kind === "activityType"
          ? subject.familyName
          : subject.kind === "family"
          ? "any type counts"
          : "sub" in subject && subject.sub
          ? subject.sub
          : KIND_TAG[subject.kind]}
      </span>
    </button>
  );
}

const VISIBLE = 5;

function SubjectGroups({
  pool,
  intent,
  options,
  onPick,
  onFocusSearch,
  onMixOfRoutines,
}: {
  pool: Subject[];
  intent: Intent;
  options: GoalFormOptions;
  onPick: (s: Subject) => void;
  onFocusSearch: (hint: string) => void;
  onMixOfRoutines: () => void;
}) {
  const domains = pool.filter((s) => s.kind === "domain");
  const sports = pool.filter((s) => s.kind === "sport");
  const families = pool.filter((s) => s.kind === "family");
  const routines = pool.filter((s) => s.kind === "routine");
  const exercises = pool.filter((s) => s.kind === "exercise");
  const grades = pool.filter((s) => s.kind === "grade");

  return (
    <div style={{ display: "grid", gap: 14 }}>
      {domains.length > 0 ? (
        <div style={{ display: "grid", gap: 7 }}>
          <div style={groupHeader}>Whole categories</div>
          <div style={groupHint}>Every matching session counts, automatically — even from new routines.</div>
          <div style={chipWrap}>
            {domains.map((s) => (
              <button key={s.id} type="button" style={subjectChip} onClick={() => onPick(s)}>
                <span style={{ ...dot, background: (s as { color: string }).color }} aria-hidden />
                <span style={{ fontWeight: 800 }}>{s.label}</span>
              </button>
            ))}
          </div>
        </div>
      ) : null}

      {sports.length > 0 ? (
        <div style={{ display: "grid", gap: 7 }}>
          <div style={groupHeader}>Sports</div>
          <div style={chipWrap}>
            {sports.map((s) => (
              <button key={s.id} type="button" style={subjectChip} onClick={() => onPick(s)}>
                <span style={{ ...dot, background: (s as { color: string }).color }} aria-hidden />
                <span style={{ fontWeight: 800 }}>{s.label}</span>
              </button>
            ))}
          </div>
        </div>
      ) : null}

      {grades.length > 0 ? (
        <div style={{ display: "grid", gap: 7 }}>
          <div style={groupHeader}>Grades</div>
          <div style={chipWrap}>
            {grades.map((s) => (
              <button key={s.id} type="button" style={subjectChip} onClick={() => onPick(s)}>
                🧗 <span style={{ fontWeight: 800 }}>{s.label}</span>
              </button>
            ))}
          </div>
        </div>
      ) : null}

      {families.length > 0 ? (
        <div style={{ display: "grid", gap: 7 }}>
          <div style={groupHeader}>Activities</div>
          <div style={rowList}>
            {families.map((s) => (
              <SubjectRow key={s.id} subject={s} onPick={() => onPick(s)} />
            ))}
          </div>
        </div>
      ) : null}

      {routines.length > 0 ? (
        <div style={{ display: "grid", gap: 7 }}>
          <div style={groupHeader}>Routines</div>
          <div style={rowList}>
            {routines.slice(0, VISIBLE).map((s) => (
              <SubjectRow key={s.id} subject={s} onPick={() => onPick(s)} />
            ))}
          </div>
          {routines.length > VISIBLE ? (
            <button type="button" style={quietLink} onClick={() => onFocusSearch(`Search ${routines.length} routines…`)}>
              Search all {routines.length} routines…
            </button>
          ) : null}
        </div>
      ) : null}

      {exercises.length > 0 ? (
        <div style={{ display: "grid", gap: 7 }}>
          <div style={groupHeader}>Exercises</div>
          <div style={rowList}>
            {exercises.slice(0, VISIBLE).map((s) => (
              <SubjectRow key={s.id} subject={s} onPick={() => onPick(s)} />
            ))}
          </div>
          {exercises.length > VISIBLE ? (
            <button type="button" style={quietLink} onClick={() => onFocusSearch(`Search ${exercises.length} exercises…`)}>
              Search all {exercises.length} exercises…
            </button>
          ) : null}
        </div>
      ) : null}

      {intent === "habit" ? (
        <button type="button" style={mixChip} onClick={onMixOfRoutines}>
          🔗 A mix of routines → <span style={rowSub}>build a custom group</span>
        </button>
      ) : null}
    </div>
  );
}

// ── The habit pane — every habit ends here ─────────────────────────────────

function HabitPane({
  subject,
  options,
  createAction,
  createFrequencyAction,
  onBack,
  onSaved,
  onCompletionInstead,
}: {
  subject: Subject;
  options: GoalFormOptions;
  createAction: (formData: FormData) => void | Promise<void>;
  createFrequencyAction: (formData: FormData) => void | Promise<void>;
  onBack: () => void;
  onSaved: (info: SavedInfo) => void;
  onCompletionInstead?: () => void;
}) {
  const [count, setCount] = useState(subject.kind === "sport" ? "2" : "3");
  const [unit, setUnit] = useState<"DAY" | "WEEK" | "MONTH">("WEEK");
  // Sport goals come in two flavors — doing the sport vs training for it.
  const [sportMode, setSportMode] = useState<"sessions" | "training">("sessions");
  const [aim, setAim] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const accent = "color" in subject ? subject.color : "rgba(147,197,253,0.9)";
  const unitWord = unit === "DAY" ? "day" : unit === "WEEK" ? "week" : "month";
  const parsedCount = Math.floor(Number(count));
  const countOk = Number.isFinite(parsedCount) && parsedCount >= 1;

  // Live "what would count" preview — the anti-landmine. Shows the matcher's
  // last-7-days view of this subject BEFORE the goal exists.
  const preview = useMemo(() => {
    if (subject.kind === "domain") return options.recentCounts.domains[subject.id] ?? null;
    if (subject.kind === "sport" && sportMode === "training")
      return options.recentCounts.sports[subject.slug] ?? { count: 0, names: [] };
    if (subject.kind === "sport") return options.recentCounts.sports[subject.slug] ?? null;
    if (subject.kind === "family") return options.recentCounts.families[subject.id] ?? null;
    return null;
  }, [subject, sportMode, options.recentCounts]);

  // Gentle overlap note — informational, never blocking.
  const overlap = useMemo(() => {
    const goals = options.activeFrequencyGoals;
    if (subject.kind === "domain") {
      return goals.find((g) => g.targetDomain === subject.id || g.targetDomain === "any") ?? null;
    }
    if (subject.kind === "sport") {
      return goals.find((g) => g.sports.includes(subject.slug) || g.routineIds.includes(subject.id)) ?? null;
    }
    if (subject.kind === "family") {
      return goals.find((g) => g.familyIds.includes(subject.id) || g.targetDomain === "cardio" || g.targetDomain === "any") ?? null;
    }
    if (subject.kind === "activityType") {
      return goals.find((g) => g.typeIds.includes(subject.id) || g.familyIds.includes(subject.familyId)) ?? null;
    }
    if (subject.kind === "routine") {
      return goals.find((g) => g.id !== `fg_${subject.id}` && g.routineIds.includes(subject.id)) ?? null;
    }
    return null;
  }, [subject, options.activeFrequencyGoals]);

  function save() {
    if (!countOk) {
      setError("Set how many times (1 or more).");
      return;
    }
    setError(null);
    const name = `${subject.label} ${parsedCount}×/${unitWord}`;
    const where =
      subject.kind === "domain"
        ? DOMAIN_HUB[subject.id]
          ? `Home → Goals and ${DOMAIN_HUB[subject.id]}`
          : "Home → Goals"
        : subject.kind === "sport"
        ? `Home → Goals and the ${subject.label} page`
        : subject.kind === "family" || subject.kind === "activityType"
        ? "Home → Goals and the Endurance page"
        : "Home → Goals";

    startTransition(async () => {
      try {
        if (subject.kind === "routine") {
          // Per-routine habits post through createGoal, which routes to the
          // canonical fg_<routineId> record.
          const fd = new FormData();
          fd.set("goalType", "FREQUENCY");
          fd.set("targetType", "ROUTINE");
          fd.set("metricType", "SESSIONS");
          fd.set("targetId", subject.id);
          fd.set("timeframe", unit);
          fd.set("targetValue", String(parsedCount));
          fd.set("noRedirect", "1");
          await createAction(fd);
          onSaved({ name: `${subject.label} ${parsedCount}×/${unitWord}`, where });
          return;
        }
        const fd = new FormData();
        fd.set("name", name);
        fd.set("targetCount", String(parsedCount));
        fd.set("targetInterval", "1");
        fd.set("targetUnit", unit);
        fd.set("noRedirect", "1");
        if (subject.kind === "domain") fd.set("targetDomain", subject.id);
        if (subject.kind === "sport" && sportMode === "sessions") fd.append("routineIds", subject.id);
        if (subject.kind === "sport" && sportMode === "training") fd.append("triggerSupportedSports", subject.slug);
        if (subject.kind === "family") fd.append("triggerActivityFamilyIds", subject.id);
        if (subject.kind === "activityType") fd.append("triggerActivityTypeIds", subject.id);
        if (subject.kind === "template") {
          // Session-template habits live on the Goal table.
          const goalFd = new FormData();
          goalFd.set("name", name);
          goalFd.set("goalType", "FREQUENCY");
          goalFd.set("targetType", "SESSION_TEMPLATE");
          goalFd.set("targetId", subject.id);
          goalFd.set("metricType", "SESSIONS");
          goalFd.set("timeframe", unit);
          goalFd.set("targetValue", String(parsedCount));
          goalFd.set("startDate", localTodayYmd());
          goalFd.set("isActive", "on");
          goalFd.set("noRedirect", "1");
          await createAction(goalFd);
          onSaved({ name, where });
          return;
        }
        if (subject.kind === "exercise") {
          fd.append("triggerExerciseIds", subject.id);
          if (aim.trim()) fd.set("sessionAim", aim.trim());
        }
        await createFrequencyAction(fd);
        onSaved({ name, where });
      } catch (err) {
        setError(err instanceof Error && err.message ? err.message : "Couldn't save. Please try again.");
      }
    });
  }

  const sentence = `${subject.label} · ${countOk ? parsedCount : "?"}× per ${unitWord}`;

  return (
    <div style={{ display: "grid", gap: 14 }}>
      <button type="button" onClick={onBack} style={backLink}>
        ‹ Back
      </button>

      {/* Live sentence — the goal IS the preview. */}
      <div style={{ ...stageTitle, display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{ ...dot, width: 10, height: 10, background: accent }} aria-hidden />
        {sentence}
      </div>

      {subject.kind === "sport" ? (
        <div style={chipWrap}>
          <button
            type="button"
            style={sportMode === "sessions" ? { ...modeChip, ...modeChipOn } : modeChip}
            onClick={() => setSportMode("sessions")}
          >
            Sessions of {subject.label}
          </button>
          <button
            type="button"
            style={sportMode === "training" ? { ...modeChip, ...modeChipOn } : modeChip}
            onClick={() => setSportMode("training")}
          >
            Training for {subject.label}
          </button>
        </div>
      ) : null}

      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <div style={stepperWrap}>
          <button
            type="button"
            style={stepBtn}
            aria-label="Fewer"
            onClick={() => setCount(String(Math.max(1, (countOk ? parsedCount : 3) - 1)))}
          >
            −
          </button>
          <input
            value={count}
            onChange={(e) => setCount(e.target.value)}
            inputMode="numeric"
            style={stepInput}
            aria-label="Times per period"
          />
          <button
            type="button"
            style={stepBtn}
            aria-label="More"
            onClick={() => setCount(String((countOk ? parsedCount : 2) + 1))}
          >
            +
          </button>
        </div>
        <span style={{ fontSize: 13, fontWeight: 800, opacity: 0.7 }}>per</span>
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

      {subject.kind === "exercise" ? (
        <div style={{ display: "grid", gap: 5 }}>
          <label style={aimLabel}>
            Aiming for about{" "}
            <input
              value={aim}
              onChange={(e) => setAim(e.target.value)}
              inputMode="numeric"
              placeholder="30"
              style={aimInput}
              aria-label="Per-session aim"
            />{" "}
            per session <span style={{ opacity: 0.55 }}>(optional)</span>
          </label>
          <div style={groupHint}>Sessions always count — the aim just shows on each one (e.g. 20/30).</div>
        </div>
      ) : null}

      {preview ? (
        <div style={previewNote}>
          {preview.count > 0 ? (
            <>
              Counted last 7 days: <strong>{preview.names.join(", ")}</strong> — {preview.count} session
              {preview.count === 1 ? "" : "s"} ✓
            </>
          ) : (
            <>Nothing in the last 7 days would have counted yet — that&apos;s okay, it starts now.</>
          )}
        </div>
      ) : null}

      {overlap ? (
        <div style={overlapNote}>
          Overlaps “{overlap.name}” — sessions can count toward both.
        </div>
      ) : null}

      {subject.kind === "routine" ? (
        <div style={groupHint}>
          This becomes the routine&apos;s frequency goal — weekday scheduling and substitutes live on the
          routine&apos;s edit page.
        </div>
      ) : null}

      {error ? <div style={errorNote} role="alert">{error}</div> : null}

      <button type="button" onClick={save} disabled={pending} style={savePrimary}>
        {pending ? "Saving…" : "Save Goal"}
      </button>

      {onCompletionInstead ? (
        <button type="button" style={quietLink} onClick={onCompletionInstead}>
          Want a one-time “complete it N times” goal instead? →
        </button>
      ) : null}
    </div>
  );
}

// ── Catalog + quick start ───────────────────────────────────────────────────

function buildCatalog(options: GoalFormOptions): Subject[] {
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
  const routineRank = new Map(options.recentRoutineIds.map((id, i) => [id, i]));
  const exerciseRank = new Map(options.recentExerciseIds.map((id, i) => [id, i]));

  const sports: Subject[] = options.sportTargets.map((s) => ({
    kind: "sport",
    id: s.id,
    slug: s.slug,
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
    familyId: t.familyId,
    familyName: t.familyName,
  }));
  const routines: Subject[] = options.routines
    .map((r): Subject => ({
      kind: "routine",
      id: r.id,
      label: r.label,
      sub: r.subtitle ?? undefined,
      hasMetrics: gradeRoutineIds.has(r.id),
    }))
    .sort((a, b) => (routineRank.get(a.id) ?? 9999) - (routineRank.get(b.id) ?? 9999));
  const exercises: Subject[] = options.exercises
    .map((e): Subject => ({ kind: "exercise", id: e.id, label: e.label }))
    .sort((a, b) => (exerciseRank.get(a.id) ?? 9999) - (exerciseRank.get(b.id) ?? 9999));
  const grades: Subject[] = [
    ...options.routines
      .filter((r) => gradeRoutineIds.has(r.id))
      .map((r): Subject => ({ kind: "grade", id: r.id, label: r.label, isTemplate: false })),
    ...options.sessionTemplates
      .filter((t) => gradeTemplateIds.has(t.id))
      .map((t): Subject => ({ kind: "grade", id: t.id, label: t.label, isTemplate: true })),
  ];
  // Session templates stay searchable but never render as a browse group —
  // Grades already covers the metric-carrying ones (dedupe).
  const templates: Subject[] = options.sessionTemplates
    .filter((t) => !gradeTemplateIds.has(t.id))
    .map((t) => ({ kind: "template", id: t.id, label: t.label }));

  return [...DOMAIN_SUBJECTS, ...sports, ...families, ...types, ...routines, ...exercises, ...grades, ...templates];
}

function buildQuickStart(
  subjects: Subject[],
  options: GoalFormOptions
): Array<{ key: string; label: string; subject: Subject }> {
  const chips: Array<{ key: string; label: string; subject: Subject }> = [];
  // Top domain by last-7-days activity (skip "any" — it's a fallback, not a suggestion).
  const topDomain = Object.entries(options.recentCounts.domains)
    .filter(([key]) => key !== "any")
    .sort((a, b) => b[1].count - a[1].count)[0];
  if (topDomain) {
    const s = subjects.find((x) => x.kind === "domain" && x.id === topDomain[0]);
    if (s) chips.push({ key: `d-${s.id}`, label: `${s.label} 3×/week`, subject: s });
  }
  // Top sports by recent activity, then any remaining sports.
  const sportsByActivity = subjects
    .filter((s): s is Extract<Subject, { kind: "sport" }> => s.kind === "sport")
    .sort(
      (a, b) =>
        (options.recentCounts.sports[b.slug]?.count ?? 0) - (options.recentCounts.sports[a.slug]?.count ?? 0)
    );
  for (const s of sportsByActivity.slice(0, 2)) {
    chips.push({ key: `s-${s.id}`, label: `${s.label} 2×/week`, subject: s });
  }
  // Top endurance family by recent activity.
  const topFamily = Object.entries(options.recentCounts.families).sort((a, b) => b[1].count - a[1].count)[0];
  if (topFamily) {
    const s = subjects.find((x) => x.kind === "family" && x.id === topFamily[0]);
    if (s) chips.push({ key: `f-${s.id}`, label: `${s.label} 3×/week`, subject: s });
  }
  return chips.slice(0, 4);
}

// ── Styles ──────────────────────────────────────────────────────────────────

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

const groupHint: CSSProperties = { fontSize: 11.5, opacity: 0.55, fontWeight: 600, lineHeight: 1.45 };

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

const galleryChipQuiet: CSSProperties = {
  ...subjectChip,
  fontWeight: 800,
  opacity: 0.85,
};

const mixChip: CSSProperties = {
  ...subjectChip,
  justifySelf: "start",
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

const rowLabel: CSSProperties = {
  fontWeight: 800,
  minWidth: 0,
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
};

const rowSub: CSSProperties = { fontSize: 11, opacity: 0.55, fontWeight: 700, flexShrink: 0, marginLeft: "auto" };

const dot: CSSProperties = { width: 9, height: 9, borderRadius: 999, flexShrink: 0 };

const intentTile: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 12,
  padding: "14px 16px",
  borderRadius: 14,
  border: "1px solid rgba(255,255,255,0.12)",
  background: "rgba(255,255,255,0.035)",
  color: "inherit",
  cursor: "pointer",
  minHeight: 64,
  width: "100%",
};

const intentLabel: CSSProperties = { fontSize: 15, fontWeight: 900 };
const intentTagline: CSSProperties = { fontSize: 12, opacity: 0.6, fontWeight: 700 };

const quietLink: CSSProperties = {
  justifySelf: "start",
  border: "none",
  background: "none",
  padding: "6px 0",
  color: "rgba(147,197,253,0.85)",
  fontSize: 12.5,
  fontWeight: 800,
  cursor: "pointer",
};

const inlineLink: CSSProperties = {
  border: "none",
  background: "none",
  padding: 0,
  color: "rgba(147,197,253,0.9)",
  fontSize: "inherit",
  fontWeight: 800,
  cursor: "pointer",
};

const emptyNote: CSSProperties = { fontSize: 12.5, opacity: 0.7, lineHeight: 1.5, padding: "6px 2px" };

const stepperWrap: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
};

const stepBtn: CSSProperties = {
  width: 44,
  height: 44,
  borderRadius: 12,
  border: "1px solid rgba(255,255,255,0.16)",
  background: "rgba(255,255,255,0.05)",
  color: "inherit",
  fontSize: 20,
  fontWeight: 900,
  cursor: "pointer",
  lineHeight: 1,
};

const stepInput: CSSProperties = {
  width: 64,
  height: 44,
  padding: "0 8px",
  borderRadius: 12,
  border: "1px solid rgba(255,255,255,0.16)",
  background: "#111827",
  color: "#fff",
  fontSize: 18,
  fontWeight: 900,
  textAlign: "center",
};

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

const modeChip: CSSProperties = {
  padding: "9px 13px",
  borderRadius: 999,
  border: "1px solid rgba(255,255,255,0.14)",
  background: "transparent",
  color: "inherit",
  cursor: "pointer",
  fontSize: 12.5,
  fontWeight: 800,
  minHeight: 40,
};

const modeChipOn: CSSProperties = {
  background: "rgba(147,197,253,0.16)",
  borderColor: "rgba(147,197,253,0.5)",
};

const aimLabel: CSSProperties = {
  fontSize: 13,
  fontWeight: 700,
  display: "flex",
  alignItems: "center",
  gap: 6,
  flexWrap: "wrap",
};

const aimInput: CSSProperties = {
  width: 64,
  padding: "8px 10px",
  borderRadius: 10,
  border: "1px solid rgba(255,255,255,0.16)",
  background: "#111827",
  color: "#fff",
  fontSize: 16,
  fontWeight: 800,
  textAlign: "center",
};

const previewNote: CSSProperties = {
  fontSize: 12.5,
  lineHeight: 1.5,
  padding: "10px 12px",
  borderRadius: 12,
  border: "1px solid rgba(74,222,128,0.22)",
  background: "rgba(74,222,128,0.05)",
  color: "rgba(220,252,231,0.9)",
};

const overlapNote: CSSProperties = {
  fontSize: 12,
  lineHeight: 1.5,
  padding: "8px 12px",
  borderRadius: 12,
  border: "1px dashed rgba(251,191,36,0.35)",
  background: "rgba(251,191,36,0.05)",
  color: "rgba(253,230,138,0.85)",
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

const savedBody: CSSProperties = {
  fontSize: 13.5,
  lineHeight: 1.6,
  opacity: 0.85,
};

"use client";

import { useEffect, useMemo, useState, type CSSProperties, type ReactNode } from "react";
import Link from "next/link";
import { createProgramAssessment } from "@/app/programs/actions";
import type { InitialProgramAssessment } from "@/app/focus/actions";
import { programSportMetricOptions, type ProgramSportMetricOption } from "@/lib/program-sport-metrics";
import type { ProgramAssessmentSuggestion } from "@/app/programs/assessment-suggestions";
import { ASSESSMENT_DIRECTIONS, type AssessmentDirection } from "@/app/programs/assessment-directions";

type SourceKind = "sport" | "exercise" | "body" | "recovery" | "manual";
type Direction = AssessmentDirection;
type MetricKind = "NUMBER" | "RATIO" | "DURATION" | "GRADE" | "PAIN" | "BODY_WEIGHT" | "BODY_FAT" | "WAIST" | "TEXT";

type MetricOption = Omit<ProgramSportMetricOption, "metricKind"> & { metricKind: MetricKind };

type ExerciseOption = {
  id: string;
  name: string;
  unit: string;
  supportsWeight: boolean;
  supportsSports: string[];
};

type SessionMetricOption = {
  id: string;
  label: string;
  unit: string | null;
  valueType: "INTEGER" | "DECIMAL" | "TEXT" | "BOOLEAN";
  templateName: string;
};

export type DraftProgramAssessment = InitialProgramAssessment;

const SOURCES: Array<{ id: SourceKind; label: string; description: string }> = [
  { id: "sport", label: "Sport metric", description: "Grade, score, drill, pace, or session measure" },
  { id: "exercise", label: "Exercise", description: "Load, reps, hold time, or volume" },
  { id: "body", label: "Body measure", description: "Bodyweight, waist, or body fat" },
  { id: "recovery", label: "Recovery", description: "Pain, symptoms, or a capacity test" },
  { id: "manual", label: "Custom test", description: "Anything repeatable that is not logged elsewhere" },
];

export default function AssessmentBuilder({
  programId,
  pursuitKey,
  objectiveKind,
  exercises,
  injuries,
  sessionMetrics,
  suggestions,
  draft = false,
  onDraftChange,
}: {
  programId: string;
  pursuitKey: string;
  objectiveKind: string;
  exercises: ExerciseOption[];
  injuries: Array<{ id: string; name: string }>;
  sessionMetrics: SessionMetricOption[];
  suggestions: ProgramAssessmentSuggestion[];
  draft?: boolean;
  onDraftChange?: (assessment: DraftProgramAssessment) => void;
}) {
  const initialSource: SourceKind = objectiveKind === "BODY_COMPOSITION" ? "body" : objectiveKind === "RECOVERY" ? "recovery" : objectiveKind === "STRENGTH" ? "exercise" : "sport";
  const [source, setSource] = useState<SourceKind>(initialSource);
  const sportOptions = useMemo(() => sportMetricOptions(pursuitKey, sessionMetrics), [pursuitKey, sessionMetrics]);
  const orderedExercises = useMemo(() => [...exercises].sort((a, b) => {
    const aRelevant = pursuitKey && a.supportsSports.includes(pursuitKey) ? 1 : 0;
    const bRelevant = pursuitKey && b.supportsSports.includes(pursuitKey) ? 1 : 0;
    return bRelevant - aRelevant || a.name.localeCompare(b.name);
  }), [exercises, pursuitKey]);
  const [sportMetricKey, setSportMetricKey] = useState(sportOptions[0]?.key ?? "sport:manual:level");
  const [exerciseId, setExerciseId] = useState(orderedExercises[0]?.id ?? "");
  const [exerciseMeasure, setExerciseMeasure] = useState("max_load");
  const [bodyMeasure, setBodyMeasure] = useState("body_weight");
  const [injuryId, setInjuryId] = useState(injuries[0]?.id ?? "");
  const [recoveryMeasure, setRecoveryMeasure] = useState("pain");
  const [customName, setCustomName] = useState("");
  const [customKind, setCustomKind] = useState<MetricKind>("NUMBER");
  const [customUnit, setCustomUnit] = useState("");
  const [targetNumberValue, setTargetNumberValue] = useState("");
  const [targetNumerator, setTargetNumerator] = useState("");
  const [targetDenominator, setTargetDenominator] = useState("");
  const [targetTextValue, setTargetTextValue] = useState("");
  const [directionOverride, setDirectionOverride] = useState<Direction | null>(null);
  const [baselineNumberValue, setBaselineNumberValue] = useState("");
  const [baselineNumerator, setBaselineNumerator] = useState("");
  const [baselineDenominator, setBaselineDenominator] = useState("");
  const [baselineTextValue, setBaselineTextValue] = useState("");
  const [baselineYmd, setBaselineYmd] = useState("");
  const [baselineSource, setBaselineSource] = useState<InitialProgramAssessment["baselineSource"]>("MANUAL");
  const [baselineSourceRefId, setBaselineSourceRefId] = useState("");
  const [checkpointIntervalWeeks, setCheckpointIntervalWeeks] = useState("");

  const selectedExercise = exercises.find((exercise) => exercise.id === exerciseId) ?? null;
  const resolvedExerciseMeasure = selectedExercise && !selectedExercise.supportsWeight && ["max_load", "working_load", "volume"].includes(exerciseMeasure)
    ? (selectedExercise.unit === "TIME" ? "duration" : "max_reps")
    : exerciseMeasure;
  const definition = assessmentDefinition({
    source,
    sportOptions,
    sportMetricKey,
    selectedExercise,
    exerciseMeasure: resolvedExerciseMeasure,
    bodyMeasure,
    injury: injuries.find((injury) => injury.id === injuryId) ?? null,
    recoveryMeasure,
    customName,
    customKind,
    customUnit,
  });
  const suggestion = suggestions.find((candidate) => candidate.metricKey === definition.metricKey) ?? null;
  const direction: Direction = directionOverride ?? definition.direction;

  // Each metric carries its own sensible direction, so a manual choice only
  // applies to the metric it was made for.
  useEffect(() => { setDirectionOverride(null); }, [definition.metricKey]);

  function clearSuggestionSource() {
    setBaselineSource("MANUAL");
    setBaselineSourceRefId("");
  }

  function applySuggestion(candidate: ProgramAssessmentSuggestion) {
    setBaselineNumberValue(candidate.numberValue == null ? "" : String(candidate.numberValue));
    setBaselineNumerator(candidate.numerator == null ? "" : String(candidate.numerator));
    setBaselineDenominator(candidate.denominator == null ? "" : String(candidate.denominator));
    setBaselineTextValue(candidate.textValue ?? "");
    setBaselineYmd(candidate.measuredYmd);
    setBaselineSource(candidate.source);
    setBaselineSourceRefId(candidate.sourceRefId);
  }

  useEffect(() => {
    onDraftChange?.({
      name: definition.name,
      metricKind: definition.metricKind,
      metricKey: definition.metricKey,
      unit: definition.unit,
      direction,
      checkpointIntervalWeeks,
      targetNumberValue,
      targetNumerator,
      targetDenominator,
      targetTextValue,
      baselineNumberValue,
      baselineNumerator,
      baselineDenominator,
      baselineTextValue,
      baselineYmd,
      baselineSource,
      baselineSourceRefId,
    });
  }, [
    onDraftChange,
    definition.name,
    definition.metricKind,
    definition.metricKey,
    definition.unit,
    direction,
    checkpointIntervalWeeks,
    targetNumberValue,
    targetNumerator,
    targetDenominator,
    targetTextValue,
    baselineNumberValue,
    baselineNumerator,
    baselineDenominator,
    baselineTextValue,
    baselineYmd,
    baselineSource,
    baselineSourceRefId,
  ]);

  return (
    <form action={draft ? undefined : createProgramAssessment} onSubmit={draft ? (event) => event.preventDefault() : undefined} style={form}>
      <input type="hidden" name="programId" value={programId} />
      <input type="hidden" name="name" value={definition.name} />
      <input type="hidden" name="metricKind" value={definition.metricKind} />
      <input type="hidden" name="metricKey" value={definition.metricKey} />
      <input type="hidden" name="unit" value={definition.unit} />
      <input type="hidden" name="direction" value={direction} />
      <input type="hidden" name="baselineSource" value={baselineSource} />
      <input type="hidden" name="baselineSourceRefId" value={baselineSourceRefId} />

      <div>
        <div style={fieldTitle}>What are you assessing?</div>
        <div className="assessmentSourceGrid" style={sourceGrid}>
          {SOURCES.map((option) => {
            const selected = source === option.id;
            return (
              <button
                key={option.id}
                type="button"
                aria-pressed={selected}
                onClick={() => setSource(option.id)}
                style={{ ...sourceButton, ...(selected ? selectedSource : {}) }}
              >
                <strong style={{ color: selected ? "#fff" : "rgba(255,255,255,0.78)" }}>{option.label}</strong>
                <span style={sourceDescription}>{option.description}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div style={configuration}>
        {source === "sport" ? (
          <Labeled
            label={pursuitKey ? `${titleCase(pursuitKey)} metric` : "Sport metric"}
            hint={sportOptions.find((option) => option.key === sportMetricKey)?.description ?? "Use the same test or conditions at each checkpoint."}
          >
            <select value={sportMetricKey} onChange={(event) => setSportMetricKey(event.target.value)} style={input}>
              {sportOptions.map((option) => <option key={option.key} value={option.key}>{option.label}</option>)}
            </select>
          </Labeled>
        ) : null}

        {source === "exercise" ? (
          <div className="assessmentConfigGrid" style={twoColumn}>
            <Labeled label="Exercise">
              <select value={exerciseId} onChange={(event) => {
                const nextId = event.target.value;
                const next = exercises.find((exercise) => exercise.id === nextId);
                setExerciseId(nextId);
                if (next && !next.supportsWeight) setExerciseMeasure(next.unit === "TIME" ? "duration" : "max_reps");
              }} style={input}>
                <option value="">Choose an exercise</option>
                {orderedExercises.map((exercise) => <option key={exercise.id} value={exercise.id}>{exercise.name}</option>)}
              </select>
            </Labeled>
            <Labeled label="Measure">
              <select value={resolvedExerciseMeasure} onChange={(event) => setExerciseMeasure(event.target.value)} style={input}>
                {selectedExercise?.supportsWeight ? <><option value="max_load">Heaviest load</option><option value="working_load">Working load</option><option value="volume">Session volume</option></> : null}
                <option value="max_reps">Maximum reps</option>
                <option value="duration">Hold or work duration</option>
              </select>
            </Labeled>
          </div>
        ) : null}

        {source === "body" ? (
          <Labeled label="Body measurement" hint="Saved as a program checkpoint; the source measurement remains independent.">
            <select value={bodyMeasure} onChange={(event) => setBodyMeasure(event.target.value)} style={input}>
              <option value="body_weight">Bodyweight</option>
              <option value="waist">Waist circumference</option>
              <option value="body_fat">Body fat estimate</option>
            </select>
          </Labeled>
        ) : null}

        {source === "recovery" ? (
          <div className="assessmentConfigGrid" style={twoColumn}>
            <Labeled label="Injury or concern">
              <select value={injuryId} onChange={(event) => setInjuryId(event.target.value)} style={input}>
                <option value="">General recovery</option>
                {injuries.map((injury) => <option key={injury.id} value={injury.id}>{injury.name}</option>)}
              </select>
            </Labeled>
            <Labeled label="Measure">
              <select value={recoveryMeasure} onChange={(event) => setRecoveryMeasure(event.target.value)} style={input}>
                <option value="pain">Pain level</option>
                <option value="capacity">Repeatable capacity test</option>
                <option value="symptoms">Symptom description</option>
              </select>
            </Labeled>
          </div>
        ) : null}

        {source === "manual" ? (
          <div className="assessmentConfigGrid" style={manualGrid}>
            <Labeled label="Assessment name"><input value={customName} onChange={(event) => setCustomName(event.target.value)} placeholder="e.g. Standing broad jump" style={input} /></Labeled>
            <Labeled label="Result type">
              <select value={customKind} onChange={(event) => setCustomKind(event.target.value as MetricKind)} style={input}>
                <option value="NUMBER">Number</option><option value="RATIO">Made / attempted</option><option value="DURATION">Duration</option><option value="GRADE">Grade or level</option><option value="TEXT">Text result</option>
              </select>
            </Labeled>
            <Labeled label="Unit"><input value={customUnit} onChange={(event) => setCustomUnit(event.target.value)} placeholder="lb, sec, %, points" style={input} /></Labeled>
          </div>
        ) : null}
      </div>

      <div style={baselinePanel}>
        <div style={baselineHeading}>
          <div><strong style={{ display: "block", fontSize: 13 }}>Where you are now</strong><span style={hint}>Optional. Save it now, or let the first repeatable test establish the baseline.</span></div>
          <span style={metricChip}>{definition.name || "Choose a measure"}</span>
        </div>
        {suggestion ? (
          <div style={suggestionPanel}>
            <div style={{ minWidth: 0 }}>
              <span style={suggestionEyebrow}>Suggested from your history</span>
              <strong style={suggestionValue}>{formatSuggestionValue(suggestion, definition.unit)}</strong>
              <span style={suggestionMeta}>{suggestion.sourceLabel} · {formatYmd(suggestion.measuredYmd)}</span>
            </div>
            <div style={suggestionActions}>
              {suggestion.sourceHref ? <Link href={suggestion.sourceHref} style={sourceLink}>View log</Link> : null}
              <button type="button" onClick={() => applySuggestion(suggestion)} style={useSuggestionButton}>
                {baselineSourceRefId === suggestion.sourceRefId ? "Using this" : "Use result"}
              </button>
            </div>
          </div>
        ) : source === "sport" ? (
          <div style={noSuggestion}>No matching result was found in your logs for this metric. Enter it manually or let the first checkpoint establish it.</div>
        ) : null}
        <div className="assessmentBaselineGrid" style={baselineGrid}>
          {definition.metricKind === "RATIO" ? (
            <><Labeled label="Made"><input name="baselineNumerator" type="number" step="any" value={baselineNumerator} onChange={(event) => { setBaselineNumerator(event.target.value); clearSuggestionSource(); }} style={input} /></Labeled><Labeled label="Attempted"><input name="baselineDenominator" type="number" step="any" value={baselineDenominator} onChange={(event) => { setBaselineDenominator(event.target.value); clearSuggestionSource(); }} style={input} /></Labeled></>
          ) : definition.metricKind === "TEXT" || definition.metricKind === "GRADE" ? (
            <Labeled label="Result"><input name="baselineTextValue" value={baselineTextValue} onChange={(event) => { setBaselineTextValue(event.target.value); clearSuggestionSource(); }} placeholder={definition.metricKind === "GRADE" ? "e.g. V3" : "Current result"} style={input} /></Labeled>
          ) : (
            <Labeled label={`Result${definition.unit ? ` (${definition.unit})` : ""}`}><input name="baselineNumberValue" type="number" step="any" value={baselineNumberValue} onChange={(event) => { setBaselineNumberValue(event.target.value); clearSuggestionSource(); }} style={input} /></Labeled>
          )}
          <Labeled label="Measured on" hint={baselineSourceRefId ? "Filled from the source log; edit to make it manual." : undefined}><input name="baselineYmd" type="date" value={baselineYmd} onChange={(event) => { setBaselineYmd(event.target.value); clearSuggestionSource(); }} style={input} /></Labeled>
        </div>
      </div>

      <div style={targetPanel}>
        <div style={baselineHeading}>
          <div>
            <strong style={{ display: "block", fontSize: 13 }}>Where you&rsquo;re going</strong>
            <span style={hint}>Optional, but this is what turns a reading into progress. Leave it blank to only keep the history.</span>
          </div>
        </div>
        <div className="assessmentBaselineGrid" style={baselineGrid}>
          {definition.metricKind === "RATIO" ? (
            <>
              <Labeled label="Target made"><input name="targetNumerator" type="number" step="any" value={targetNumerator} onChange={(event) => setTargetNumerator(event.target.value)} style={input} /></Labeled>
              <Labeled label="Out of"><input name="targetDenominator" type="number" step="any" value={targetDenominator} onChange={(event) => setTargetDenominator(event.target.value)} style={input} /></Labeled>
            </>
          ) : definition.metricKind === "TEXT" || definition.metricKind === "GRADE" ? (
            <Labeled label="Target"><input name="targetTextValue" value={targetTextValue} onChange={(event) => setTargetTextValue(event.target.value)} placeholder={definition.metricKind === "GRADE" ? "e.g. V5" : "Target result"} style={input} /></Labeled>
          ) : (
            <Labeled label={`Target${definition.unit ? ` (${definition.unit})` : ""}`}><input name="targetNumberValue" type="number" step="any" value={targetNumberValue} onChange={(event) => setTargetNumberValue(event.target.value)} style={input} /></Labeled>
          )}
          <Labeled label="Repeat the test">
            <select name="checkpointIntervalWeeks" value={checkpointIntervalWeeks} onChange={(event) => setCheckpointIntervalWeeks(event.target.value)} style={input}>
              <option value="">At stage changes</option><option value="2">Every 2 weeks</option><option value="4">Every 4 weeks</option><option value="6">Every 6 weeks</option><option value="8">Every 8 weeks</option><option value="12">Every 12 weeks</option>
            </select>
          </Labeled>
        </div>
        <div>
          <div style={fieldTitle}>Which way is progress?</div>
          <div className="assessmentDirectionGrid" style={directionGrid}>
            {ASSESSMENT_DIRECTIONS.map((option) => {
              const selected = direction === option.id;
              return (
                <button
                  key={option.id}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => setDirectionOverride(option.id)}
                  style={{ ...directionButton, ...(selected ? selectedSource : {}) }}
                >
                  <strong style={{ color: selected ? "#fff" : "rgba(255,255,255,0.78)" }}>{option.label}</strong>
                  <span style={sourceDescription}>{option.hint}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {!draft ? <button type="submit" disabled={!definition.name.trim()} style={{ ...submit, opacity: definition.name.trim() ? 1 : 0.45 }}>Add assessment</button> : null}
      <style>{`
        @media (max-width: 680px) {
          .assessmentSourceGrid, .assessmentDirectionGrid { grid-template-columns: repeat(2, minmax(0, 1fr)) !important; }
          .assessmentConfigGrid, .assessmentBaselineGrid { grid-template-columns: minmax(0, 1fr) !important; }
        }
      `}</style>
    </form>
  );
}

function assessmentDefinition(args: {
  source: SourceKind;
  sportOptions: MetricOption[];
  sportMetricKey: string;
  selectedExercise: ExerciseOption | null;
  exerciseMeasure: string;
  bodyMeasure: string;
  injury: { id: string; name: string } | null;
  recoveryMeasure: string;
  customName: string;
  customKind: MetricKind;
  customUnit: string;
}): MetricOption & { metricKey: string; name: string } {
  if (args.source === "sport") {
    const option = args.sportOptions.find((metric) => metric.key === args.sportMetricKey) ?? args.sportOptions[0];
    return { ...(option ?? fallbackMetric()), metricKey: option?.key ?? "sport:manual:level", name: option?.label ?? "Current sport level" };
  }
  if (args.source === "exercise") {
    const exercise = args.selectedExercise;
    const specs: Record<string, Pick<MetricOption, "label" | "metricKind" | "unit" | "direction" | "description">> = {
      max_load: { label: "Heaviest load", metricKind: "NUMBER", unit: "lb", direction: "HIGHER", description: "Heaviest completed set" },
      working_load: { label: "Working load", metricKind: "NUMBER", unit: "lb", direction: "HIGHER", description: "Repeatable training load" },
      volume: { label: "Session volume", metricKind: "NUMBER", unit: "lb", direction: "HIGHER", description: "Total load moved" },
      max_reps: { label: "Maximum reps", metricKind: "NUMBER", unit: "reps", direction: "HIGHER", description: "Best completed set" },
      duration: { label: "Hold or work duration", metricKind: "DURATION", unit: "sec", direction: "HIGHER", description: "Longest quality effort" },
    };
    const spec = specs[args.exerciseMeasure] ?? specs.max_reps;
    return { key: "", ...spec, metricKey: `exercise:${exercise?.id ?? ""}:${args.exerciseMeasure}`, name: exercise ? `${exercise.name} — ${spec.label}` : "" };
  }
  if (args.source === "body") {
    const specs = {
      body_weight: { name: "Bodyweight", metricKind: "BODY_WEIGHT" as const, unit: "lb", direction: "TARGET" as const },
      waist: { name: "Waist circumference", metricKind: "WAIST" as const, unit: "in", direction: "TARGET" as const },
      body_fat: { name: "Body fat estimate", metricKind: "BODY_FAT" as const, unit: "%", direction: "TARGET" as const },
    };
    const spec = specs[args.bodyMeasure as keyof typeof specs] ?? specs.body_weight;
    return { key: "", description: "Body measurement", metricKey: `body:${args.bodyMeasure}`, ...spec, label: spec.name };
  }
  if (args.source === "recovery") {
    const subject = args.injury?.name ?? "Recovery";
    if (args.recoveryMeasure === "pain") return { key: "", label: "Pain level", name: `${subject} — pain`, metricKind: "PAIN", metricKey: `injury:${args.injury?.id ?? "general"}:pain`, unit: "/10", direction: "LOWER", description: "Comparable pain reading" };
    if (args.recoveryMeasure === "capacity") return { key: "", label: "Capacity test", name: `${subject} — capacity test`, metricKind: "NUMBER", metricKey: `injury:${args.injury?.id ?? "general"}:capacity`, unit: "", direction: "HIGHER", description: "Repeatable capacity measure" };
    return { key: "", label: "Symptoms", name: `${subject} — symptoms`, metricKind: "TEXT", metricKey: `injury:${args.injury?.id ?? "general"}:symptoms`, unit: "", direction: "INFORMATIONAL", description: "Comparable symptom description" };
  }
  return { key: "", label: args.customName, name: args.customName, metricKind: args.customKind, metricKey: `manual:${slug(args.customName)}`, unit: args.customUnit, direction: args.customKind === "TEXT" ? "INFORMATIONAL" : "HIGHER", description: "Custom repeatable test" };
}

function sportMetricOptions(pursuitKey: string, sessionMetrics: SessionMetricOption[]): MetricOption[] {
  const slug = pursuitKey.trim().toLowerCase();
  const builtIn = programSportMetricOptions(slug);

  const defined = sessionMetrics.map((metric): MetricOption => ({
    key: `session_metric:${metric.id}`,
    label: metric.label,
    metricKind: metric.valueType === "TEXT" ? (/grade|level/i.test(metric.label) ? "GRADE" : "TEXT") : "NUMBER",
    unit: metric.unit ?? "",
    direction: /time|pace|score|attempt/i.test(metric.label) ? "LOWER" : "HIGHER",
    description: `${metric.templateName} log metric`,
  }));
  const generic: MetricOption[] = [
    { key: `sport:${slug || "general"}:drill_ratio`, label: "Repeatable drill — made / attempted", metricKind: "RATIO", unit: "", direction: "HIGHER", description: "Same setup each time" },
    { key: `sport:${slug || "general"}:score`, label: "Score or points", metricKind: "NUMBER", unit: "points", direction: "HIGHER", description: "Repeatable test or game measure" },
    { key: `sport:${slug || "general"}:time`, label: "Timed test", metricKind: "DURATION", unit: "sec", direction: "LOWER", description: "Same distance or drill" },
    { key: `sport:${slug || "general"}:level`, label: "Grade or level", metricKind: "GRADE", unit: "", direction: "HIGHER", description: "Sport-specific level" },
  ];
  const seen = new Set<string>();
  return [...builtIn, ...defined, ...(builtIn.length || defined.length ? [] : generic)]
    .filter((option) => !seen.has(option.label.toLowerCase()) && seen.add(option.label.toLowerCase()));
}

function fallbackMetric(): MetricOption { return { key: "sport:manual:level", label: "Current sport level", metricKind: "GRADE", unit: "", direction: "HIGHER", description: "Sport-specific level" }; }
function slug(value: string) { return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "assessment"; }
function titleCase(value: string) { return value.replaceAll("-", " ").replace(/\b\w/g, (letter) => letter.toUpperCase()); }

function formatSuggestionValue(suggestion: ProgramAssessmentSuggestion, unit: string) {
  if (suggestion.numerator != null && suggestion.denominator != null) return `${suggestion.numerator} / ${suggestion.denominator}`;
  if (suggestion.textValue) return suggestion.textValue;
  if (suggestion.numberValue != null) return `${suggestion.numberValue}${unit ? ` ${unit}` : ""}`;
  return "Recorded result";
}

function formatYmd(ymd: string) {
  const [year, month, day] = ymd.split("-").map(Number);
  if (!year || !month || !day) return ymd;
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" }).format(new Date(Date.UTC(year, month - 1, day)));
}

function Labeled({ label, hint: help, children }: { label: string; hint?: string; children: ReactNode }) {
  return <label style={field}><span>{label}</span>{children}{help ? <span style={hint}>{help}</span> : null}</label>;
}

const form: CSSProperties = { display: "grid", gap: 18 };
const fieldTitle: CSSProperties = { marginBottom: 8, fontSize: 12, fontWeight: 900, color: "rgba(255,255,255,0.78)" };
const sourceGrid: CSSProperties = { display: "grid", gridTemplateColumns: "repeat(5, minmax(0, 1fr))", gap: 7 };
const sourceButton: CSSProperties = { minHeight: 82, display: "grid", alignContent: "center", gap: 4, padding: "10px", borderRadius: 8, borderWidth: 1, borderStyle: "solid", borderColor: "rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.025)", color: "inherit", textAlign: "left", cursor: "pointer" };
const selectedSource: CSSProperties = { borderColor: "rgba(51,255,122,0.38)", background: "rgba(51,255,122,0.075)" };
const sourceDescription: CSSProperties = { fontSize: 10, lineHeight: 1.35, color: "rgba(255,255,255,0.43)" };
const configuration: CSSProperties = { display: "grid", gap: 10, padding: "14px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.09)", background: "rgba(255,255,255,0.02)" };
const twoColumn: CSSProperties = { display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 10 };
const manualGrid: CSSProperties = { display: "grid", gridTemplateColumns: "minmax(220px, 2fr) minmax(150px, 1fr) minmax(120px, 1fr)", gap: 10 };
const field: CSSProperties = { minWidth: 0, display: "grid", gap: 6, fontSize: 11.5, fontWeight: 800, color: "rgba(255,255,255,0.66)" };
const hint: CSSProperties = { fontSize: 10.5, fontWeight: 500, lineHeight: 1.4, color: "rgba(255,255,255,0.4)" };
const input: CSSProperties = { width: "100%", minWidth: 0, minHeight: 44, boxSizing: "border-box", padding: "9px 11px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.15)", background: "#111827", color: "#fff", fontSize: 16 };
const baselinePanel: CSSProperties = { display: "grid", gap: 12, padding: "14px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.09)" };
const targetPanel: CSSProperties = { ...baselinePanel, borderColor: "rgba(51,255,122,0.2)", background: "rgba(51,255,122,0.02)" };
const directionGrid: CSSProperties = { display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 7 };
const directionButton: CSSProperties = { ...sourceButton, minHeight: 64 };
const baselineHeading: CSSProperties = { display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, flexWrap: "wrap" };
const metricChip: CSSProperties = { maxWidth: 280, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", padding: "4px 8px", borderRadius: 6, background: "rgba(51,255,122,0.08)", color: "#7ce8aa", fontSize: 10.5, fontWeight: 850 };
const baselineGrid: CSSProperties = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(165px, 1fr))", gap: 10 };
const suggestionPanel: CSSProperties = { display: "flex", justifyContent: "space-between", alignItems: "center", gap: 14, flexWrap: "wrap", padding: "12px", borderWidth: 1, borderStyle: "solid", borderColor: "rgba(51,255,122,0.28)", borderRadius: 8, background: "rgba(51,255,122,0.055)" };
const suggestionEyebrow: CSSProperties = { display: "block", marginBottom: 3, fontSize: 9.5, fontWeight: 900, textTransform: "uppercase", color: "#7ce8aa" };
const suggestionValue: CSSProperties = { display: "block", fontSize: 16, color: "rgba(255,255,255,0.94)" };
const suggestionMeta: CSSProperties = { display: "block", marginTop: 3, fontSize: 10.5, lineHeight: 1.4, color: "rgba(255,255,255,0.52)" };
const suggestionActions: CSSProperties = { display: "flex", alignItems: "center", gap: 8, flexShrink: 0 };
const sourceLink: CSSProperties = { minHeight: 40, display: "inline-flex", alignItems: "center", padding: "0 10px", color: "rgba(255,255,255,0.66)", fontSize: 11, fontWeight: 800, textDecoration: "none" };
const useSuggestionButton: CSSProperties = { minHeight: 40, padding: "0 12px", borderWidth: 1, borderStyle: "solid", borderColor: "rgba(51,255,122,0.38)", borderRadius: 7, background: "rgba(51,255,122,0.11)", color: "#7ce8aa", fontSize: 11, fontWeight: 900, cursor: "pointer" };
const noSuggestion: CSSProperties = { padding: "10px 12px", borderRadius: 8, background: "rgba(255,255,255,0.025)", color: "rgba(255,255,255,0.48)", fontSize: 11, lineHeight: 1.45 };
const submit: CSSProperties = { justifySelf: "end", minHeight: 44, padding: "0 18px", borderRadius: 8, border: "1px solid rgba(51,255,122,0.42)", background: "rgba(51,255,122,0.12)", color: "#7ce8aa", fontWeight: 900, cursor: "pointer" };

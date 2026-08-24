"use client";

import { useState, type CSSProperties, type ReactNode } from "react";
import FocusForm, { type FocusFormInitial } from "@/app/focus/FocusForm";
import type { MilestoneFormRow } from "@/app/focus/actions";
import { activitiesByFamily } from "@/lib/activity-families";
import AssessmentBuilder, { type DraftProgramAssessment } from "@/app/programs/[id]/edit/AssessmentBuilder";
import type { ProgramAssessmentSuggestion } from "@/app/programs/assessment-suggestions";

type Pick = { id: string; name: string };
type ExercisePick = Pick & { unit: string; supportsWeight: boolean; supportsSports: string[] };
type Path = "sport" | "strength" | "endurance" | "body" | "recovery";

const PATHS: Array<{ id: Path; label: string; examples: string }> = [
  { id: "sport", label: "Improve at a sport", examples: "climbing, basketball, golf, snowboarding" },
  { id: "strength", label: "Build strength or a skill", examples: "weighted pull-up, front lever, general strength" },
  { id: "endurance", label: "Build endurance", examples: "running base, hiking capacity, race preparation" },
  { id: "body", label: "Change bodyweight", examples: "lose weight, gain weight, maintain while training" },
  { id: "recovery", label: "Recover and return", examples: "rehab, graded loading, return to sport" },
];

const SPORTS = activitiesByFamily("sports");

export default function ProgramCreator({
  routines,
  exercises,
  injuries,
  assessmentSuggestions,
}: {
  routines: Pick[];
  exercises: ExercisePick[];
  injuries: Pick[];
  assessmentSuggestions: ProgramAssessmentSuggestion[];
}) {
  const [mode, setMode] = useState<"choose" | "guided" | "manual">("choose");
  const [path, setPath] = useState<Path>("sport");
  const [name, setName] = useState("");
  const [pursuitKey, setPursuitKey] = useState("");
  const [targetDate, setTargetDate] = useState("");
  const [startingAssessment, setStartingAssessment] = useState<DraftProgramAssessment | null>(null);
  const [includeAssessment, setIncludeAssessment] = useState(true);
  const [outcomeDraft, setOutcomeDraft] = useState<MilestoneFormRow[] | null>(null);

  if (mode === "choose") {
    return (
      <div style={choiceGrid}>
        <button type="button" style={primaryChoice} onClick={() => setMode("guided")}>
          <span style={choiceTitle}>Guided setup</span>
          <span style={choiceMeta}>Build the foundation on one clear page</span>
        </button>
        <button type="button" style={secondaryChoice} onClick={() => setMode("manual")}>
          <span style={choiceTitle}>Full editor</span>
          <span style={choiceMeta}>Enter the complete roadmap directly</span>
        </button>
      </div>
    );
  }

  if (mode === "manual") {
    return (
      <div style={{ display: "grid", gap: 12 }}>
        <button type="button" style={backButton} onClick={() => setMode("choose")}>Back</button>
        <FocusForm initial={blankInitial()} routines={routines} exercises={exercises} injuries={injuries} panel="all" />
      </div>
    );
  }

  const resolvedPursuit = path === "sport" ? pursuitKey : pursuitKey.trim() || pursuitFor(path);
  const canOpenOutcomes = name.trim().length > 0 && (path !== "sport" || pursuitKey.trim().length > 0);
  const miniSteps = [
    { number: "1", id: "setup-purpose", label: "Purpose", complete: Boolean(path), meta: PATHS.find((option) => option.id === path)?.label ?? "Choose a direction" },
    { number: "2", id: "setup-details", label: "Program details", complete: canOpenOutcomes, meta: name.trim() || "Name and timeline" },
    { number: "3", id: "setup-starting-point", label: "Starting point", complete: !includeAssessment || Boolean(startingAssessment?.name.trim()), meta: includeAssessment ? assessmentSummary(startingAssessment) : "Skipped" },
    { number: "4", id: "setup-outcomes", label: "Outcomes", complete: Boolean(outcomeDraft?.some((outcome) => outcome.label.trim())), meta: outcomeDraft?.filter((outcome) => outcome.label.trim()).length ? `${outcomeDraft.filter((outcome) => outcome.label.trim()).length} defined` : "Define success" },
  ];

  function selectPath(nextPath: Path) {
    setPath(nextPath);
    setPursuitKey(nextPath === "sport" ? "" : pursuitFor(nextPath));
    setStartingAssessment(null);
    setOutcomeDraft(null);
  }

  const initial = guidedInitial(path, name, resolvedPursuit, targetDate, outcomeDraft);

  return (
    <div className="programCreatorWorkspace" style={workspace}>
      <aside className="programCreatorSidebar" style={sidebar}>
        <CreatorStageRail />
      </aside>

      <main style={canvas}>
        <section style={setupShell}>
          <header style={setupHeader}>
            <span style={panelEyebrow}>Program setup</span>
            <h2 style={setupTitle}>Define the program foundation</h2>
            <p style={panelCopy}>Set the objective, timeline, starting point, and outcomes together. After you create it, continue through training, stages, blocks, schedule, and named targets.</p>
          </header>

          <nav aria-label="Program setup sections" className="programCreatorMiniSteps" style={mobileSteps}>
          {miniSteps.map((step) => (
            <button
              key={step.id}
              type="button"
              onClick={() => document.getElementById(step.id)?.scrollIntoView({ behavior: "smooth", block: "start" })}
              style={{ ...mobileStep, ...(step.complete ? mobileStepComplete : {}) }}
            >
              <span style={miniStepNumber}>{step.complete ? "✓" : step.number}</span>
              <span style={miniStepText}><strong>{step.label}</strong><small>{step.meta}</small></span>
            </button>
          ))}
          </nav>

          <div id="setup-purpose" style={miniSection}>
          <CreatorPanel eyebrow="1 · Purpose" title="What are you training toward?" copy="Choose the kind of change this program should create.">
            <div className="programPathList" style={pathList}>
              {PATHS.map((option) => (
                <label key={option.id} style={{ ...pathRow, ...(path === option.id ? selectedPath : {}) }}>
                  <input type="radio" name="path" checked={path === option.id} onChange={() => selectPath(option.id)} />
                  <span><strong style={{ display: "block" }}>{option.label}</strong><span style={choiceMeta}>{option.examples}</span></span>
                </label>
              ))}
            </div>
          </CreatorPanel>
          </div>

          <div id="setup-details" style={miniSection}>
          <CreatorPanel eyebrow="2 · Program details" title="Define the program" copy="Give this campaign a clear name and connect it to the activity where progress belongs.">
            <div style={detailFields}>
              <label style={field}>Program name<input value={name} onChange={(event) => setName(event.target.value)} placeholder={placeholderFor(path)} style={input} /></label>
              {path === "sport" ? (
                <label style={field}>Sport<select value={pursuitKey} onChange={(event) => { setPursuitKey(event.target.value); setStartingAssessment(null); setOutcomeDraft(null); }} style={input}><option value="">Choose a sport</option>{SPORTS.map((sport) => <option key={sport.slug} value={sport.slug}>{sport.label}</option>)}</select></label>
              ) : (
                <label style={field}>Primary activity<input value={pursuitKey} onChange={(event) => setPursuitKey(event.target.value)} placeholder={pursuitFor(path)} style={input} /></label>
              )}
              <label style={field}>End or review date <span style={optionalText}>optional</span><input type="date" value={targetDate} onChange={(event) => setTargetDate(event.target.value)} style={input} /></label>
            </div>
          </CreatorPanel>
          </div>

          <div id="setup-starting-point" style={miniSection}>
          <CreatorPanel eyebrow="3 · Starting point" title="Establish the starting point" copy="Choose one repeatable measure. When history matches, use the logged result and original date.">
            <label style={includeRow}><input type="checkbox" checked={includeAssessment} onChange={(event) => setIncludeAssessment(event.target.checked)} /> Track a starting-point assessment</label>
            {includeAssessment ? (
              <AssessmentBuilder
                key={`${path}:${resolvedPursuit}`}
                programId=""
                pursuitKey={resolvedPursuit}
                objectiveKind={objectiveKindFor(path)}
                exercises={exercises}
                injuries={injuries}
                sessionMetrics={[]}
                suggestions={assessmentSuggestions}
                draft
                onDraftChange={setStartingAssessment}
              />
            ) : null}
          </CreatorPanel>
          </div>

          <div id="setup-outcomes" style={miniSection}>
            <FocusForm
              key={`${path}:${resolvedPursuit}`}
              initial={initial}
              routines={routines}
              exercises={exercises}
              injuries={injuries}
              startingAssessment={includeAssessment ? startingAssessment : null}
              panel="milestones"
              embedded
              guidedOutcomes
              onBack={() => setMode("choose")}
              onMilestonesChange={setOutcomeDraft}
              submitDisabled={!canOpenOutcomes}
            />
          </div>
        </section>
      </main>

      <style>{`
        @media (min-width: 900px) {
          .programCreatorWorkspace { grid-template-columns: 230px minmax(0, 1fr) !important; }
          .programCreatorSidebar { display: block !important; }
        }
        @media (max-width: 899px) {
          .programCreatorWorkspace { grid-template-columns: minmax(0, 1fr) !important; }
          .programPathList { grid-template-columns: minmax(0, 1fr) !important; }
          .programCreatorMiniSteps { grid-template-columns: repeat(2, minmax(0, 1fr)) !important; }
        }
      `}</style>
    </div>
  );
}

function CreatorStageRail() {
  const stages = [
    { number: "1", label: "Program setup", meta: "Objective, baseline, outcomes" },
    { number: "2", label: "Training inputs", meta: "Routines, goals, frequency" },
    { number: "3", label: "Stages", meta: "Phases and progression gates" },
    { number: "4", label: "Training blocks", meta: "Repeatable weeks of work" },
    { number: "5", label: "Schedule", meta: "Place the next two weeks" },
    { number: "6", label: "Targets and ladders", meta: "Projects and skill steps" },
  ];
  return (
    <nav aria-label="Program builder stages" style={rail}>
      <span style={railEyebrow}>Build program</span>
      <div style={railList}>
        {stages.map((step, index) => {
          const active = index === 0;
          return (
            <div key={step.number} aria-current={active ? "step" : undefined} style={{ ...railStep, ...(active ? railStepActive : {}), opacity: active ? 1 : 0.5 }}>
              <span style={{ ...railNumber, ...(active ? railNumberActive : {}) }}>{step.number}</span>
              <span style={railText}><strong style={railLabel}>{step.label}</strong><span style={railMeta}>{step.meta}</span></span>
            </div>
          );
        })}
      </div>
      <p style={railNote}>Finish setup to create the program. The same builder then unlocks the remaining steps without changing your logs.</p>
    </nav>
  );
}

function CreatorPanel({ eyebrow, title, copy, children }: { eyebrow: string; title: string; copy: string; children: ReactNode }) {
  return (
    <section style={panel}>
      <header style={panelHeader}><span style={panelEyebrow}>{eyebrow}</span><h2 style={panelTitle}>{title}</h2><p style={panelCopy}>{copy}</p></header>
      {children}
    </section>
  );
}

function blankInitial(): FocusFormInitial {
  return { name: "", description: "", icon: "", color: "#84cc78", status: "ACTIVE", targetDate: "", targetKind: "SOFT", season: "", phase: "", handoffNote: "", pursuitKey: "", linkedInjuryId: "", objectiveKind: "GENERAL", timelineMode: "REVIEW_DATE", startYmd: "", endYmd: "", reviewYmd: "", milestones: [] };
}

function guidedInitial(path: Path, name: string, pursuitKey: string, targetDate: string, outcomes: MilestoneFormRow[] | null): FocusFormInitial {
  return {
    ...blankInitial(),
    name,
    pursuitKey: pursuitKey.trim() || pursuitFor(path),
    targetDate,
    targetKind: "SOFT",
    objectiveKind: objectiveKindFor(path),
    timelineMode: path === "sport" ? "SEASON" : targetDate ? "TARGET_DATE" : "REVIEW_DATE",
    endYmd: targetDate,
    reviewYmd: targetDate,
    phase: "BUILD",
    milestones: outcomes ?? [{ scopeKind: "CAPACITY", scopeRef: pursuitKey || path, label: "", targetText: "", gateKind: "NONE" }],
  };
}

function assessmentSummary(assessment: DraftProgramAssessment | null) {
  if (!assessment?.name.trim()) return "Choose a measure";
  const value = assessment.baselineTextValue || assessment.baselineNumberValue || (assessment.baselineNumerator && assessment.baselineDenominator ? `${assessment.baselineNumerator}/${assessment.baselineDenominator}` : "");
  return value ? `${assessment.name}: ${value}` : assessment.name;
}

function placeholderFor(path: Path) { if (path === "sport") return "Fall climbing season"; if (path === "strength") return "Build a 50 lb weighted pull-up"; if (path === "endurance") return "Half-marathon base"; if (path === "body") return "Reach target weight"; return "Return to sport"; }
function pursuitFor(path: Path) { if (path === "strength") return "strength"; if (path === "endurance") return "endurance"; if (path === "body") return "body composition"; if (path === "recovery") return "rehab"; return "climbing"; }
function objectiveKindFor(path: Path): FocusFormInitial["objectiveKind"] { if (path === "sport") return "SPORT"; if (path === "strength") return "STRENGTH"; if (path === "endurance") return "ENDURANCE"; if (path === "body") return "BODY_COMPOSITION"; return "RECOVERY"; }

const choiceGrid: CSSProperties = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))", gap: 10 };
const primaryChoice: CSSProperties = { minHeight: 108, display: "grid", alignContent: "center", justifyItems: "start", gap: 4, padding: 15, textAlign: "left", borderWidth: 1, borderStyle: "solid", borderColor: "rgba(51,255,122,0.36)", borderRadius: 9, background: "rgba(51,255,122,0.09)", color: "white", cursor: "pointer" };
const secondaryChoice: CSSProperties = { ...primaryChoice, borderColor: "rgba(255,255,255,0.13)", background: "rgba(255,255,255,0.03)" };
const choiceTitle: CSSProperties = { fontSize: 14, fontWeight: 900 };
const choiceMeta: CSSProperties = { fontSize: 10.5, lineHeight: 1.4, color: "rgba(255,255,255,0.5)" };
const workspace: CSSProperties = { display: "grid", gridTemplateColumns: "minmax(0, 1fr)", gap: 18, alignItems: "start" };
const sidebar: CSSProperties = { display: "none", position: "sticky", top: 82, alignSelf: "start", padding: "12px 8px 14px", borderRightWidth: 1, borderRightStyle: "solid", borderRightColor: "rgba(255,255,255,0.08)" };
const canvas: CSSProperties = { minWidth: 0, width: "100%" };
const rail: CSSProperties = { display: "grid", gap: 12 };
const railEyebrow: CSSProperties = { padding: "0 10px", fontSize: 10, fontWeight: 900, textTransform: "uppercase", color: "rgba(255,255,255,0.38)" };
const railList: CSSProperties = { display: "grid", gap: 3 };
const railStep: CSSProperties = { width: "100%", minHeight: 62, display: "grid", gridTemplateColumns: "28px minmax(0, 1fr)", alignItems: "center", gap: 10, padding: "8px 10px", borderWidth: 1, borderStyle: "solid", borderColor: "transparent", borderRadius: 7, background: "transparent", color: "inherit", textAlign: "left", cursor: "pointer" };
const railStepActive: CSSProperties = { background: "rgba(51,255,122,0.075)", borderColor: "rgba(51,255,122,0.24)" };
const railNumber: CSSProperties = { width: 26, height: 26, display: "grid", placeItems: "center", borderRadius: 6, background: "rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.46)", fontSize: 10.5, fontWeight: 900 };
const railNumberActive: CSSProperties = { background: "rgba(51,255,122,0.14)", color: "#7ce8aa" };
const railText: CSSProperties = { minWidth: 0, display: "grid", gap: 2 };
const railLabel: CSSProperties = { fontSize: 12.5, color: "rgba(255,255,255,0.78)" };
const railMeta: CSSProperties = { overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontSize: 10.5, color: "rgba(255,255,255,0.38)" };
const railNote: CSSProperties = { margin: "2px 10px 0", fontSize: 10.5, lineHeight: 1.45, color: "rgba(255,255,255,0.36)" };
const setupShell: CSSProperties = { display: "grid", gap: 0, borderWidth: 1, borderStyle: "solid", borderColor: "rgba(255,255,255,0.10)", borderRadius: 9, background: "rgba(255,255,255,0.018)", overflow: "hidden" };
const setupHeader: CSSProperties = { display: "grid", gap: 6, padding: "20px 20px 16px" };
const setupTitle: CSSProperties = { margin: 0, fontSize: 24, lineHeight: 1.2 };
const mobileSteps: CSSProperties = { display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 6, padding: "0 20px 18px" };
const mobileStep: CSSProperties = { minWidth: 0, minHeight: 54, display: "grid", gridTemplateColumns: "24px minmax(0, 1fr)", alignItems: "center", gap: 7, padding: "7px 8px", borderWidth: 1, borderStyle: "solid", borderColor: "rgba(255,255,255,0.09)", borderRadius: 7, background: "rgba(255,255,255,0.02)", color: "rgba(255,255,255,0.62)", textAlign: "left", cursor: "pointer" };
const mobileStepComplete: CSSProperties = { borderColor: "rgba(51,255,122,0.24)", background: "rgba(51,255,122,0.05)" };
const miniStepNumber: CSSProperties = { width: 22, height: 22, display: "grid", placeItems: "center", borderRadius: 6, background: "rgba(51,255,122,0.1)", color: "#7ce8aa", fontSize: 10, fontWeight: 900 };
const miniStepText: CSSProperties = { minWidth: 0, display: "grid", gap: 1, fontSize: 10.5, lineHeight: 1.25 };
const miniSection: CSSProperties = { scrollMarginTop: 18, padding: "0 20px", borderTopWidth: 1, borderTopStyle: "solid", borderTopColor: "rgba(255,255,255,0.08)" };
const panel: CSSProperties = { display: "grid", gap: 18, padding: "22px 0", background: "transparent" };
const panelHeader: CSSProperties = { display: "grid", gap: 6, paddingBottom: 2 };
const panelEyebrow: CSSProperties = { fontSize: 10, fontWeight: 900, textTransform: "uppercase", color: "#7ce8aa" };
const panelTitle: CSSProperties = { margin: 0, fontSize: 22, lineHeight: 1.2 };
const panelCopy: CSSProperties = { maxWidth: 650, margin: 0, fontSize: 12.5, lineHeight: 1.5, color: "rgba(255,255,255,0.52)" };
const detailFields: CSSProperties = { display: "grid", gap: 13, maxWidth: 680 };
const backButton: CSSProperties = { minHeight: 42, padding: "0 13px", borderWidth: 1, borderStyle: "solid", borderColor: "rgba(255,255,255,0.14)", borderRadius: 8, background: "rgba(255,255,255,0.03)", color: "rgba(255,255,255,0.7)", fontWeight: 800, cursor: "pointer" };
const pathList: CSSProperties = { display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 7 };
const pathRow: CSSProperties = { minHeight: 60, display: "flex", alignItems: "center", gap: 10, padding: "10px 11px", borderWidth: 1, borderStyle: "solid", borderColor: "rgba(255,255,255,0.09)", borderRadius: 8, cursor: "pointer", fontSize: 12.5 };
const selectedPath: CSSProperties = { borderColor: "rgba(51,255,122,0.35)", background: "rgba(51,255,122,0.07)" };
const field: CSSProperties = { display: "grid", gap: 5, fontSize: 11, color: "rgba(255,255,255,0.62)", fontWeight: 800 };
const input: CSSProperties = { minHeight: 44, minWidth: 0, width: "100%", padding: "8px 10px", boxSizing: "border-box", borderWidth: 1, borderStyle: "solid", borderColor: "rgba(255,255,255,0.14)", borderRadius: 8, background: "#111827", color: "white", fontSize: 16 };
const optionalText: CSSProperties = { color: "rgba(255,255,255,0.38)", fontWeight: 650 };
const includeRow: CSSProperties = { minHeight: 40, display: "flex", alignItems: "center", gap: 8, fontSize: 11.5, fontWeight: 800, color: "rgba(255,255,255,0.67)" };

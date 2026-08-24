"use client";

import { useState, type CSSProperties } from "react";
import Link from "next/link";
import { addProgramAssessmentResult, deleteProgramAssessment, updateProgramAssessment } from "@/app/programs/actions";
import { ASSESSMENT_DIRECTIONS, type AssessmentDirection } from "@/app/programs/assessment-directions";
import type { ProgramAssessmentSuggestion } from "@/app/programs/assessment-suggestions";

type Result = {
  id: string;
  numberValue: number | null;
  numerator: number | null;
  denominator: number | null;
  textValue: string | null;
  isBaseline: boolean;
};

export type AssessmentCardModel = {
  id: string;
  name: string;
  description: string | null;
  metricKind: string;
  metricKey: string | null;
  unit: string | null;
  direction: AssessmentDirection;
  targetNumberValue: number | null;
  targetNumerator: number | null;
  targetDenominator: number | null;
  targetTextValue: string | null;
  checkpointIntervalWeeks: number | null;
  results: Result[];
};

export default function AssessmentCard({
  programId,
  assessment,
  suggestion,
}: {
  programId: string;
  assessment: AssessmentCardModel;
  suggestion: ProgramAssessmentSuggestion | null;
}) {
  const [editing, setEditing] = useState(false);
  const [direction, setDirection] = useState<AssessmentDirection>(assessment.direction);
  const [useSuggested, setUseSuggested] = useState(false);

  const isRatio = assessment.metricKind === "RATIO";
  const isText = assessment.metricKind === "TEXT" || assessment.metricKind === "GRADE";
  const baseline = assessment.results.find((result) => result.isBaseline) ?? assessment.results[0] ?? null;
  const latest = assessment.results.at(-1) ?? null;
  const target = formatTarget(assessment);

  // A suggestion is only offered when the incoming shape matches the series.
  const suggestionValue = suggestion
    ? isRatio
      ? suggestion.numerator != null && suggestion.denominator != null
        ? `${suggestion.numerator}/${suggestion.denominator}`
        : null
      : isText
        ? suggestion.textValue
        : suggestion.numberValue != null
          ? `${suggestion.numberValue}${assessment.unit ? ` ${assessment.unit}` : ""}`
          : null
    : null;

  return (
    <div style={card}>
      <div style={cardHead}>
        <div style={{ minWidth: 0 }}>
          <strong>{assessment.name}</strong>
          <div style={minorText}>
            {assessment.metricKind.toLowerCase().replaceAll("_", " ")}
            {assessment.checkpointIntervalWeeks ? ` · every ${assessment.checkpointIntervalWeeks} weeks` : " · stage review"}
          </div>
        </div>
        <div style={{ display: "flex", gap: 6 }}>
          <button type="button" onClick={() => setEditing((open) => !open)} style={quietActionButton}>
            {editing ? "Close" : "Edit"}
          </button>
          <form action={deleteProgramAssessment}>
            <input type="hidden" name="programId" value={programId} />
            <input type="hidden" name="assessmentId" value={assessment.id} />
            <button type="submit" style={quietActionButton}>Remove</button>
          </form>
        </div>
      </div>

      {baseline ? (
        <div style={summaryRow}>
          <span><span style={minorText}>Baseline</span><strong style={block}>{resultValue(baseline, assessment.unit)}</strong></span>
          {latest && latest.id !== baseline.id ? (
            <span style={{ textAlign: "center" }}><span style={minorText}>Latest</span><strong style={block}>{resultValue(latest, assessment.unit)}</strong></span>
          ) : null}
          {target ? (
            <span style={{ textAlign: "right" }}><span style={minorText}>Target</span><strong style={{ ...block, color: "#7ce8aa" }}>{target}</strong></span>
          ) : null}
        </div>
      ) : (
        <div style={empty}>No confirmed baseline yet.</div>
      )}

      {suggestionValue ? (
        <div style={suggestionRow}>
          <div style={{ minWidth: 0 }}>
            <span style={suggestionEyebrow}>Current value in your logs</span>
            <strong style={suggestionStrong}>{suggestionValue}</strong>
            <span style={minorText}>{suggestion?.sourceLabel}</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {suggestion?.sourceHref ? <Link href={suggestion.sourceHref} style={sourceLink}>View</Link> : null}
            <button type="button" onClick={() => setUseSuggested((on) => !on)} style={{ ...quietActionButton, ...(useSuggested ? activeToggle : {}) }}>
              {useSuggested ? "Using it" : "Use it"}
            </button>
          </div>
        </div>
      ) : null}

      <form action={addProgramAssessmentResult} style={miniForm}>
        <input type="hidden" name="programId" value={programId} />
        <input type="hidden" name="assessmentId" value={assessment.id} />
        <input type="hidden" name="source" value={useSuggested && suggestion ? suggestion.source : "MANUAL"} />
        <input type="hidden" name="sourceRefId" value={useSuggested && suggestion ? suggestion.sourceRefId : ""} />
        {isRatio ? (
          <>
            <input name="numerator" type="number" step="any" placeholder="made" defaultValue={useSuggested ? suggestion?.numerator ?? "" : ""} key={`n-${useSuggested}`} style={smallInput} />
            <input name="denominator" type="number" step="any" placeholder="attempts" defaultValue={useSuggested ? suggestion?.denominator ?? "" : ""} key={`d-${useSuggested}`} style={smallInput} />
          </>
        ) : isText ? (
          <input name="textValue" placeholder="result" defaultValue={useSuggested ? suggestion?.textValue ?? "" : ""} key={`t-${useSuggested}`} style={input} />
        ) : (
          <input name="numberValue" type="number" step="any" placeholder={assessment.unit ?? "result"} defaultValue={useSuggested ? suggestion?.numberValue ?? "" : ""} key={`v-${useSuggested}`} style={smallInput} />
        )}
        <input name="measuredYmd" type="date" defaultValue={useSuggested ? suggestion?.measuredYmd ?? "" : ""} key={`y-${useSuggested}`} style={input} />
        <label style={baselineToggle}><input type="checkbox" name="isBaseline" value="1" /> baseline</label>
        <button type="submit" style={iconButton} title="Add checkpoint" aria-label={`Add ${assessment.name} checkpoint`}>+</button>
      </form>

      {editing ? (
        <form action={updateProgramAssessment} style={editForm}>
          <input type="hidden" name="programId" value={programId} />
          <input type="hidden" name="assessmentId" value={assessment.id} />
          <input type="hidden" name="direction" value={direction} />
          <p style={editNote}>
            The metric, its unit, and its result type stay fixed — every recorded checkpoint belongs to that series. Everything your plan can change is here.
          </p>
          <label style={fieldLabel}>Name<input name="name" defaultValue={assessment.name} style={input} /></label>
          <label style={fieldLabel}>Note <span style={minorText}>optional</span><input name="description" defaultValue={assessment.description ?? ""} placeholder="How to run this test the same way each time" style={input} /></label>
          <div style={twoUp}>
            {isRatio ? (
              <>
                <label style={fieldLabel}>Target made<input name="targetNumerator" type="number" step="any" defaultValue={assessment.targetNumerator ?? ""} style={input} /></label>
                <label style={fieldLabel}>Out of<input name="targetDenominator" type="number" step="any" defaultValue={assessment.targetDenominator ?? ""} style={input} /></label>
              </>
            ) : isText ? (
              <label style={fieldLabel}>Target<input name="targetTextValue" defaultValue={assessment.targetTextValue ?? ""} style={input} /></label>
            ) : (
              <label style={fieldLabel}>Target{assessment.unit ? ` (${assessment.unit})` : ""}<input name="targetNumberValue" type="number" step="any" defaultValue={assessment.targetNumberValue ?? ""} style={input} /></label>
            )}
            <label style={fieldLabel}>Repeat the test
              <select name="checkpointIntervalWeeks" defaultValue={assessment.checkpointIntervalWeeks ?? ""} style={input}>
                <option value="">At stage changes</option>
                {[2, 4, 6, 8, 12].map((weeks) => <option key={weeks} value={weeks}>Every {weeks} weeks</option>)}
              </select>
            </label>
          </div>
          <div>
            <div style={minorText}>Which way is progress?</div>
            <div className="assessmentCardDirections" style={directionGrid}>
              {ASSESSMENT_DIRECTIONS.map((option) => {
                const selected = direction === option.id;
                return (
                  <button key={option.id} type="button" aria-pressed={selected} onClick={() => setDirection(option.id)} style={{ ...directionButton, ...(selected ? selectedDirection : {}) }}>
                    {option.label}
                  </button>
                );
              })}
            </div>
          </div>
          <button type="submit" style={saveButton}>Save assessment</button>
          <style>{`@media (max-width: 680px) { .assessmentCardDirections { grid-template-columns: repeat(2, minmax(0, 1fr)) !important; } }`}</style>
        </form>
      ) : null}
    </div>
  );
}

function resultValue(result: Result, unit: string | null) {
  if (result.numerator != null && result.denominator != null) return `${result.numerator}/${result.denominator}`;
  if (result.numberValue != null) return `${result.numberValue}${unit ? ` ${unit}` : ""}`;
  return result.textValue ?? "—";
}

function formatTarget(assessment: AssessmentCardModel) {
  if (assessment.targetNumerator != null && assessment.targetDenominator != null) return `${assessment.targetNumerator}/${assessment.targetDenominator}`;
  if (assessment.targetNumberValue != null) return `${assessment.targetNumberValue}${assessment.unit ? ` ${assessment.unit}` : ""}`;
  return assessment.targetTextValue || null;
}

const card: CSSProperties = { display: "grid", gap: 9, padding: 12, borderWidth: 1, borderStyle: "solid", borderColor: "rgba(255,255,255,0.09)", borderRadius: 8 };
const cardHead: CSSProperties = { display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 10 };
const minorText: CSSProperties = { fontSize: 10.5, color: "rgba(255,255,255,0.45)" };
const block: CSSProperties = { display: "block" };
const summaryRow: CSSProperties = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(80px, 1fr))", gap: 10, padding: "8px 10px", borderRadius: 7, background: "rgba(255,255,255,0.03)" };
const empty: CSSProperties = { padding: "8px 10px", borderRadius: 7, background: "rgba(255,255,255,0.03)", fontSize: 11.5, color: "rgba(255,255,255,0.45)" };
const suggestionRow: CSSProperties = { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap", padding: "8px 10px", borderRadius: 7, borderWidth: 1, borderStyle: "solid", borderColor: "rgba(51,255,122,0.22)", background: "rgba(51,255,122,0.05)" };
const suggestionEyebrow: CSSProperties = { display: "block", fontSize: 9.5, fontWeight: 900, textTransform: "uppercase", color: "#7ce8aa" };
const suggestionStrong: CSSProperties = { display: "block", fontSize: 14 };
const sourceLink: CSSProperties = { fontSize: 11, fontWeight: 800, color: "rgba(255,255,255,0.6)", textDecoration: "none" };
const miniForm: CSSProperties = { display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" };
const input: CSSProperties = { minHeight: 44, minWidth: 0, flex: "1 1 130px", padding: "8px 10px", boxSizing: "border-box", borderWidth: 1, borderStyle: "solid", borderColor: "rgba(255,255,255,0.14)", borderRadius: 8, background: "#111827", color: "white", fontSize: 16 };
const smallInput: CSSProperties = { ...input, flex: "1 1 90px" };
const baselineToggle: CSSProperties = { display: "flex", alignItems: "center", gap: 5, fontSize: 11, color: "rgba(255,255,255,0.6)" };
const iconButton: CSSProperties = { minWidth: 44, minHeight: 44, borderWidth: 1, borderStyle: "solid", borderColor: "rgba(51,255,122,0.3)", borderRadius: 8, background: "rgba(51,255,122,0.1)", color: "#7ce8aa", fontSize: 18, fontWeight: 900, cursor: "pointer" };
const quietActionButton: CSSProperties = { minHeight: 34, padding: "0 10px", borderWidth: 1, borderStyle: "solid", borderColor: "rgba(255,255,255,0.14)", borderRadius: 7, background: "transparent", color: "rgba(255,255,255,0.62)", fontSize: 11, fontWeight: 800, cursor: "pointer" };
const activeToggle: CSSProperties = { borderColor: "rgba(51,255,122,0.4)", background: "rgba(51,255,122,0.12)", color: "#7ce8aa" };
const editForm: CSSProperties = { display: "grid", gap: 10, marginTop: 2, padding: 12, borderRadius: 8, borderWidth: 1, borderStyle: "solid", borderColor: "rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.02)" };
const editNote: CSSProperties = { margin: 0, fontSize: 10.5, lineHeight: 1.45, color: "rgba(255,255,255,0.42)" };
const fieldLabel: CSSProperties = { display: "grid", gap: 4, fontSize: 11, fontWeight: 800, color: "rgba(255,255,255,0.6)" };
const twoUp: CSSProperties = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 10 };
const directionGrid: CSSProperties = { display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 6, marginTop: 6 };
const directionButton: CSSProperties = { minHeight: 40, padding: "0 8px", borderWidth: 1, borderStyle: "solid", borderColor: "rgba(255,255,255,0.1)", borderRadius: 7, background: "rgba(255,255,255,0.025)", color: "rgba(255,255,255,0.72)", fontSize: 11, fontWeight: 800, cursor: "pointer" };
const selectedDirection: CSSProperties = { borderColor: "rgba(51,255,122,0.38)", background: "rgba(51,255,122,0.08)", color: "#fff" };
const saveButton: CSSProperties = { minHeight: 44, borderWidth: 1, borderStyle: "solid", borderColor: "rgba(51,255,122,0.32)", borderRadius: 8, background: "rgba(51,255,122,0.1)", color: "#7ce8aa", fontWeight: 900, cursor: "pointer" };

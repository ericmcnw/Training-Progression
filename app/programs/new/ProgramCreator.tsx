"use client";

import { useState } from "react";
import FocusForm, { type FocusFormInitial } from "@/app/focus/FocusForm";

type Pick = { id: string; name: string };
type Path = "sport" | "strength" | "endurance" | "body" | "recovery";

const PATHS: Array<{ id: Path; label: string; examples: string }> = [
  { id: "sport", label: "Improve at a sport", examples: "climbing, basketball, golf, snowboarding" },
  { id: "strength", label: "Build strength or a skill", examples: "weighted pull-up, front lever, general strength" },
  { id: "endurance", label: "Build endurance", examples: "running base, hiking capacity, race preparation" },
  { id: "body", label: "Change bodyweight", examples: "lose weight, gain weight, maintain while training" },
  { id: "recovery", label: "Recover and return", examples: "rehab, graded loading, return to sport" },
];

export default function ProgramCreator({ routines, exercises, injuries }: { routines: Pick[]; exercises: Pick[]; injuries: Pick[] }) {
  const [mode, setMode] = useState<"choose" | "guided" | "manual">("choose");
  const [path, setPath] = useState<Path>("sport");
  const [name, setName] = useState("");
  const [pursuitKey, setPursuitKey] = useState("");
  const [targetDate, setTargetDate] = useState("");
  const [ready, setReady] = useState(false);

  if (mode === "choose") {
    return <div style={choiceGrid}>
      <button type="button" style={primaryChoice} onClick={() => setMode("guided")}><span style={choiceTitle}>Guided setup</span><span style={choiceMeta}>Start from the outcome</span></button>
      <button type="button" style={secondaryChoice} onClick={() => setMode("manual")}><span style={choiceTitle}>Full editor</span><span style={choiceMeta}>Enter the whole roadmap directly</span></button>
    </div>;
  }

  if (mode === "guided" && !ready) {
    return <div style={guided}>
      <button type="button" style={backButton} onClick={() => setMode("choose")}>Back</button>
      <section style={step}>
        <div style={stepNumber}>1</div><div><h2 style={stepTitle}>What are you training toward?</h2><div style={pathList}>{PATHS.map((option) => <label key={option.id} style={{ ...pathRow, ...(path === option.id ? selectedPath : {}) }}><input type="radio" name="path" checked={path === option.id} onChange={() => setPath(option.id)} /><span><strong style={{ display: "block" }}>{option.label}</strong><span style={choiceMeta}>{option.examples}</span></span></label>)}</div></div>
      </section>
      <section style={step}>
        <div style={stepNumber}>2</div><div style={{ display: "grid", gap: 10 }}><h2 style={stepTitle}>Name the outcome</h2><label style={field}>Program name<input value={name} onChange={(event) => setName(event.target.value)} placeholder={placeholderFor(path)} style={input} /></label><label style={field}>Sport or pursuit<input value={pursuitKey} onChange={(event) => setPursuitKey(event.target.value)} placeholder={pursuitFor(path)} style={input} /></label><label style={field}>Target date<input type="date" value={targetDate} onChange={(event) => setTargetDate(event.target.value)} style={input} /></label></div>
      </section>
      <button type="button" disabled={!name.trim()} style={{ ...continueButton, opacity: name.trim() ? 1 : 0.45 }} onClick={() => setReady(true)}>Build roadmap</button>
    </div>;
  }

  const initial = mode === "manual" ? blankInitial() : guidedInitial(path, name, pursuitKey, targetDate);
  return <div style={{ display: "grid", gap: 12 }}>
    <button type="button" style={backButton} onClick={() => mode === "manual" ? setMode("choose") : setReady(false)}>Back</button>
    <FocusForm key={`${mode}:${path}:${name}`} initial={initial} routines={routines} exercises={exercises} injuries={injuries} />
  </div>;
}

function blankInitial(): FocusFormInitial {
  return { name: "", description: "", icon: "", color: "#84cc78", status: "ACTIVE", targetDate: "", targetKind: "SOFT", season: "", phase: "", handoffNote: "", pursuitKey: "", linkedInjuryId: "", milestones: [] };
}

function guidedInitial(path: Path, name: string, pursuitKey: string, targetDate: string): FocusFormInitial {
  const milestones = path === "recovery"
    ? ["Settle symptoms and establish baseline", "Rebuild capacity", "Return to normal training"]
    : path === "sport"
      ? ["Establish current level", "Build sport-specific capacity", "Convert training into performance"]
      : path === "body"
        ? ["Establish baseline and weekly trend", "Build a sustainable rate of change", "Reach and maintain the target range"]
        : ["Establish baseline", "Build consistent weekly work", "Reach the target"];
  return {
    ...blankInitial(),
    name,
    pursuitKey: pursuitKey.trim() || pursuitFor(path),
    targetDate,
    targetKind: targetDate ? "HARD" : "SOFT",
    phase: "BUILD",
    milestones: milestones.map((label, index) => ({
      scopeKind: "CAPACITY",
      scopeRef: path,
      label,
      targetText: "",
      estDurationDays: index === 0 ? 14 : 28,
      gateKind: "NONE",
    })),
  };
}

function placeholderFor(path: Path) { if (path === "sport") return "Fall climbing season"; if (path === "strength") return "Build a 50 lb weighted pull-up"; if (path === "endurance") return "Half-marathon base"; if (path === "body") return "Reach target weight"; return "Return to sport"; }
function pursuitFor(path: Path) { if (path === "strength") return "strength"; if (path === "endurance") return "endurance"; if (path === "body") return "body composition"; if (path === "recovery") return "rehab"; return "climbing"; }

const choiceGrid: React.CSSProperties = { display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 10 };
const primaryChoice: React.CSSProperties = { minHeight: 108, display: "grid", alignContent: "center", justifyItems: "start", gap: 4, padding: 15, textAlign: "left", borderRadius: 9, border: "1px solid rgba(51,255,122,0.36)", background: "rgba(51,255,122,0.09)", color: "white", cursor: "pointer" };
const secondaryChoice: React.CSSProperties = { ...primaryChoice, borderColor: "rgba(255,255,255,0.13)", background: "rgba(255,255,255,0.03)" };
const choiceTitle: React.CSSProperties = { fontSize: 14, fontWeight: 900 };
const choiceMeta: React.CSSProperties = { fontSize: 10.5, lineHeight: 1.4, color: "rgba(255,255,255,0.5)" };
const guided: React.CSSProperties = { display: "grid", gap: 15 };
const backButton: React.CSSProperties = { justifySelf: "start", minHeight: 38, padding: "0 10px", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 8, background: "transparent", color: "rgba(255,255,255,0.62)", fontWeight: 800, cursor: "pointer" };
const step: React.CSSProperties = { display: "grid", gridTemplateColumns: "27px minmax(0, 1fr)", gap: 10, padding: 14, borderRadius: 9, border: "1px solid rgba(255,255,255,0.09)", background: "rgba(255,255,255,0.025)" };
const stepNumber: React.CSSProperties = { width: 24, height: 24, borderRadius: 6, display: "grid", placeItems: "center", color: "#7ce8aa", border: "1px solid rgba(51,255,122,0.28)", background: "rgba(51,255,122,0.08)", fontSize: 11, fontWeight: 900 };
const stepTitle: React.CSSProperties = { margin: "2px 0 10px", fontSize: 14.5, fontWeight: 900 };
const pathList: React.CSSProperties = { display: "grid", gap: 6 };
const pathRow: React.CSSProperties = { minHeight: 52, display: "flex", alignItems: "center", gap: 10, padding: "8px 10px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.09)", cursor: "pointer", fontSize: 12.5 };
const selectedPath: React.CSSProperties = { borderColor: "rgba(51,255,122,0.35)", background: "rgba(51,255,122,0.07)" };
const field: React.CSSProperties = { display: "grid", gap: 5, fontSize: 11, color: "rgba(255,255,255,0.62)", fontWeight: 800 };
const input: React.CSSProperties = { minHeight: 43, minWidth: 0, width: "100%", padding: "8px 10px", boxSizing: "border-box", borderRadius: 8, border: "1px solid rgba(255,255,255,0.14)", background: "#111827", color: "white", fontSize: 16 };
const continueButton: React.CSSProperties = { minHeight: 46, borderRadius: 8, border: "1px solid rgba(51,255,122,0.4)", background: "rgba(51,255,122,0.12)", color: "#7ce8aa", fontWeight: 900, cursor: "pointer" };

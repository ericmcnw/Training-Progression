"use client";

import { useEffect, useState } from "react";

export type ProgramEditorStep = {
  id: string;
  number: string;
  label: string;
  meta: string;
  complete: boolean;
};

export default function ProgramEditorNav({ steps, openStepId }: { steps: ProgramEditorStep[]; openStepId?: string }) {
  const [activeId, setActiveId] = useState(openStepId ?? steps[0]?.id ?? "");

  useEffect(() => {
    const sections = Array.from(
      document.querySelectorAll<HTMLDetailsElement>("details[data-program-editor-step]")
    );

    function handleToggle(event: Event) {
      const opened = event.currentTarget as HTMLDetailsElement;
      if (!opened.open) {
        // Desktop is a step workspace, not an accordion. Keep the current
        // section visible so clicking its heading cannot produce a blank
        // canvas. Mobile keeps the normal collapsible behavior.
        if (window.matchMedia("(min-width: 900px)").matches && opened.id === activeId) {
          opened.open = true;
        }
        return;
      }
      for (const section of sections) {
        if (section !== opened) section.open = false;
      }
      setActiveId(opened.id);
    }

    for (const section of sections) section.addEventListener("toggle", handleToggle);
    return () => {
      for (const section of sections) section.removeEventListener("toggle", handleToggle);
    };
  }, [activeId]);

  function goTo(stepId: string) {
    const target = document.getElementById(stepId) as HTMLDetailsElement | null;
    if (!target) return;
    target.open = true;
    setActiveId(stepId);
    target.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  return (
    <nav aria-label="Program builder steps" style={nav}>
      <div style={eyebrow}>Build program</div>
      <div style={stepList}>
        {steps.map((step) => {
          const active = activeId === step.id;
          return (
            <button
              key={step.id}
              type="button"
              onClick={() => goTo(step.id)}
              aria-current={active ? "step" : undefined}
              style={{ ...stepButton, ...(active ? activeStep : {}) }}
            >
              <span style={{ ...number, ...(active ? activeNumber : {}), ...(step.complete ? completeNumber : {}) }}>{step.complete ? "✓" : step.number}</span>
              <span style={stepText}>
                <span style={{ ...label, color: active ? "#fff" : label.color }}>{step.label}</span>
                <span style={meta}>{step.meta}</span>
              </span>
            </button>
          );
        })}
      </div>
      <p style={note}>Each section saves independently. Your training history is never rewritten.</p>
    </nav>
  );
}

const nav: React.CSSProperties = { display: "grid", gap: 12 };
const eyebrow: React.CSSProperties = { padding: "0 10px", fontSize: 10, fontWeight: 900, textTransform: "uppercase", color: "rgba(255,255,255,0.38)" };
const stepList: React.CSSProperties = { display: "grid", gap: 3 };
const stepButton: React.CSSProperties = { width: "100%", minHeight: 58, display: "grid", gridTemplateColumns: "28px minmax(0, 1fr)", alignItems: "center", gap: 10, padding: "8px 10px", borderWidth: 1, borderStyle: "solid", borderColor: "transparent", borderRadius: 7, background: "transparent", color: "inherit", textAlign: "left", cursor: "pointer" };
const activeStep: React.CSSProperties = { background: "rgba(51,255,122,0.075)", borderColor: "rgba(51,255,122,0.24)" };
const number: React.CSSProperties = { width: 26, height: 26, display: "grid", placeItems: "center", borderRadius: 6, background: "rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.46)", fontSize: 10.5, fontWeight: 900 };
const completeNumber: React.CSSProperties = { background: "rgba(51,255,122,0.16)", color: "#7ce8aa" };
const activeNumber: React.CSSProperties = { background: "rgba(51,255,122,0.14)", color: "#7ce8aa" };
const stepText: React.CSSProperties = { minWidth: 0, display: "grid", gap: 2 };
const label: React.CSSProperties = { fontSize: 12.5, fontWeight: 850, color: "rgba(255,255,255,0.7)", lineHeight: 1.25 };
const meta: React.CSSProperties = { overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontSize: 10.5, color: "rgba(255,255,255,0.38)" };
const note: React.CSSProperties = { margin: "2px 10px 0", fontSize: 10.5, lineHeight: 1.45, color: "rgba(255,255,255,0.36)" };

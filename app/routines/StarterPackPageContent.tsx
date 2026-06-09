"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { createStarterPack } from "./actions";
import { NewRoutineDrawerButton } from "@/app/components/FormDrawerButtons";
import {
  STARTER_PACKS,
  STARTER_STRUCTURES,
  buildStarterPackPlan,
  getStarterPackDefinition,
  getStarterStructureDefinition,
  type StarterPackFocus,
  type StarterPackStructure,
} from "@/lib/starter-packs";

export default function StarterPackPageContent() {
  const [focus, setFocus] = useState<StarterPackFocus>("MIXED");
  const [structure, setStructure] = useState<StarterPackStructure>("BALANCED");
  const pack = getStarterPackDefinition(focus);
  const structureDef = getStarterStructureDefinition(structure);
  const plan = useMemo(() => buildStarterPackPlan(focus, structure), [focus, structure]);

  return (
    <div style={styles.container}>
      <div style={styles.topRow}>
        <div>
          <h1 style={styles.h1}>Starter Pack Builder</h1>
          <div style={styles.sub}>Create an 80% right starting setup, then customize routines individually after.</div>
        </div>

        <Link href="/log" style={styles.linkBtn}>
          Back
        </Link>
      </div>

      <form action={createStarterPack} style={styles.formShell}>
        <section style={styles.panel}>
          <div style={styles.panelHeader}>1. Pick Your Focus</div>
          <div style={styles.panelBody}>
            <div style={styles.cardGrid}>
              {STARTER_PACKS.map((option) => (
                <button
                  key={option.key}
                  type="button"
                  onClick={() => setFocus(option.key)}
                  style={{
                    ...styles.choiceCard,
                    ...(focus === option.key ? styles.choiceCardActive : null),
                  }}
                >
                  <div style={styles.choiceTitle}>{option.label}</div>
                  <div style={styles.choiceDescription}>{option.description}</div>
                  <div style={styles.choiceMeta}>{option.bestFor}</div>
                </button>
              ))}
            </div>
          </div>
        </section>

        <section style={styles.panel}>
          <div style={styles.panelHeader}>2. Choose Structure Level</div>
          <div style={styles.panelBody}>
            <div style={styles.structureRow}>
              {STARTER_STRUCTURES.map((option) => (
                <button
                  key={option.key}
                  type="button"
                  onClick={() => setStructure(option.key)}
                  style={{
                    ...styles.structurePill,
                    ...(structure === option.key ? styles.structurePillActive : null),
                  }}
                >
                  {option.label}
                </button>
              ))}
            </div>
            <div style={styles.helper}>{structureDef.description}</div>
          </div>
        </section>

        <section style={styles.panel}>
          <div style={styles.panelHeader}>3. Preview</div>
          <div style={styles.panelBody}>
            <div style={styles.previewIntro}>
              <div style={styles.previewTitle}>{pack.label} · {structureDef.label}</div>
              <div style={styles.previewDescription}>{pack.description}</div>
            </div>

            <div style={{ display: "grid", gap: 10 }}>
              {plan.map((routine) => (
                <div key={`${routine.name}-${routine.kind}`} style={styles.previewCard}>
                  <div style={{ fontWeight: 900 }}>{routine.name}</div>
                  <div style={styles.previewMeta}>
                    {routine.kind} | {routine.subtype}
                    {routine.timesPerWeek ? ` | target ${routine.timesPerWeek}x / week` : ""}
                  </div>
                </div>
              ))}
            </div>

            <div style={styles.helper}>
              This creates the routines and starter frequency targets only. You can fill in workout templates, guided steps, and metadata after.
            </div>

            <input type="hidden" name="focus" value={focus} />
            <input type="hidden" name="structure" value={structure} />

            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <button type="submit" style={styles.primaryBtn}>
                Create Starter Pack
              </button>
              <NewRoutineDrawerButton style={styles.linkBtn}>
                Create One Routine Instead
              </NewRoutineDrawerButton>
            </div>
          </div>
        </section>
      </form>
    </div>
  );
}

const border = "1px solid rgba(128,128,128,0.35)";

const styles: Record<string, React.CSSProperties> = {
  container: { maxWidth: 1080, margin: "0 auto", padding: 20, display: "grid", gap: 16 },
  topRow: { display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12, flexWrap: "wrap" },
  h1: { fontSize: 28, fontWeight: 900, margin: 0 },
  sub: { marginTop: 6, opacity: 0.75, fontSize: 13 },
  formShell: { display: "grid", gap: 16 },
  panel: { border, borderRadius: 16, overflow: "hidden", background: "rgba(128,128,128,0.04)" },
  panelHeader: { padding: "12px 14px", fontWeight: 900, background: "rgba(128,128,128,0.12)", borderBottom: border },
  panelBody: { padding: 14, display: "grid", gap: 12 },
  cardGrid: { display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" },
  choiceCard: {
    textAlign: "left",
    padding: 14,
    borderRadius: 14,
    border,
    background: "rgba(128,128,128,0.05)",
    color: "inherit",
    display: "grid",
    gap: 8,
    minHeight: 148,
  },
  choiceCardActive: {
    borderColor: "rgba(76,163,255,0.72)",
    background: "rgba(76,163,255,0.12)",
  },
  choiceTitle: { fontSize: 16, fontWeight: 900 },
  choiceDescription: { fontSize: 13, opacity: 0.82, lineHeight: 1.45 },
  choiceMeta: { fontSize: 12, opacity: 0.66 },
  structureRow: { display: "flex", gap: 8, flexWrap: "wrap" },
  structurePill: {
    padding: "9px 12px",
    borderRadius: 999,
    border,
    background: "rgba(128,128,128,0.08)",
    color: "inherit",
    fontWeight: 800,
  },
  structurePillActive: {
    borderColor: "rgba(84,203,130,0.7)",
    background: "rgba(84,203,130,0.14)",
  },
  previewIntro: { display: "grid", gap: 4 },
  previewTitle: { fontSize: 16, fontWeight: 900 },
  previewDescription: { fontSize: 13, opacity: 0.78, lineHeight: 1.45 },
  previewCard: {
    border,
    borderRadius: 12,
    padding: 12,
    background: "rgba(255,255,255,0.03)",
    display: "grid",
    gap: 4,
  },
  previewMeta: { fontSize: 12, opacity: 0.76 },
  helper: { fontSize: 12, opacity: 0.72 },
  primaryBtn: {
    padding: "10px 14px",
    borderRadius: 12,
    border: "1px solid rgba(84,203,130,0.7)",
    background: "rgba(84,203,130,0.14)",
    color: "inherit",
    fontWeight: 900,
  },
  linkBtn: {
    padding: "10px 12px",
    border,
    borderRadius: 12,
    textDecoration: "none",
    color: "inherit",
    background: "rgba(128,128,128,0.08)",
    fontWeight: 800,
  },
};

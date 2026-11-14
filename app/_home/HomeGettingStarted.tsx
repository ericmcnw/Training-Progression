"use client";

import Link from "next/link";
import type { CSSProperties } from "react";
import { NewGoalDrawerButton, NewRoutineDrawerButton } from "@/app/components/FormDrawerButtons";
import { COLOR, RADIUS, cardHeader, cardSurface, cardTitle } from "./tokens";

export default function HomeGettingStarted({ hasGoals }: { hasGoals: boolean }) {
  return (
    <section style={cardSurface} aria-label="Getting started">
      <header style={cardHeader}>
        <span style={cardTitle}>Getting started</span>
      </header>
      <p style={lead}>
        Nothing logged lately. Log one session and this page starts filling in: your week, your volume, and what you have been training.
      </p>
      <div style={actions}>
        <Link href="/log" style={primary}>
          <span style={actionTitle}>Log something you did</span>
          <span style={actionMeta}>A workout, a run, a climb, a game</span>
        </Link>
        <NewRoutineDrawerButton style={secondary}>
          <span style={actionTitle}>Build a routine</span>
          <span style={actionMeta}>A workout you repeat, so logging it is one tap</span>
        </NewRoutineDrawerButton>
        {hasGoals ? null : (
          <NewGoalDrawerButton style={secondary}>
            <span style={actionTitle}>Set a goal</span>
            <span style={actionMeta}>How often, how far, or a number to hit</span>
          </NewGoalDrawerButton>
        )}
      </div>
    </section>
  );
}

const lead: CSSProperties = {
  margin: 0,
  fontSize: 13,
  lineHeight: 1.5,
  color: COLOR.textDim,
};

const actions: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
  gap: 8,
};

const secondary: CSSProperties = {
  display: "grid",
  gap: 2,
  alignContent: "center",
  minHeight: 56,
  padding: "10px 14px",
  borderRadius: RADIUS.control,
  border: `1px solid ${COLOR.borderStrong}`,
  background: COLOR.panelSoft,
  color: COLOR.text,
  textAlign: "left",
  textDecoration: "none",
  cursor: "pointer",
};

const primary: CSSProperties = {
  ...secondary,
  border: "1px solid rgba(51,255,122,0.45)",
  background: COLOR.successSoft,
};

const actionTitle: CSSProperties = { fontSize: 14, fontWeight: 900 };

const actionMeta: CSSProperties = { fontSize: 11.5, fontWeight: 600, color: COLOR.textDim };

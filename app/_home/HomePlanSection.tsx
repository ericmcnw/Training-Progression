"use client";

// This week's planned targets across every active program, grouped by where
// they get done, with the days the calendar already has them on. Renders
// nothing when no program plans anything.

import Link from "next/link";
import type { CSSProperties } from "react";
import CollapsibleSection from "./CollapsibleSection";
import { COLOR } from "./tokens";
import EnduranceQuickLogButton from "@/app/routines/EnduranceQuickLogButton";
import type { HomePlanGroup } from "./plan-data";
import type { WeekPlanLine } from "@/lib/program-plan";

const TONE_COLOR: Record<WeekPlanLine["tone"], string> = {
  up: "#7ce8aa",
  held: "#f5c46a",
  away: "#f5c46a",
  done: COLOR.textFaint,
  same: COLOR.textDim,
};

function statusText(line: WeekPlanLine) {
  const progress = line.progress ? ` · ${line.progress}` : "";
  if (line.tone === "done") return `done${progress}`;
  if (line.tone === "away") return `been a while · repeat first?${progress}`;
  if (line.tone === "held") return `held${progress}`;
  if (line.tone === "up") return `↑ this week${progress}`;
  return line.progress ? line.progress : "same as last week";
}

export default function HomePlanSection({ groups }: { groups: HomePlanGroup[] }) {
  if (groups.length === 0) return null;
  const open = groups.reduce((n, g) => n + g.lines.filter((l) => l.tone !== "done").length, 0);

  return (
    <CollapsibleSection
      title="This week's plan"
      count={open}
      countTone="accent"
      hint="from your programs"
      storageKey="home:plan:open"
      defaultOpen
    >
      <div style={grid}>
        {groups.map((group) => (
          <div key={group.key} style={card}>
            <div style={head}>
              <div style={{ minWidth: 0 }}>
                <div style={title}>{group.title}</div>
                <div style={meta}>
                  {group.scheduledDays.length ? `on the calendar ${group.scheduledDays.join(" · ")}` : "not on the calendar yet"}
                  {" · "}
                  {group.programs.map((program, i) => (
                    <span key={program.id}>
                      {i ? ", " : ""}
                      <Link href={`/programs/${program.id}?view=weekly`} style={programLink}>{program.name}</Link>
                    </span>
                  ))}
                </div>
              </div>
              {group.opensEnduranceDrawer ? (
                <EnduranceQuickLogButton label="Log" style={logButton} />
              ) : group.logHref ? (
                <Link href={group.logHref} style={logButton}>Log</Link>
              ) : null}
            </div>
            {group.lines.map((line) => (
              <div key={line.itemId} style={lineRow}>
                <span style={{ minWidth: 0 }}>
                  <span style={{ ...lineName, color: line.tone === "done" ? COLOR.textFaint : COLOR.text }}>{line.name}</span>
                  <span style={{ ...lineStatus, color: TONE_COLOR[line.tone] }}>{statusText(line)}</span>
                </span>
                <span style={{ ...lineTarget, color: line.tone === "done" ? COLOR.textFaint : COLOR.text }}>{line.target}</span>
              </div>
            ))}
          </div>
        ))}
      </div>
    </CollapsibleSection>
  );
}

const grid: CSSProperties = { display: "grid", gap: 10, gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 320px), 1fr))" };
const card: CSSProperties = { display: "grid", gap: 6, padding: 12, borderRadius: 12, border: `1px solid ${COLOR.border}`, background: COLOR.panelSoft, minWidth: 0 };
const head: CSSProperties = { display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 10, paddingBottom: 4 };
const title: CSSProperties = { fontSize: 14, fontWeight: 900 };
const meta: CSSProperties = { marginTop: 2, fontSize: 11.5, color: COLOR.textFaint, lineHeight: 1.4 };
const programLink: CSSProperties = { color: COLOR.textDim, textDecoration: "none", fontWeight: 800 };
const logButton: CSSProperties = { flexShrink: 0, minHeight: 36, padding: "6px 12px", borderRadius: 10, border: "1px solid rgba(51,255,122,0.45)", background: "rgba(51,255,122,0.1)", color: "#c9ffdc", fontSize: 12, fontWeight: 900, textDecoration: "none", display: "inline-flex", alignItems: "center" };
const lineRow: CSSProperties = { display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, minHeight: 40, borderTop: `1px solid ${COLOR.border}`, paddingTop: 6 };
const lineName: CSSProperties = { display: "block", fontSize: 13, fontWeight: 800 };
const lineStatus: CSSProperties = { display: "block", fontSize: 11.5, fontWeight: 700 };
const lineTarget: CSSProperties = { flexShrink: 0, fontSize: 13, fontWeight: 800, textAlign: "right" };

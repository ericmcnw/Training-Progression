import Link from "next/link";
import type React from "react";
import { formatUtcDateLabel } from "@/lib/dates";
import { markMilestoneMet, reopenMilestone } from "@/app/focus/actions";
import { startNextPhase } from "@/app/programs/actions";
import TodayReadingControl from "@/app/focus/TodayReadingControl";
import { levelColor } from "@/app/focus/[id]/InjuryPanel";
import type { FocusDetail } from "@/app/focus/data";
import type { ProgramDetailData } from "@/app/programs/detail-data";
import type { OverviewPhase, OverviewStep, PainSignal, ProgramOverviewData, Readout } from "@/app/programs/overview-data";
import { BlockSummary, GoalRow, NamedOutcomes, ProjectionLine } from "@/app/programs/[id]/ProgramDetailViews";

type Detail = NonNullable<ProgramDetailData>;

const day = (ymd: string) => formatUtcDateLabel(ymd, { month: "short", day: "numeric" });

export default function ProgramOverview({
  focus,
  detail,
  overview,
  accent,
}: {
  focus: FocusDetail;
  detail: Detail;
  overview: ProgramOverviewData;
  accent: string;
}) {
  const current = overview.currentIndex != null ? overview.phases[overview.currentIndex] : null;
  const ahead = overview.currentIndex != null ? overview.phases.slice(overview.currentIndex + 1) : [];
  const behind = overview.currentIndex != null ? overview.phases.slice(0, overview.currentIndex) : [];
  const activeBlocks = detail.blocks.filter((block) => block.status === "ACTIVE" || block.status === "DRAFT");

  return (
    <div style={stack}>
      {overview.next ? <NextPhaseCard programId={detail.id} next={overview.next} /> : null}

      <Section title={current ? "This phase" : "Steps"} meta={stepCount(overview.currentSteps)}>
        {current?.description ? <p style={bodyCopy}>{current.description}</p> : null}
        {overview.currentSteps.length ? (
          <div style={list}>
            {overview.currentSteps.map((step) => <StepRow key={step.id} step={step} accent={accent} />)}
          </div>
        ) : (
          <Empty>No steps in this phase yet. Add them from Edit.</Empty>
        )}
      </Section>

      <Section title="This week" action={<Link href={`/programs/${detail.id}?view=weekly`} style={textLink}>Weekly plan</Link>}>
        {overview.week.plan.length ? (
          <div style={list}>
            {overview.week.plan.map((line) => (
              <div key={line.name} style={row}>
                <span style={rowMain}>
                  <strong style={rowTitle}>{line.name}</strong>
                  <span style={rowMeta}>{line.done ? "done this week" : "target this week"}</span>
                </span>
                <span style={{ ...planValue, color: line.change === "up" ? "#7ce8aa" : "rgba(255,255,255,0.85)" }}>
                  {line.target}{line.change === "up" ? " ↑" : ""}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <Empty>
            No increases planned. <Link href={`/programs/${detail.id}?view=weekly`} style={inlineLink}>Plan an exercise</Link>
          </Empty>
        )}
        {detail.schedule.next.length ? (
          <div style={list}>
            {detail.schedule.next.slice(0, 4).map((session) => (
              <LogRow
                key={session.id}
                title={session.label}
                meta={`planned ${day(session.currentYmd)}`}
                href={session.routineId ? `/routines/${session.routineId}/log?plannedSessionId=${encodeURIComponent(session.id)}` : "/log"}
              />
            ))}
          </div>
        ) : null}
        <div style={list}>
          {overview.week.routines.map((routine) => (
            <LogRow
              key={routine.id}
              title={routine.name}
              meta={[
                routine.thisWeek ? `${routine.thisWeek}× this week` : "not yet this week",
                routine.lastYmd ? `last ${day(routine.lastYmd)}` : null,
              ].filter(Boolean).join(" · ")}
              href={`/routines/${routine.id}/log?programId=${encodeURIComponent(detail.id)}`}
            />
          ))}
        </div>
        {activeBlocks.map((block) => <BlockSummary key={block.id} block={block} accent={accent} />)}
      </Section>

      <Section title="Is it working?">
        {overview.pain ? <PainCard pain={overview.pain} /> : null}
        {overview.readouts.map((readout) =>
          readout.kind === "weekly" ? (
            <WeeklyCard key={readout.key} readout={readout} accent={accent} />
          ) : (
            <div key={readout.key} style={painCard}>
              <span style={eyebrow}>{readout.title}</span>
              <strong style={cardHeadline}>{readout.headline}</strong>
              {readout.meta ? <span style={rowMeta}>{readout.meta}</span> : null}
            </div>
          ),
        )}
        {overview.limiters.map((limiter) => (
          <div key={limiter.injuryName} style={limiterCard}>
            <span style={{ ...eyebrow, color: "#f5c46a" }}>Also limiting</span>
            <strong style={cardHeadline}>{limiter.injuryName} at {limiter.level}{limiter.steadyDays > 1 ? ` for ${limiter.steadyDays} days` : ""}</strong>
            <span style={rowMeta}>{limiter.zoneLabel}. Not this program&apos;s injury, but it can cap what this program asks for.</span>
          </div>
        ))}
        {detail.goalLinks.length || detail.frequencyGoalLinks.length ? (
          <div style={list}>
            {detail.goalLinks.map((link) => <GoalRow key={link.goal.id} name={link.goal.name} role={link.role} href={link.progress?.detailHref ?? `/plan/goals/${link.goal.id}`} progress={link.progress} accent={accent} />)}
            {detail.frequencyGoalLinks.map((link) => <GoalRow key={link.frequencyGoal.id} name={link.frequencyGoal.name} role={link.role} href={link.progress?.detailHref} progress={link.progress} accent={accent} />)}
          </div>
        ) : null}
        <div style={rowMeta}>
          {detail.activity.total8Weeks} sessions in 8 weeks{detail.activity.lastYmd ? ` · last ${day(detail.activity.lastYmd)}` : ""} ·{" "}
          <Link href={`/programs/${detail.id}?view=progress`} style={inlineLink}>History</Link>
        </div>
        {!overview.pain ? <ProjectionLine focus={focus} /> : null}
      </Section>

      <NamedOutcomes detail={detail} accent={accent} />

      {ahead.length || behind.length ? (
        <details style={disclosure}>
          <summary style={disclosureSummary}>
            {ahead.length ? `Road ahead · ${ahead.length} phase${ahead.length === 1 ? "" : "s"}` : "Earlier phases"}
          </summary>
          <div style={list}>
            {ahead.map((phase) => <PhaseSummary key={phase.id} phase={phase} accent={accent} />)}
            {behind.length ? <div style={{ ...eyebrow, marginTop: 6 }}>Done</div> : null}
            {behind.map((phase) => <PhaseSummary key={phase.id} phase={phase} accent={accent} />)}
          </div>
        </details>
      ) : null}

      {focus.description ? (
        <details style={disclosure}>
          <summary style={{ ...disclosureSummary, fontSize: 13, color: "rgba(255,255,255,0.62)" }}>About this program</summary>
          <p style={bodyCopy}>{focus.description}</p>
        </details>
      ) : null}
    </div>
  );
}

export function PhaseRail({ stages, accent }: { stages: Array<{ id: string; name: string; status: string }>; accent: string }) {
  if (stages.length === 0) return null;
  const active = stages.findIndex((stage) => stage.status === "ACTIVE");
  const current = active >= 0 ? active : Math.max(0, stages.findIndex((stage) => stage.status === "PLANNED"));
  return (
    <div style={{ display: "grid", gap: 7 }}>
      <div style={{ display: "grid", gridTemplateColumns: `repeat(${stages.length}, minmax(0, 1fr))`, gap: 4 }} aria-hidden>
        {stages.map((stage, index) => (
          <span
            key={stage.id}
            style={{
              height: 6,
              borderRadius: 99,
              background: index < current ? `${accent}88` : index === current ? accent : "rgba(255,255,255,0.12)",
            }}
          />
        ))}
      </div>
      <strong style={{ fontSize: 13 }}>
        Phase {current + 1} of {stages.length} · {stages[current].name}
      </strong>
    </div>
  );
}

function NextPhaseCard({ programId, next }: { programId: string; next: NonNullable<ProgramOverviewData["next"]> }) {
  const met = next.entry?.met === true;
  const start = startNextPhase.bind(null, programId);
  const carry = next.openSteps ? ` ${next.openSteps} open step${next.openSteps === 1 ? "" : "s"} come with you.` : "";
  return (
    <section style={{ ...gateCard, ...(met ? gateCardMet : null) }}>
      <span style={{ ...eyebrow, color: met ? "#7ce8aa" : "rgba(255,255,255,0.55)" }}>{met ? "Ready to move on" : "Next phase"}</span>
      <strong style={cardHeadline}>
        {next.name}
        {next.entry ? ` unlocks when: ${next.entry.label}` : ""}
      </strong>
      {next.entry?.summary ? <span style={{ fontSize: 13, color: met ? "#c9ffdc" : "rgba(255,255,255,0.72)" }}>{met ? "Met" : "Not yet"} · {next.entry.summary}</span> : null}
      {!next.entry ? <span style={rowMeta}>No logged condition; move on when it feels right.</span> : null}
      {met || !next.entry ? (
        <>
          {carry ? <span style={rowMeta}>{carry.trim()}</span> : null}
          <form action={start}>
            <button type="submit" style={met ? startButton : startButtonQuiet}>Start {next.name}</button>
          </form>
        </>
      ) : (
        <details>
          <summary style={{ ...rowMeta, cursor: "pointer", minHeight: 36, display: "flex", alignItems: "center" }}>Start anyway</summary>
          <form action={start} style={{ display: "grid", gap: 6, paddingTop: 4 }}>
            <span style={rowMeta}>The condition stays open.{carry}</span>
            <button type="submit" style={startButtonQuiet}>Start {next.name} now</button>
          </form>
        </details>
      )}
    </section>
  );
}

function StepRow({ step, accent }: { step: OverviewStep; accent: string }) {
  const toggle = (step.done ? reopenMilestone : markMilestoneMet).bind(null, step.id);
  const meta = [step.targetText, step.autoGate?.summary, step.carriedFrom ? `from ${step.carriedFrom}` : null].filter(Boolean).join(" · ");
  return (
    <form action={toggle}>
      <button type="submit" style={stepButton} aria-pressed={step.done} aria-label={`${step.done ? "Reopen" : "Mark done"}: ${step.label}`}>
        <span
          aria-hidden
          style={{
            ...checkbox,
            borderColor: step.done ? accent : "rgba(255,255,255,0.32)",
            background: step.done ? accent : "transparent",
          }}
        >
          {step.done ? "✓" : ""}
        </span>
        <span style={rowMain}>
          <span style={{ ...stepLabel, color: step.done ? "rgba(255,255,255,0.5)" : "rgba(255,255,255,0.92)" }}>{step.label}</span>
          {meta ? <span style={rowMeta}>{meta}</span> : null}
        </span>
      </button>
    </form>
  );
}

function PainCard({ pain }: { pain: PainSignal }) {
  const latest = pain.latest;
  const nextGate = pain.gates[0] ?? null;
  const headline = latest
    ? `${latest.level}${pain.steadyDays > 1 ? `, steady for ${pain.steadyDays} logged days` : ""}`
    : "No readings yet";
  return (
    <div style={painCard}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "baseline" }}>
        <span style={eyebrow}>{pain.zoneLabel} pain</span>
        <Link href="/profile/health" style={textLink}>Health</Link>
      </div>
      <strong style={cardHeadline}>{headline}</strong>
      {pain.peak ? <span style={rowMeta}>Worst in 4 weeks: {pain.peak.level} on {day(pain.peak.ymd)}</span> : null}
      <PainChart days={pain.days} threshold={nextGate?.threshold ?? null} label={pain.zoneLabel} />
      {pain.gates.length ? (
        <div style={{ display: "grid", gap: 4 }}>
          {pain.gates.map((gate) => (
            <span key={`${gate.phaseName}-${gate.days}`} style={{ fontSize: 12, color: gate.met ? "#c9ffdc" : "rgba(255,255,255,0.7)" }}>
              {gate.met ? "✓" : "○"} Phase {gate.phaseName}: ≤{gate.threshold} for {gate.days} days{gate.summary ? ` · ${gate.summary}` : ""}
            </span>
          ))}
        </div>
      ) : null}
      <TodayReadingControl zoneId={pain.primaryZoneId} current={pain.todayLevel} />
    </div>
  );
}

function PainChart({ days, threshold, label }: { days: PainSignal["days"]; threshold: number | null; label: string }) {
  const logged = days.filter((d) => d.level != null);
  const summary = logged.length
    ? `${label} pain over the last ${days.length} days: ${logged.length} readings, from ${Math.min(...logged.map((d) => d.level!))} to ${Math.max(...logged.map((d) => d.level!))}.`
    : `No ${label} pain readings in the last ${days.length} days.`;
  return (
    <div style={{ display: "grid", gap: 4 }}>
      <div role="img" aria-label={summary} style={chartBox}>
        {threshold != null ? (
          <span aria-hidden style={{ ...thresholdLine, bottom: `${(threshold / 10) * 100}%` }}>
            <span style={thresholdLabel}>≤{threshold}</span>
          </span>
        ) : null}
        {days.map((d) => (
          <span
            key={d.ymd}
            title={`${day(d.ymd)}: ${d.level != null ? `${d.level}/10` : "no reading"}`}
            style={{
              flex: 1,
              minWidth: 0,
              borderRadius: "4px 4px 1px 1px",
              height: d.level != null ? `${Math.max(8, (d.level / 10) * 100)}%` : 2,
              background: d.level != null ? levelColor(d.level) : "rgba(255,255,255,0.1)",
            }}
          />
        ))}
      </div>
      <div style={chartCaption}>
        <span>{day(days[0].ymd)}</span>
        <span>Today</span>
      </div>
    </div>
  );
}

function WeeklyCard({ readout, accent }: { readout: Extract<Readout, { kind: "weekly" }>; accent: string }) {
  const max = Math.max(1, readout.target?.value ?? 0, ...readout.values);
  const weeksAgo = (index: number) => {
    const back = readout.values.length - 1 - index;
    return back === 0 ? "Last 7 days" : `${back} week${back === 1 ? "" : "s"} back`;
  };
  return (
    <div style={painCard}>
      <span style={eyebrow}>{readout.title}</span>
      <strong style={cardHeadline}>{readout.headline}</strong>
      {readout.meta ? <span style={{ ...rowMeta, color: readout.target?.met ? "#c9ffdc" : rowMeta.color }}>{readout.meta}</span> : null}
      <div
        role="img"
        aria-label={`${readout.title}, last ${readout.values.length} weeks: ${readout.values.join(", ")} ${readout.unit}${readout.target ? `; target ${readout.target.value}` : ""}.`}
        style={chartBox}
      >
        {readout.target ? (
          <span aria-hidden style={{ ...thresholdLine, bottom: `${(readout.target.value / max) * 100}%` }}>
            <span style={thresholdLabel}>{readout.target.value}</span>
          </span>
        ) : null}
        {readout.values.map((value, index) => (
          <span
            key={index}
            title={`${weeksAgo(index)}: ${value} ${readout.unit}`}
            style={{
              flex: 1,
              minWidth: 0,
              borderRadius: "4px 4px 1px 1px",
              height: value > 0 ? `${Math.max(6, (value / max) * 100)}%` : 2,
              background: value > 0 ? accent : "rgba(255,255,255,0.1)",
            }}
          />
        ))}
      </div>
      <div style={chartCaption}>
        <span>{readout.values.length} weeks ago</span>
        <span>Last 7 days</span>
      </div>
      {readout.target ? <span style={rowMeta}>Dashed line: {readout.target.label}</span> : null}
    </div>
  );
}

function PhaseSummary({ phase, accent }: { phase: OverviewPhase; accent: string }) {
  const done = phase.steps.filter((s) => s.done).length;
  return (
    <details style={phaseCard}>
      <summary style={{ cursor: "pointer", display: "grid", gap: 2, minHeight: 44, alignContent: "center" }}>
        <strong style={rowTitle}>{phase.number} · {phase.name}</strong>
        <span style={rowMeta}>
          {phase.status === "COMPLETED" ? `done · ${done} of ${phase.steps.length} steps` : `${phase.steps.length} steps`}
          {phase.entry && phase.status !== "COMPLETED" ? ` · unlocks: ${phase.entry.label}` : ""}
        </span>
      </summary>
      <div style={{ ...list, paddingTop: 6 }}>
        {phase.steps.map((step) => <StepRow key={step.id} step={step} accent={accent} />)}
      </div>
    </details>
  );
}

function Section({ title, meta, action, children }: { title: string; meta?: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section style={section}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 10 }}>
        <h2 style={sectionTitle}>{title}</h2>
        {meta ? <span style={rowMeta}>{meta}</span> : action}
      </div>
      {children}
    </section>
  );
}

function LogRow({ title, meta, href }: { title: string; meta: string; href: string }) {
  return (
    <Link href={href} style={{ ...row, textDecoration: "none", color: "inherit" }}>
      <span style={rowMain}>
        <strong style={rowTitle}>{title}</strong>
        {meta ? <span style={rowMeta}>{meta}</span> : null}
      </span>
      <span style={{ fontSize: 13, fontWeight: 900, color: "#7ce8aa" }}>Log</span>
    </Link>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <div style={emptyBox}>{children}</div>;
}

function stepCount(steps: OverviewStep[]) {
  if (!steps.length) return undefined;
  return `${steps.filter((s) => s.done).length} of ${steps.length} done`;
}

const stack: React.CSSProperties = { display: "grid", gap: 22, minWidth: 0 };
const section: React.CSSProperties = { display: "grid", gap: 10, minWidth: 0 };
const sectionTitle: React.CSSProperties = { margin: 0, fontSize: 17, fontWeight: 900 };
const list: React.CSSProperties = { display: "grid", gap: 7 };
const row: React.CSSProperties = { minHeight: 52, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, padding: "9px 12px", borderRadius: 10, border: "1px solid rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.025)" };
const rowMain: React.CSSProperties = { display: "grid", gap: 2, minWidth: 0, textAlign: "left" };
const rowTitle: React.CSSProperties = { fontSize: 14, fontWeight: 800 };
const rowMeta: React.CSSProperties = { fontSize: 12, lineHeight: 1.45, color: "rgba(255,255,255,0.58)" };
const planValue: React.CSSProperties = { fontSize: 13, fontWeight: 800, flexShrink: 0 };
const bodyCopy: React.CSSProperties = { margin: 0, fontSize: 13, lineHeight: 1.5, color: "rgba(255,255,255,0.64)" };
const eyebrow: React.CSSProperties = { fontSize: 11, fontWeight: 900, letterSpacing: "0.05em", textTransform: "uppercase", color: "rgba(255,255,255,0.55)" };
const cardHeadline: React.CSSProperties = { fontSize: 15, fontWeight: 800, lineHeight: 1.35 };
const textLink: React.CSSProperties = { fontSize: 12, fontWeight: 800, color: "rgba(255,255,255,0.7)", textDecoration: "none", minHeight: 32, display: "inline-flex", alignItems: "center" };
const inlineLink: React.CSSProperties = { color: "#a9cbff", fontWeight: 800, textDecoration: "none" };
const emptyBox: React.CSSProperties = { padding: "11px 12px", borderRadius: 10, border: "1px dashed rgba(255,255,255,0.16)", fontSize: 13, color: "rgba(255,255,255,0.66)" };
const gateCard: React.CSSProperties = { display: "grid", gap: 8, padding: 14, borderRadius: 14, border: "1px solid rgba(255,255,255,0.14)", background: "rgba(255,255,255,0.03)" };
const gateCardMet: React.CSSProperties = { borderColor: "rgba(51,255,122,0.45)", background: "rgba(51,255,122,0.07)" };
const startButton: React.CSSProperties = { minHeight: 44, width: "100%", borderRadius: 10, border: "1px solid rgba(51,255,122,0.6)", background: "rgba(51,255,122,0.16)", color: "#c9ffdc", fontSize: 14, fontWeight: 800 };
const startButtonQuiet: React.CSSProperties = { ...startButton, borderColor: "rgba(255,255,255,0.18)", background: "rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.85)" };
const stepButton: React.CSSProperties = { width: "100%", minHeight: 52, padding: "10px 12px", display: "flex", gap: 12, alignItems: "flex-start", textAlign: "left", borderRadius: 10, border: "1px solid rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.025)", color: "inherit", fontWeight: 400 };
const checkbox: React.CSSProperties = { flexShrink: 0, width: 20, height: 20, marginTop: 1, borderRadius: 6, borderWidth: 1, borderStyle: "solid", display: "grid", placeItems: "center", fontSize: 13, fontWeight: 900, color: "#0b1220" };
const stepLabel: React.CSSProperties = { fontSize: 14, fontWeight: 700, lineHeight: 1.35 };
const painCard: React.CSSProperties = { display: "grid", gap: 8, padding: 12, borderRadius: 12, border: "1px solid rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.025)" };
const limiterCard: React.CSSProperties = { display: "grid", gap: 4, padding: 12, borderRadius: 12, border: "1px solid rgba(245,185,74,0.45)", background: "rgba(245,185,74,0.07)" };
const chartBox: React.CSSProperties = { position: "relative", height: 64, display: "flex", alignItems: "flex-end", gap: 2 };
const thresholdLine: React.CSSProperties = { position: "absolute", left: 0, right: 0, borderTop: "1px dashed rgba(255,255,255,0.4)", pointerEvents: "none" };
const thresholdLabel: React.CSSProperties = { position: "absolute", right: 0, top: -16, fontSize: 10, fontWeight: 800, color: "rgba(255,255,255,0.6)" };
const chartCaption: React.CSSProperties = { display: "flex", justifyContent: "space-between", fontSize: 10.5, color: "rgba(255,255,255,0.45)" };
const disclosure: React.CSSProperties = { borderTop: "1px solid rgba(255,255,255,0.1)", paddingTop: 8 };
const disclosureSummary: React.CSSProperties = { minHeight: 44, display: "flex", alignItems: "center", fontSize: 15, fontWeight: 900, cursor: "pointer" };
const phaseCard: React.CSSProperties = { padding: "4px 12px 8px", borderRadius: 10, border: "1px solid rgba(255,255,255,0.08)" };

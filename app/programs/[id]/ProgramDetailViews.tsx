import Link from "next/link";
import InjuryPanel from "@/app/focus/[id]/InjuryPanel";
import type { FocusDetail, InjuryPanelData } from "@/app/focus/data";
import type { ProgramDetailData } from "@/app/programs/detail-data";
import { addProgramGoalCheckpoint, continueProgramCycle } from "@/app/programs/actions";
import { todayAppYmd } from "@/lib/dates";

type Detail = NonNullable<ProgramDetailData>;
type SharedProps = { focus: FocusDetail; detail: Detail; accent: string };

export function ProgramProgress({ detail, injury, accent }: SharedProps & { injury: InjuryPanelData | null }) {
  const max = Math.max(1, ...detail.activity.weeklyCounts);
  // A checkpoint is evidence, not plan — recorded where the numbers are read
  // rather than inside the builder that authors the program.
  const todayYmd = todayAppYmd();
  return (
    <div style={viewStack}>
      <Section eyebrow="Evidence" title="Goal checkpoints" action={<Link href={`/programs/${detail.id}/edit`} style={textAction}>Manage checkpoints</Link>}>
        {detail.assessments.length ? (
          <div style={rowList}>
            {detail.assessments.map((assessment) => {
              const baseline = assessment.results.find((result) => result.isBaseline) ?? assessment.results[0] ?? null;
              const latest = assessment.results.at(-1) ?? null;
              return (
                <div key={assessment.id} style={assessmentRow}>
                  <div style={{ minWidth: 0 }}>
                    <strong style={rowTitle}>{assessment.name}</strong>
                    <div style={rowMeta}>{assessment.checkpointIntervalWeeks ? `Repeat every ${assessment.checkpointIntervalWeeks} weeks` : "Review at stage changes"}</div>
                  </div>
                  <div style={comparison}>
                    <span><small>Start</small><strong>{formatAssessment(baseline, assessment.unit)}</strong></span>
                    <span aria-hidden style={comparisonArrow}>to</span>
                    <span><small>Latest</small><strong>{formatAssessment(latest, assessment.unit)}</strong></span>
                    {formatTarget(assessment) ? (
                      <>
                        <span aria-hidden style={comparisonArrow}>{directionArrow(assessment.direction)}</span>
                        <span><small>Target</small><strong style={{ color: "#7ce8aa" }}>{formatTarget(assessment)}</strong></span>
                      </>
                    ) : null}
                  </div>
                  <form action={addProgramGoalCheckpoint} style={recordForm}>
                    <input type="hidden" name="programId" value={detail.id} />
                    <input type="hidden" name="goalId" value={assessment.id} />
                    <input name="measuredYmd" type="date" defaultValue={todayYmd} style={recordDate} aria-label={`${assessment.name} checkpoint date`} />
                    <input name="value" required placeholder={assessment.unit ? `New reading (${assessment.unit})` : "New reading"} style={recordInput} aria-label={`${assessment.name} reading`} />
                    <label style={recordToggle}><input type="checkbox" name="isBaseline" value="1" /> starting point</label>
                    <button type="submit" style={recordButton}>Record</button>
                  </form>
                </div>
              );
            })}
          </div>
        ) : <Empty message="No checkpoint has been recorded yet. Add a baseline when a repeatable measure would make progress clearer." actionHref={`/programs/${detail.id}/edit`} actionLabel="Record checkpoint" />}
      </Section>

      <Section eyebrow="Consistency" title="Training over eight weeks" action={<Link href={detail.activityLink.href} style={textAction}>Activity page</Link>}>
        {detail.activity.sportSessions > 0 ? <div style={legend}><span><i style={{ ...legendSwatch, background: accent }} />Sport</span><span><i style={{ ...legendSwatch, background: "rgba(255,255,255,0.26)" }} />Supporting</span></div> : null}
        <div style={chart} aria-label="Eight weeks of program sessions">
          {detail.activity.weeklyCounts.map((count, index) => {
            const sport = detail.activity.weeklySportCounts[index];
            const training = detail.activity.weeklyTrainingCounts[index];
            return (
              <div key={index} style={barColumn}>
                <div style={{ ...barStack, height: `${Math.max(count ? 12 : 2, (count / max) * 86)}px` }} title={`${sport} sport, ${training} supporting`}>
                  {sport ? <span style={{ flex: sport, background: accent }} /> : null}
                  {training ? <span style={{ flex: training, background: "rgba(255,255,255,0.26)" }} /> : null}
                  {!count ? <span style={{ flex: 1, background: "rgba(255,255,255,0.08)" }} /> : null}
                </div>
                <span style={barLabel}>{count}</span>
              </div>
            );
          })}
        </div>
        <div style={chartCaption}><span>8 weeks ago</span><span>This week</span></div>
      </Section>

      <Section eyebrow="Goals" title="Measured targets">
        {detail.goalLinks.length || detail.frequencyGoalLinks.length ? (
          <div style={rowList}>
            {detail.goalLinks.map((link) => <GoalRow key={link.goal.id} name={link.goal.name} role={link.role} href={link.progress?.detailHref ?? `/plan/goals/${link.goal.id}`} progress={link.progress} accent={accent} />)}
            {detail.frequencyGoalLinks.map((link) => <GoalRow key={link.frequencyGoal.id} name={link.frequencyGoal.name} role={link.role} href={link.progress?.detailHref} progress={link.progress} accent={accent} />)}
          </div>
        ) : <Empty message="No existing goals are connected to this program." actionHref={`/programs/${detail.id}/edit`} actionLabel="Connect goals" />}
      </Section>

      <NamedOutcomes detail={detail} accent={accent} />

      <Section eyebrow="History" title="Recent sessions" action={<Link href="/manual-log" style={textAction}>All history</Link>}>
        {detail.activity.recent.length ? (
          <div style={rowList}>
            {detail.activity.recent.map((log) => (
              <ActionRow key={log.id} title={log.routineName} meta={`${shortDate(log.ymd)}${log.durationMin ? ` / ${log.durationMin} min` : ""}`} href={`/routines/${log.routineId}/logs/${log.id}/details`} action={log.kind === "SPORT" ? "Sport" : "Support"} quiet />
            ))}
          </div>
        ) : <Empty message="No connected sessions were found in the last eight weeks." />}
      </Section>

      {injury ? <Section eyebrow="Health context" title="Injury trend" action={<Link href="/profile/health" style={textAction}>Health</Link>}><InjuryPanel injury={injury} /></Section> : null}

      <Section eyebrow="Next cycle" title="Continue without erasing this program" subtitle="Create a linked campaign and choose what should carry forward. This program and all of its history stay intact.">
        <form action={continueProgramCycle} style={cycleForm}>
          <input type="hidden" name="programId" value={detail.id} />
          <input name="name" placeholder={`${detail.name} - next cycle`} style={cycleNameInput} />
          <div style={cycleChecks}>
            <label><input type="checkbox" name="carryRoutines" value="1" defaultChecked /> routines</label>
            <label><input type="checkbox" name="carryGoals" value="1" defaultChecked /> goals</label>
            <label><input type="checkbox" name="carryTargets" value="1" defaultChecked /> open targets</label>
            <span style={rowMeta}>Goal checkpoints stay with their goals.</span>
          </div>
          <button type="submit" style={cycleButton}>Create next cycle</button>
        </form>
      </Section>
    </div>
  );
}

export function NamedOutcomes({ detail, accent }: { detail: Detail; accent: string }) {
  if (!detail.targetLists.length) return null;
  return (
    <Section eyebrow="Named targets" title="Specific things to complete">
      <div style={rowList}>
        {detail.targetLists.map((list) => {
          const items = list.items.filter((item) => item.status !== "DROPPED");
          const done = items.filter((item) => item.completed).length;
          const pct = items.length ? Math.round((done / items.length) * 100) : 0;
          return (
            <div key={list.id} style={outcomeGroup}>
              <div style={rowBetween}>
                <div><strong style={rowTitle}>{list.name}</strong><div style={rowMeta}>{done} of {items.length} complete</div></div>
                {list.sportSlug === "climbing" ? <Link href="/activities/climbing" style={textAction}>Climbing</Link> : null}
              </div>
              <ProgressBar value={pct} accent={accent} />
              <div style={compactItems}>
                {items.slice(0, 6).map((item) => (
                  <div key={item.id} style={compactItem}>
                    <span style={{ ...checkMark, borderColor: item.completed ? accent : "rgba(255,255,255,0.2)", color: item.completed ? accent : "transparent" }}>x</span>
                    {item.climbProblem?.location ? <Link href={`/activities/climbing/locations/${item.climbProblem.location.id}`} style={{ ...targetLink, textDecoration: item.completed ? "line-through" : "none", color: item.completed ? "rgba(255,255,255,0.44)" : undefined }}>{item.label}</Link> : <span style={{ flex: 1, textDecoration: item.completed ? "line-through" : "none", color: item.completed ? "rgba(255,255,255,0.44)" : undefined }}>{item.label}</span>}
                    {item.climbProblem ? <span style={rowMeta}>{item.climbProblem.grade}</span> : null}
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </Section>
  );
}

export function BlockSummary({ block, accent }: { block: Detail["blocks"][number]; accent: string }) {
  return (
    <div style={blockSummary}>
      <div style={rowBetween}>
        <div><strong style={rowTitle}>{block.name}</strong><div style={rowMeta}>{sentenceCase(block.status)} / {frequencyBlockLabel(block)}</div></div>
        {block.status === "ACTIVE" ? <span style={{ ...stateChip, borderColor: `${accent}66`, color: accent }}>Active</span> : null}
      </div>
      {block.items.length ? (
        <div style={compactItems}>{block.items.map((item) => <div key={item.id} style={compactItem}><span>{item.label}</span><span style={rowMeta}>{frequencyLabel(item.minPerWeek, item.targetPerWeek, item.maxPerWeek)}</span></div>)}</div>
      ) : <div style={rowMeta}>No repeatable work has been added.</div>}
    </div>
  );
}

export function GoalRow({ name, role, href, progress, accent }: { name: string; role: string; href?: string | null; progress: Detail["goalLinks"][number]["progress"]; accent: string }) {
  const content = (
    <>
      <div style={rowBetween}><div style={{ minWidth: 0 }}><strong style={rowTitle}>{name}</strong><div style={rowMeta}>{progress?.summaryLabel ?? "Waiting for matching logs"}</div></div><span style={rowMeta}>{role.toLowerCase()}</span></div>
      {progress ? <><div style={goalNumbers}><strong>{progress.actualDisplay}</strong><span style={rowMeta}>of {progress.targetDisplay}</span><span style={{ ...rowMeta, marginLeft: "auto" }}>{progress.timeframeStatusLabel}</span></div><ProgressBar value={progress.fractionComplete * 100} accent={accent} /></> : null}
    </>
  );
  return href ? <Link href={href} style={goalRow}>{content}</Link> : <div style={goalRow}>{content}</div>;
}

export function ProjectionLine({ focus }: { focus: FocusDetail }) {
  const projection = focus.projection;
  if (!projection.targetYmd && !projection.projectedCompletionYmd) return null;
  const headline = projection.status === "behind" ? `${projection.driftDays ?? 0} days behind the current estimate` : projection.status === "ahead" ? `${Math.abs(projection.driftDays ?? 0)} days ahead of the estimate` : projection.status === "on_track" ? "The roadmap is on track" : projection.status === "done" ? "Roadmap complete" : "Projected from milestone durations";
  return <Notice tone={projection.status === "behind" ? "warn" : "info"} title={headline}>{projection.projectedCompletionYmd ? `Projected ${shortDate(projection.projectedCompletionYmd)}.` : ""}{projection.targetYmd ? ` Target ${shortDate(projection.targetYmd)}.` : ""}</Notice>;
}

function Section({ eyebrow, title, subtitle, action, children }: { eyebrow: string; title: string; subtitle?: string; action?: React.ReactNode; children: React.ReactNode }) {
  return <section style={section}><div style={sectionHead}><div style={{ minWidth: 0 }}><div style={eyebrowStyle}>{eyebrow}</div><h2 style={sectionTitle}>{title}</h2>{subtitle ? <p style={sectionSubtitle}>{subtitle}</p> : null}</div>{action}</div>{children}</section>;
}

function ActionRow({ title, meta, href, action, quiet = false }: { title: string; meta?: string | null; href: string; action: string; quiet?: boolean }) {
  return <Link href={href} style={{ ...actionRow, background: quiet ? "transparent" : "rgba(255,255,255,0.025)" }}><div style={{ minWidth: 0 }}><strong style={rowTitle}>{title}</strong>{meta ? <div style={rowMeta}>{meta}</div> : null}</div><span style={rowAction}>{action}</span></Link>;
}

function ProgressBar({ value, accent }: { value: number; accent: string }) { return <div style={progressTrack}><div style={{ ...progressFill, width: `${Math.min(100, Math.max(0, value))}%`, background: accent }} /></div>; }

function Empty({ message, actionHref, actionLabel }: { message: string; actionHref?: string; actionLabel?: string }) {
  return <div style={empty}><span>{message}</span>{actionHref && actionLabel ? <Link href={actionHref} style={textAction}>{actionLabel}</Link> : null}</div>;
}

function Notice({ tone, title, children }: { tone: "warn" | "info"; title: string; children: React.ReactNode }) {
  return <div style={{ ...notice, borderColor: tone === "warn" ? "rgba(251,191,36,0.35)" : "rgba(96,165,250,0.3)", background: tone === "warn" ? "rgba(251,191,36,0.06)" : "rgba(96,165,250,0.06)" }}><strong>{title}</strong><span>{children}</span></div>;
}

function formatAssessment(result: Detail["assessments"][number]["results"][number] | null, unit: string | null) {
  if (!result) return "Not set";
  if (result.numerator != null && result.denominator != null) return `${result.numerator}/${result.denominator}`;
  if (result.numberValue != null) return `${result.numberValue}${unit ? ` ${unit}` : ""}`;
  return result.textValue ?? "Recorded";
}

function formatTarget(assessment: Detail["assessments"][number]) {
  if (assessment.targetNumerator != null && assessment.targetDenominator != null) return `${assessment.targetNumerator}/${assessment.targetDenominator}`;
  if (assessment.targetNumberValue != null) return `${assessment.targetNumberValue}${assessment.unit ? ` ${assessment.unit}` : ""}`;
  return assessment.targetTextValue || null;
}

function directionArrow(direction: Detail["assessments"][number]["direction"]) {
  if (direction === "HIGHER") return "up to";
  if (direction === "LOWER") return "down to";
  if (direction === "TARGET") return "hold at";
  return "to";
}

function frequencyLabel(min: number | null, target: number | null, max: number | null) { if (min != null && max != null) return `${min}-${max}x/week`; if (target != null) return `${target}x/week`; if (min != null) return `${min}+x/week`; return "Flexible"; }
function frequencyBlockLabel(block: Detail["blocks"][number]) { return [block.lengthWeeks ? `${block.lengthWeeks} weeks` : null, sentenceCase(block.scheduleMode)].filter(Boolean).join(" / "); }
function sentenceCase(value: string) { const text = value.toLowerCase().replaceAll("_", " "); return text.charAt(0).toUpperCase() + text.slice(1); }
function shortDate(ymd: string) { const [year, month, day] = ymd.split("-").map(Number); if (!year || !month || !day) return ymd; return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: year === new Date().getFullYear() ? undefined : "numeric", timeZone: "UTC" }).format(new Date(Date.UTC(year, month - 1, day))); }

const viewStack: React.CSSProperties = { display: "grid", gap: 0 };
const section: React.CSSProperties = { display: "grid", gap: 14, padding: "22px 0", borderTopWidth: 1, borderTopStyle: "solid", borderTopColor: "rgba(255,255,255,0.1)" };
const sectionHead: React.CSSProperties = { display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 14 };
const eyebrowStyle: React.CSSProperties = { marginBottom: 3, color: "rgba(255,255,255,0.42)", fontSize: 10, fontWeight: 900, textTransform: "uppercase" };
const sectionTitle: React.CSSProperties = { margin: 0, color: "rgba(255,255,255,0.96)", fontSize: 17, lineHeight: 1.25, fontWeight: 900 };
const sectionSubtitle: React.CSSProperties = { margin: "5px 0 0", maxWidth: 600, color: "rgba(255,255,255,0.55)", fontSize: 12, lineHeight: 1.5 };
const textAction: React.CSSProperties = { color: "rgba(255,255,255,0.7)", textDecoration: "none", fontSize: 11.5, fontWeight: 850, minHeight: 32, display: "inline-flex", alignItems: "center", flexShrink: 0 };
const rowList: React.CSSProperties = { display: "grid", gap: 7 };
const actionRow: React.CSSProperties = { minHeight: 54, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, padding: "9px 11px", borderRadius: 7, borderWidth: 1, borderStyle: "solid", borderColor: "rgba(255,255,255,0.09)", color: "inherit", textDecoration: "none" };
const rowAction: React.CSSProperties = { color: "rgba(255,255,255,0.72)", fontSize: 11, fontWeight: 900, flexShrink: 0 };
const rowTitle: React.CSSProperties = { display: "block", fontSize: 12.5, lineHeight: 1.35, fontWeight: 850 };
const rowMeta: React.CSSProperties = { color: "rgba(255,255,255,0.5)", fontSize: 10.5, lineHeight: 1.45 };
const empty: React.CSSProperties = { minHeight: 50, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, padding: "10px 12px", borderRadius: 7, borderWidth: 1, borderStyle: "dashed", borderColor: "rgba(255,255,255,0.14)", color: "rgba(255,255,255,0.5)", fontSize: 11.5, lineHeight: 1.45 };
const notice: React.CSSProperties = { display: "grid", gap: 2, padding: "10px 12px", borderRadius: 7, borderWidth: 1, borderStyle: "solid", color: "rgba(255,255,255,0.7)", fontSize: 11.5, lineHeight: 1.45 };
const rowBetween: React.CSSProperties = { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 };
const stateChip: React.CSSProperties = { padding: "3px 7px", borderRadius: 99, borderWidth: 1, borderStyle: "solid", fontSize: 9.5, fontWeight: 900, flexShrink: 0 };
const blockSummary: React.CSSProperties = { display: "grid", gap: 7, padding: "10px 11px", borderRadius: 7, borderWidth: 1, borderStyle: "solid", borderColor: "rgba(255,255,255,0.09)", background: "rgba(255,255,255,0.02)" };
const compactItems: React.CSSProperties = { display: "grid" };
const compactItem: React.CSSProperties = { minHeight: 35, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, borderTopWidth: 1, borderTopStyle: "solid", borderTopColor: "rgba(255,255,255,0.055)", fontSize: 11.5 };
const assessmentRow: React.CSSProperties = { display: "grid", gridTemplateColumns: "minmax(0, 1fr) auto", alignItems: "center", gap: 14, padding: "11px", borderRadius: 7, borderWidth: 1, borderStyle: "solid", borderColor: "rgba(255,255,255,0.09)" };
const recordForm: React.CSSProperties = { gridColumn: "1 / -1", display: "flex", flexWrap: "wrap", alignItems: "center", gap: 6, paddingTop: 9, borderTop: "1px solid rgba(255,255,255,0.07)" };
const recordInput: React.CSSProperties = { minHeight: 44, minWidth: 0, flex: "1 1 150px", padding: "8px 10px", boxSizing: "border-box", borderWidth: 1, borderStyle: "solid", borderColor: "rgba(255,255,255,0.14)", borderRadius: 8, background: "#111827", color: "white", fontSize: 16 };
const recordDate: React.CSSProperties = { ...recordInput, flex: "0 1 150px" };
const recordToggle: React.CSSProperties = { display: "flex", alignItems: "center", gap: 5, fontSize: 11, color: "rgba(255,255,255,0.55)" };
const recordButton: React.CSSProperties = { minHeight: 44, padding: "0 14px", borderWidth: 1, borderStyle: "solid", borderColor: "rgba(51,255,122,0.3)", borderRadius: 8, background: "rgba(51,255,122,0.1)", color: "#7ce8aa", fontWeight: 900, cursor: "pointer" };
const comparison: React.CSSProperties = { display: "flex", alignItems: "center", gap: 10 };
const comparisonArrow: React.CSSProperties = { color: "rgba(255,255,255,0.32)", fontSize: 10 };
const chart: React.CSSProperties = { height: 114, display: "grid", gridTemplateColumns: "repeat(8, minmax(0, 1fr))", gap: 7, alignItems: "end", paddingTop: 8 };
const barColumn: React.CSSProperties = { height: "100%", display: "flex", flexDirection: "column", justifyContent: "flex-end", alignItems: "center", gap: 4 };
const barStack: React.CSSProperties = { width: "100%", maxWidth: 34, minHeight: 2, borderRadius: "4px 4px 1px 1px", overflow: "hidden", display: "flex", flexDirection: "column" };
const barLabel: React.CSSProperties = { color: "rgba(255,255,255,0.42)", fontSize: 9 };
const chartCaption: React.CSSProperties = { display: "flex", justifyContent: "space-between", color: "rgba(255,255,255,0.38)", fontSize: 9.5 };
const legend: React.CSSProperties = { display: "flex", gap: 12, flexWrap: "wrap", color: "rgba(255,255,255,0.55)", fontSize: 10, fontWeight: 800 };
const legendSwatch: React.CSSProperties = { width: 8, height: 8, borderRadius: 2, display: "inline-block", marginRight: 5 };
const goalRow: React.CSSProperties = { display: "grid", gap: 8, minHeight: 62, padding: "10px 11px", borderRadius: 7, borderWidth: 1, borderStyle: "solid", borderColor: "rgba(255,255,255,0.09)", color: "inherit", textDecoration: "none" };
const goalNumbers: React.CSSProperties = { display: "flex", alignItems: "baseline", gap: 5, fontSize: 12 };
const progressTrack: React.CSSProperties = { height: 5, borderRadius: 99, background: "rgba(255,255,255,0.08)", overflow: "hidden" };
const progressFill: React.CSSProperties = { height: "100%", borderRadius: 99 };
const outcomeGroup: React.CSSProperties = { display: "grid", gap: 9, padding: "11px", borderRadius: 7, borderWidth: 1, borderStyle: "solid", borderColor: "rgba(255,255,255,0.09)" };
const checkMark: React.CSSProperties = { width: 16, height: 16, display: "grid", placeItems: "center", borderRadius: 4, borderWidth: 1, borderStyle: "solid", fontSize: 9, flexShrink: 0 };
const targetLink: React.CSSProperties = { flex: 1, minWidth: 0, color: "inherit", textDecoration: "none" };
const cycleForm: React.CSSProperties = { display: "grid", gap: 10 };
const cycleNameInput: React.CSSProperties = { minHeight: 42, minWidth: 0, width: "100%", boxSizing: "border-box", padding: "8px 10px", borderRadius: 7, borderWidth: 1, borderStyle: "solid", borderColor: "rgba(255,255,255,0.14)", background: "#111827", color: "white", fontSize: 16 };
const cycleChecks: React.CSSProperties = { display: "flex", gap: 12, flexWrap: "wrap", color: "rgba(255,255,255,0.6)", fontSize: 11.5 };
const cycleButton: React.CSSProperties = { minHeight: 42, justifySelf: "start", padding: "0 13px", borderRadius: 7, borderWidth: 1, borderStyle: "solid", borderColor: "rgba(255,255,255,0.15)", background: "rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.75)", fontSize: 11.5, fontWeight: 900, cursor: "pointer" };

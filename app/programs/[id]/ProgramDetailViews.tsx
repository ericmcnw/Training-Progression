import Link from "next/link";
import FocusRoadmap from "@/app/focus/[id]/FocusRoadmap";
import InjuryPanel from "@/app/focus/[id]/InjuryPanel";
import type { FocusDetail, InjuryPanelData } from "@/app/focus/data";
import type { ProgramDetailData } from "@/app/programs/detail-data";

type Detail = NonNullable<ProgramDetailData>;
type SharedProps = { focus: FocusDetail; detail: Detail; accent: string };

export function ProgramOverview({ focus, detail, injury, accent }: SharedProps & { injury: InjuryPanelData | null }) {
  const activeStage = detail.stages.find((stage) => stage.status === "ACTIVE") ?? detail.stages[0] ?? null;
  const activeBlock = detail.blocks.find((block) => block.status === "ACTIVE") ?? detail.blocks.find((block) => block.status === "DRAFT") ?? null;
  const activeMilestones = focus.tracks.flatMap((track) => track.milestones.map((milestone) => ({ ...milestone, track: track.title }))).filter((milestone) => milestone.status === "ACTIVE").slice(0, 4);

  return <div style={stack}>
    {injury ? <InjuryPanel injury={injury} /> : <ProjectionCard focus={focus} />}

    <Section title="Right now" action={<Link href={`/programs/${focus.id}?view=plan`} style={sectionLink}>Open plan</Link>}>
      {activeStage || activeBlock || activeMilestones.length ? <div style={stackTight}>
        {activeStage ? <KeyRow label="Stage" value={activeStage.name} meta={activeStage.description} accent={accent} /> : null}
        {activeBlock ? <KeyRow label="Block" value={activeBlock.name} meta={activeBlock.lengthWeeks ? `${activeBlock.lengthWeeks} weeks · ${activeBlock.scheduleMode.toLowerCase()}` : activeBlock.scheduleMode.toLowerCase()} accent={accent} /> : null}
        {activeMilestones.map((milestone) => <KeyRow key={milestone.id} label={milestone.track} value={milestone.label} meta={milestone.targetText} accent={accent} />)}
      </div> : <Empty message="No active stage, block, or milestone yet." />}
    </Section>

    <Section title="Training that counts" action={<Link href={`/programs/${focus.id}/edit`} style={sectionLink}>Manage</Link>}>
      {detail.routines.length ? <div style={pillRow}>{detail.routines.map((routine) => <span key={routine.id} style={pill}>{routine.name}</span>)}</div> : <Empty message="Connect routines so their logs appear in program progress." />}
      <div style={metricRow}>
        {detail.activity.sportSessions > 0 ? <Metric value={detail.activity.sportSessions} label="sport sessions / 8 weeks" /> : <Metric value={detail.activity.total8Weeks} label="sessions / 8 weeks" />}
        {detail.activity.sportSessions > 0 ? <Metric value={detail.activity.trainingSessions} label="support sessions / 8 weeks" /> : null}
        <Metric value={detail.activity.lastYmd ?? "None"} label="last session" />
      </div>
    </Section>

    <OutcomeSection detail={detail} accent={accent} />
  </div>;
}

export function ProgramPlan({ focus, detail, accent }: SharedProps) {
  return <div style={stack}>
    <Section title="Stages" action={<Link href={`/programs/${focus.id}/edit`} style={sectionLink}>Edit structure</Link>}>
      {detail.stages.length ? <div style={stageRail}>
        {detail.stages.map((stage, index) => <div key={stage.id} style={stageRow}>
          <div style={{ ...stageMarker, borderColor: stage.status === "ACTIVE" ? accent : "rgba(255,255,255,0.18)", background: stage.status === "ACTIVE" ? `${accent}22` : "transparent" }}>{index + 1}</div>
          <div style={{ flex: 1, minWidth: 0 }}><div style={rowTitle}>{stage.name}</div><div style={rowMeta}>{stage.status.toLowerCase()}{stage.notBeforeYmd ? ` · not before ${stage.notBeforeYmd}` : ""}{stage.gates.length ? ` · ${stage.gates.length} gate${stage.gates.length === 1 ? "" : "s"}` : ""}</div>{stage.description ? <p style={rowDescription}>{stage.description}</p> : null}</div>
        </div>)}
      </div> : <Empty message="Stages are optional. Add them when the program has meaningful phases." />}
    </Section>

    <Section title="Blocks">
      {detail.blocks.length ? <div style={stackTight}>{detail.blocks.map((block) => <div key={block.id} style={blockCard}>
        <div style={rowBetween}><div><div style={rowTitle}>{block.name}</div><div style={rowMeta}>{block.status.toLowerCase()} · {block.scheduleMode.toLowerCase()}{block.lengthWeeks ? ` · ${block.lengthWeeks} weeks` : ""}</div></div>{block.stageId ? <span style={subtleChip}>staged</span> : null}</div>
        {block.description ? <p style={rowDescription}>{block.description}</p> : null}
        {block.items.length ? <div style={itemList}>{block.items.map((item) => <div key={item.id} style={itemRow}><span>{item.label}</span><span style={rowMeta}>{frequencyLabel(item.minPerWeek, item.targetPerWeek, item.maxPerWeek)}</span></div>)}</div> : <div style={emptyInline}>No weekly work added yet.</div>}
      </div>)}</div> : <Empty message="Blocks turn a stage into repeatable weekly work without duplicating routines." />}
    </Section>

    <Section title="Progression roadmap" subtitle="Milestones are the building blocks inside each progression track.">
      <FocusRoadmap tracks={focus.tracks} accent={accent} />
    </Section>
  </div>;
}

export function ProgramProgress({ detail, injury, accent }: SharedProps & { injury: InjuryPanelData | null }) {
  const max = Math.max(1, ...detail.activity.weeklyCounts);
  return <div style={stack}>
    {injury ? <InjuryPanel injury={injury} /> : null}
    <Section title="Training consistency" subtitle="Sport sessions and supporting work connected to this program.">
      {detail.activity.sportSessions > 0 ? <div style={legend}><span><i style={{ ...legendSwatch, background: accent }} />Sport</span><span><i style={{ ...legendSwatch, background: "rgba(255,255,255,0.24)" }} />Supporting</span></div> : null}
      <div style={chart} aria-label="Eight weeks of program sessions">
        {detail.activity.weeklyCounts.map((count, index) => {
          const sport = detail.activity.weeklySportCounts[index];
          const training = detail.activity.weeklyTrainingCounts[index];
          return <div key={index} style={barColumn}>
            <div style={{ ...barStack, height: `${Math.max(count ? 12 : 2, (count / max) * 76)}px` }} title={`${sport} sport, ${training} supporting`}>
              {sport > 0 ? <span style={{ flex: sport, background: accent }} /> : null}
              {training > 0 ? <span style={{ flex: training, background: "rgba(255,255,255,0.24)" }} /> : null}
              {count === 0 ? <span style={{ flex: 1, background: "rgba(255,255,255,0.08)" }} /> : null}
            </div>
            <span style={barLabel}>{count}</span>
          </div>;
        })}
      </div>
      <div style={chartCaption}><span>8 weeks ago</span><span>This week</span></div>
    </Section>

    <Section title="Goals">
      {detail.goalLinks.length || detail.frequencyGoalLinks.length ? <div style={stackTight}>
        {detail.goalLinks.map((link) => <GoalProgressRow key={link.goal.id} name={link.goal.name} role={link.role} href={link.progress?.detailHref ?? `/plan/goals/${link.goal.id}`} progress={link.progress} accent={accent} />)}
        {detail.frequencyGoalLinks.map((link) => <GoalProgressRow key={link.frequencyGoal.id} name={link.frequencyGoal.name} role={link.role} href={link.progress?.detailHref} progress={link.progress} accent={accent} />)}
      </div> : <Empty message="No goals are connected yet. The builder shows your existing goals so you can attach the right ones without duplicating them." />}
    </Section>

    <OutcomeSection detail={detail} accent={accent} />

    <Section title="Recent sessions">
      {detail.activity.recent.length ? <div style={stackTight}>{detail.activity.recent.map((log) => <Link key={log.id} href={`/routines/${log.routineId}/logs/${log.id}/details`} style={linkedRow}><div><div style={rowTitle}>{log.routineName}</div><div style={rowMeta}>{log.ymd}{log.durationMin ? ` · ${log.durationMin} min` : ""}</div></div><span style={subtleChip}>{log.kind === "SPORT" ? "sport" : "support"}</span></Link>)}</div> : <Empty message="No program sessions in the last eight weeks." />}
    </Section>
  </div>;
}

function OutcomeSection({ detail, accent }: { detail: Detail; accent: string }) {
  return <Section title="Named outcomes">
    {detail.targetLists.length ? <div style={stackTight}>{detail.targetLists.map((list) => {
      const visibleItems = list.items.filter((item) => item.status !== "DROPPED");
      const done = visibleItems.filter((item) => item.completed).length;
      const pct = visibleItems.length ? Math.round(done / visibleItems.length * 100) : 0;
      return <div key={list.id} style={blockCard}><div style={rowBetween}><div><div style={rowTitle}>{list.name}</div><div style={rowMeta}>{done}/{visibleItems.length} complete · {list.kind.toLowerCase()}</div></div></div><div style={smallTrack}><div style={{ ...smallFill, width: `${pct}%`, background: accent }} /></div>{visibleItems.slice(0, 6).map((item) => <div key={item.id} style={itemRow}><span style={{ color: item.completed ? "rgba(255,255,255,0.45)" : "inherit", textDecoration: item.completed ? "line-through" : "none" }}>{item.label}</span>{item.climbProblem ? <span style={rowMeta}>{item.climbProblem.grade}</span> : null}</div>)}</div>;
    })}</div> : <Empty message="Use a checklist for named climbs or skills, or a ladder for ordered progressions such as calisthenics." />}
  </Section>;
}

function GoalProgressRow({ name, role, href, progress, accent }: {
  name: string;
  role: string;
  href?: string | null;
  progress: Detail["goalLinks"][number]["progress"];
  accent: string;
}) {
  const body = <>
    <div style={goalHead}><div style={{ minWidth: 0 }}><div style={rowTitle}>{name}</div><div style={rowMeta}>{progress?.summaryLabel ?? "Progress is not available yet."}</div></div><span style={subtleChip}>{role.toLowerCase()}</span></div>
    {progress ? <><div style={goalNumbers}><strong>{progress.actualDisplay}</strong><span style={rowMeta}>of {progress.targetDisplay}</span><span style={{ ...rowMeta, marginLeft: "auto", color: progress.isAchieved ? "#7ce8aa" : undefined }}>{progress.timeframeStatusLabel}</span></div><div style={smallTrack}><div style={{ ...smallFill, width: `${Math.min(100, Math.max(0, progress.fractionComplete * 100))}%`, background: accent }} /></div></> : null}
  </>;
  return href ? <Link href={href} style={goalRow}>{body}</Link> : <div style={goalRow}>{body}</div>;
}

function ProjectionCard({ focus }: { focus: FocusDetail }) {
  const projection = focus.projection;
  if (!projection.targetYmd && !projection.projectedCompletionYmd) return null;
  const message = projection.status === "behind" ? `${projection.driftDays ?? 0} days behind projection` : projection.status === "ahead" ? `${Math.abs(projection.driftDays ?? 0)} days ahead` : projection.status === "on_track" ? "Projection is on track" : projection.status === "done" ? "Roadmap complete" : "Projection based on milestone durations";
  return <div style={projectionCard}><strong>{message}</strong><span style={rowMeta}>{projection.projectedCompletionYmd ? `Projected ${projection.projectedCompletionYmd}` : ""}{projection.targetYmd ? ` · target ${projection.targetYmd}` : ""}</span></div>;
}

function Section({ title, subtitle, action, children }: { title: string; subtitle?: string; action?: React.ReactNode; children: React.ReactNode }) { return <section style={section}><div style={sectionHead}><div><h2 style={sectionTitle}>{title}</h2>{subtitle ? <p style={sectionSubtitle}>{subtitle}</p> : null}</div>{action}</div>{children}</section>; }
function KeyRow({ label, value, meta, accent }: { label: string; value: string; meta?: string | null; accent: string }) { return <div style={keyRow}><span style={{ ...keyLabel, color: accent }}>{label}</span><div style={{ minWidth: 0 }}><div style={rowTitle}>{value}</div>{meta ? <div style={rowMeta}>{meta}</div> : null}</div></div>; }
function Metric({ value, label }: { value: string | number; label: string }) { return <div style={metric}><strong style={{ fontSize: 17 }}>{value}</strong><span style={rowMeta}>{label}</span></div>; }
function Empty({ message }: { message: string }) { return <div style={empty}>{message}</div>; }
function frequencyLabel(min: number | null, target: number | null, max: number | null) { if (min != null && max != null) return `${min}-${max}x/week`; if (target != null) return `${target}x/week`; if (min != null) return `${min}+x/week`; return "flexible"; }

const stack: React.CSSProperties = { display: "grid", gap: 14 };
const stackTight: React.CSSProperties = { display: "grid", gap: 8 };
const section: React.CSSProperties = { display: "grid", gap: 12, padding: 15, borderRadius: 10, border: "1px solid rgba(255,255,255,0.09)", background: "rgba(255,255,255,0.025)" };
const sectionHead: React.CSSProperties = { display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 10 };
const sectionTitle: React.CSSProperties = { margin: 0, fontSize: 14.5, fontWeight: 900 };
const sectionSubtitle: React.CSSProperties = { margin: "3px 0 0", color: "rgba(255,255,255,0.5)", fontSize: 11.5, lineHeight: 1.4 };
const sectionLink: React.CSSProperties = { color: "rgba(255,255,255,0.6)", textDecoration: "none", fontSize: 11.5, fontWeight: 850, minHeight: 32, display: "inline-flex", alignItems: "center" };
const keyRow: React.CSSProperties = { display: "grid", gridTemplateColumns: "74px minmax(0, 1fr)", gap: 10, padding: "8px 0", borderBottom: "1px solid rgba(255,255,255,0.05)" };
const keyLabel: React.CSSProperties = { fontSize: 10, fontWeight: 900, textTransform: "uppercase", paddingTop: 2 };
const rowTitle: React.CSSProperties = { fontSize: 12.5, fontWeight: 850, lineHeight: 1.35 };
const rowMeta: React.CSSProperties = { fontSize: 10.5, lineHeight: 1.4, color: "rgba(255,255,255,0.47)" };
const rowDescription: React.CSSProperties = { margin: "5px 0 0", fontSize: 11.5, lineHeight: 1.45, color: "rgba(255,255,255,0.58)" };
const pillRow: React.CSSProperties = { display: "flex", flexWrap: "wrap", gap: 7 };
const pill: React.CSSProperties = { padding: "5px 9px", borderRadius: 6, border: "1px solid rgba(255,255,255,0.11)", background: "rgba(255,255,255,0.04)", fontSize: 11.5, fontWeight: 750 };
const metricRow: React.CSSProperties = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(110px, 1fr))", gap: 8 };
const metric: React.CSSProperties = { display: "grid", gap: 2, padding: 10, borderRadius: 8, background: "rgba(0,0,0,0.14)" };
const empty: React.CSSProperties = { padding: 11, borderRadius: 8, border: "1px dashed rgba(255,255,255,0.13)", color: "rgba(255,255,255,0.48)", fontSize: 11.5, lineHeight: 1.45 };
const projectionCard: React.CSSProperties = { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap", padding: "10px 12px", border: "1px solid rgba(96,165,250,0.28)", borderRadius: 9, background: "rgba(96,165,250,0.07)", fontSize: 12 };
const stageRail: React.CSSProperties = { display: "grid", gap: 0 };
const stageRow: React.CSSProperties = { display: "flex", alignItems: "flex-start", gap: 10, padding: "9px 0", borderBottom: "1px solid rgba(255,255,255,0.06)" };
const stageMarker: React.CSSProperties = { width: 25, height: 25, borderRadius: 7, flexShrink: 0, display: "grid", placeItems: "center", border: "1px solid", fontSize: 10, fontWeight: 900 };
const blockCard: React.CSSProperties = { display: "grid", gap: 8, padding: 12, borderRadius: 8, border: "1px solid rgba(255,255,255,0.08)", background: "rgba(0,0,0,0.12)" };
const rowBetween: React.CSSProperties = { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 };
const subtleChip: React.CSSProperties = { padding: "3px 7px", borderRadius: 99, border: "1px solid rgba(255,255,255,0.12)", color: "rgba(255,255,255,0.45)", fontSize: 9.5 };
const itemList: React.CSSProperties = { display: "grid" };
const itemRow: React.CSSProperties = { minHeight: 34, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, borderBottom: "1px solid rgba(255,255,255,0.05)", fontSize: 11.5 };
const emptyInline: React.CSSProperties = { color: "rgba(255,255,255,0.4)", fontSize: 11 };
const chart: React.CSSProperties = { height: 104, display: "grid", gridTemplateColumns: "repeat(8, minmax(0, 1fr))", gap: 7, alignItems: "end", padding: "8px 4px 0" };
const barColumn: React.CSSProperties = { height: "100%", display: "flex", flexDirection: "column", justifyContent: "flex-end", alignItems: "center", gap: 4 };
const barStack: React.CSSProperties = { width: "100%", maxWidth: 34, minHeight: 2, borderRadius: "4px 4px 1px 1px", overflow: "hidden", display: "flex", flexDirection: "column" };
const barLabel: React.CSSProperties = { fontSize: 9, color: "rgba(255,255,255,0.4)" };
const chartCaption: React.CSSProperties = { display: "flex", justifyContent: "space-between", color: "rgba(255,255,255,0.38)", fontSize: 9.5 };
const legend: React.CSSProperties = { display: "flex", gap: 12, flexWrap: "wrap", color: "rgba(255,255,255,0.55)", fontSize: 10, fontWeight: 800 };
const legendSwatch: React.CSSProperties = { width: 8, height: 8, borderRadius: 2, display: "inline-block", marginRight: 5 };
const linkedRow: React.CSSProperties = { minHeight: 44, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, padding: "7px 9px", borderRadius: 7, border: "1px solid rgba(255,255,255,0.07)", textDecoration: "none", color: "inherit" };
const goalRow: React.CSSProperties = { display: "grid", gap: 8, minHeight: 58, padding: "9px 10px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.08)", textDecoration: "none", color: "inherit" };
const goalHead: React.CSSProperties = { display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 10 };
const goalNumbers: React.CSSProperties = { display: "flex", alignItems: "baseline", gap: 5, fontSize: 12 };
const smallTrack: React.CSSProperties = { height: 5, borderRadius: 99, background: "rgba(255,255,255,0.08)", overflow: "hidden" };
const smallFill: React.CSSProperties = { height: "100%", borderRadius: 99 };

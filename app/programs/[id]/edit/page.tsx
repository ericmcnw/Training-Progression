import Link from "next/link";
import { notFound } from "next/navigation";
import { getProgramDefinitionEditorData, getProgramDetailData, getProgramEditorOptions } from "@/app/programs/detail-data";
import FocusForm from "@/app/focus/FocusForm";
import {
  addProgramBlockRoutine,
  addProgramTargetItem,
  createPlannedSession,
  createProgramBlock,
  createProgramStage,
  createProgramTargetList,
  moveProgramTargetItem,
  removeProgramBlockItem,
  saveProgramRelationships,
  setProgramBlockStatus,
  setProgramStageStatus,
  setProgramTargetItemStatus,
  updatePlannedSession,
} from "@/app/programs/actions";
import { todayAppYmd } from "@/lib/dates";
import { NewGoalDrawerButton, NewRoutineDrawerButton } from "@/app/components/FormDrawerButtons";
import ProgramEditorNav, { type ProgramEditorStep } from "./ProgramEditorNav";
import AssessmentBuilder from "./AssessmentBuilder";
import AssessmentCard from "./AssessmentCard";

export const dynamic = "force-dynamic";

export default async function EditProgramPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [detail, options, definition] = await Promise.all([getProgramDetailData(id), getProgramEditorOptions(id), getProgramDefinitionEditorData(id)]);
  if (!detail || !options || !definition) notFound();

  const selectedRoutines = new Set(options.program.routineLinks.map((link) => link.routineId));
  const selectedGoals = new Set(options.program.goalLinks.map((link) => link.goalId));
  const selectedFrequencyGoals = new Set(options.program.frequencyGoalLinks.map((link) => link.frequencyGoalId));
  const scheduledCount = detail.schedule.missed.length + detail.schedule.next.length;
  const targetCount = detail.targetLists.reduce((sum, list) => sum + list.items.length, 0);
  const trainingCount = selectedRoutines.size + selectedGoals.size + selectedFrequencyGoals.size;
  const steps: ProgramEditorStep[] = [
    { id: "program-editor-step-1", number: "1", label: "Program setup", meta: `${definition.initial.milestones.length} outcomes · ${detail.assessments.length} baselines`, complete: definition.initial.milestones.length > 0 || detail.assessments.length > 0 },
    { id: "program-editor-step-2", number: "2", label: "Training inputs", meta: `${selectedRoutines.size} routines · ${selectedGoals.size + selectedFrequencyGoals.size} goals`, complete: trainingCount > 0 },
    { id: "program-editor-step-3", number: "3", label: "Stages", meta: `${detail.stages.length} defined`, complete: detail.stages.length > 0 },
    { id: "program-editor-step-4", number: "4", label: "Training blocks", meta: `${detail.blocks.length} defined`, complete: detail.blocks.length > 0 },
    { id: "program-editor-step-5", number: "5", label: "Schedule", meta: scheduledCount ? `${scheduledCount} placed` : "Nothing placed", complete: scheduledCount > 0 },
    { id: "program-editor-step-6", number: "6", label: "Targets and ladders", meta: targetCount ? `${targetCount} targets` : "No targets", complete: targetCount > 0 },
  ];
  // Land on the first thing still missing, not on the step just filled in.
  const openStep = steps.find((step) => !step.complete)?.number ?? "1";

  return (
    <main style={page} className="programEditor">
      <div style={topBar}>
        <Link href={`/programs/${id}`} style={quietLink}>Back to program</Link>
        <span style={savedHint}>One builder · saved by section</span>
      </div>

      <header style={{ display: "grid", gap: 5 }}>
        <h1 style={title}>Edit {detail.name}</h1>
        <p style={subtitle}>Each section saves on its own. Ticked steps are done — this opens on the first one that still needs you.</p>
      </header>

      <div className="programEditorWorkspace" style={workspace}>
        <aside className="programEditorSidebar" style={sidebar}>
          <ProgramEditorNav steps={steps} openStepId={`program-editor-step-${openStep}`} />
        </aside>
        <div className="programEditorCanvas" style={canvas}>
      <EditorSection openStep={openStep} number="1" title="Program setup" subtitle="Objective, timeline, starting point, and outcomes live together here.">
        <SetupPart number="1" title="Direction and timeline" subtitle={`${humanize(definition.initial.objectiveKind)} · ${humanize(definition.initial.timelineMode)}`}>
        <FocusForm
          initial={definition.initial}
          routines={definition.routines}
          exercises={definition.exercises}
          injuries={definition.injuries}
          stages={definition.stages}
          embedded
          panel="foundation"
        />
        </SetupPart>

        <SetupPart number="2" title="Outcomes and milestones" subtitle={`${definition.initial.milestones.length} defined`}>
        <FocusForm
          initial={definition.initial}
          routines={definition.routines}
          exercises={definition.exercises}
          injuries={definition.injuries}
          stages={definition.stages}
          embedded
          panel="milestones"
        />
        </SetupPart>

        <SetupPart number="3" title="Starting point and checkpoints" subtitle={`${detail.assessments.length} assessment${detail.assessments.length === 1 ? "" : "s"}`}>
        {detail.assessments.length ? <div style={list}>{detail.assessments.map((assessment) => (
          <AssessmentCard
            key={assessment.id}
            programId={id}
            assessment={assessment}
            suggestion={definition.assessmentSuggestions.find((candidate) => candidate.metricKey === assessment.metricKey) ?? null}
          />
        ))}</div> : <Empty text="No assessments yet. Add the test or measurement you want to compare over time." />}
        <details style={addPanel}>
          <summary style={addPanelSummary}>Add an assessment</summary>
          <div style={{ paddingTop: 12 }}>
            <AssessmentBuilder
              programId={id}
              pursuitKey={definition.initial.pursuitKey}
              objectiveKind={definition.initial.objectiveKind}
              exercises={definition.exercises}
              injuries={definition.injuries}
              sessionMetrics={definition.sessionMetrics}
              suggestions={definition.assessmentSuggestions}
            />
          </div>
        </details>
        </SetupPart>
      </EditorSection>

      <EditorSection openStep={openStep} number="2" title="Training inputs" subtitle="Connect the routines, performance goals, and frequency targets that move this program forward.">
        <div style={builderActions}>
          <span style={minorText}>Reuse what already exists. Create something only when the program genuinely needs it.</span>
          <div style={actionGroup}><NewRoutineDrawerButton style={smallCreateButton}>New routine</NewRoutineDrawerButton><NewGoalDrawerButton style={smallCreateButton}>New goal</NewGoalDrawerButton></div>
        </div>
        <form action={saveProgramRelationships} style={{ display: "grid", gap: 14 }}>
          <input type="hidden" name="programId" value={id} />
          <PickerGroup title="Routines" count={selectedRoutines.size}>
            {options.routines.map((routine) => (
              <CheckRow
                key={routine.id}
                name="routineId"
                value={routine.id}
                checked={selectedRoutines.has(routine.id)}
                label={routine.name}
                meta={`${routine.kind.toLowerCase()} · ${routine.domain}`}
              />
            ))}
          </PickerGroup>
          <PickerGroup title="Performance and volume goals" count={selectedGoals.size}>
            {options.goals.map((goal) => (
              <CheckRow key={goal.id} name="goalId" value={goal.id} checked={selectedGoals.has(goal.id)} label={goal.name} meta={goal.goalType.toLowerCase()} />
            ))}
          </PickerGroup>
          <PickerGroup title="Frequency goals" count={selectedFrequencyGoals.size}>
            {options.frequencyGoals.map((goal) => (
              <CheckRow
                key={goal.id}
                name="frequencyGoalId"
                value={goal.id}
                checked={selectedFrequencyGoals.has(goal.id)}
                label={goal.name}
                meta={`${goal.targetCount} per ${goal.targetInterval} ${goal.targetUnit.toLowerCase()}`}
              />
            ))}
          </PickerGroup>
          <button type="submit" style={primaryButton}>Save connections</button>
        </form>
      </EditorSection>

      <EditorSection openStep={openStep} number="3" title="Stages" subtitle="High-level phases such as Base, Build, Send season, or Return to sport.">
        {detail.stages.length ? (
          <div style={list}>
            {detail.stages.map((stage) => (
              <div key={stage.id} style={compactRow}>
                <span style={stateDot(stage.status)} />
                <div style={{ minWidth: 0, flex: 1 }}>
                  <strong>{stage.name}</strong>
                  <div style={minorText}>{stage.status.toLowerCase()} · {stage.blocks.length} block{stage.blocks.length === 1 ? "" : "s"}</div>
                </div>
                <div style={actionGroup}>
                  {stage.status === "PLANNED" ? <StatusForm action={setProgramStageStatus} programId={id} entityName="stageId" entityId={stage.id} status="ACTIVE" label="Start" /> : null}
                  {stage.status === "ACTIVE" ? <StatusForm action={setProgramStageStatus} programId={id} entityName="stageId" entityId={stage.id} status="COMPLETED" label="Complete" /> : null}
                  {stage.status === "COMPLETED" || stage.status === "SKIPPED" ? <StatusForm action={setProgramStageStatus} programId={id} entityName="stageId" entityId={stage.id} status="PLANNED" label="Reopen" /> : null}
                </div>
              </div>
            ))}
          </div>
        ) : <Empty text="No stages yet. Your existing milestones still remain the roadmap." />}
        <AddPanel label="Add a stage">
          <form action={createProgramStage} style={inlineForm}>
            <input type="hidden" name="programId" value={id} />
            <input name="name" placeholder="Stage name" required style={input} />
            <input name="notBeforeYmd" type="date" aria-label="Not before date" style={input} />
            <textarea name="description" placeholder="Purpose or exit condition" style={textarea} />
            <button type="submit" style={secondaryButton}>Create stage</button>
          </form>
        </AddPanel>
      </EditorSection>

      <EditorSection openStep={openStep} number="4" title="Training blocks" subtitle="A few weeks of repeatable work. Flexible blocks do not force exact dates.">
        {detail.blocks.length ? (
          <div style={list}>
            {detail.blocks.map((block) => (
              <div key={block.id} style={blockCard}>
                <div style={cardHead}>
                  <div>
                    <strong>{block.name}</strong>
                    <div style={minorText}>{block.lengthWeeks ? `${block.lengthWeeks} weeks · ` : ""}{block.scheduleMode.toLowerCase()} · {block.status.toLowerCase()}</div>
                  </div>
                  <div style={actionGroup}>
                    {block.status === "DRAFT" ? <StatusForm action={setProgramBlockStatus} programId={id} entityName="blockId" entityId={block.id} status="ACTIVE" label="Start" /> : null}
                    {block.status === "ACTIVE" ? <StatusForm action={setProgramBlockStatus} programId={id} entityName="blockId" entityId={block.id} status="COMPLETED" label="Complete" /> : null}
                    {block.status === "COMPLETED" || block.status === "ARCHIVED" ? <StatusForm action={setProgramBlockStatus} programId={id} entityName="blockId" entityId={block.id} status="DRAFT" label="Reopen" /> : null}
                  </div>
                </div>
                {block.items.map((item) => (
                  <div key={item.id} style={itemRow}>
                    <span>{item.label}</span>
                    <div style={actionGroup}><span style={minorText}>{item.targetPerWeek ? `${item.targetPerWeek}x/week` : "flexible"}</span><StatusForm action={removeProgramBlockItem} programId={id} entityName="itemId" entityId={item.id} label="Remove" tone="quiet" /></div>
                  </div>
                ))}
                <form action={addProgramBlockRoutine} style={miniForm}>
                  <input type="hidden" name="programId" value={id} />
                  <input type="hidden" name="blockId" value={block.id} />
                  <select name="routineId" required style={input} defaultValue="">
                    <option value="" disabled>Add a routine...</option>
                    {options.routines.map((routine) => <option key={routine.id} value={routine.id}>{routine.name}</option>)}
                  </select>
                  <input name="targetPerWeek" type="number" min="0.5" max="21" step="0.5" placeholder="times/week" style={smallInput} />
                  <button type="submit" style={iconButton} title="Add routine" aria-label={`Add routine to ${block.name}`}>+</button>
                </form>
              </div>
            ))}
          </div>
        ) : <Empty text="No blocks yet. Add one when the weekly structure is stable enough to repeat." />}
        <AddPanel label="Add a training block">
          <form action={createProgramBlock} style={inlineForm}>
            <input type="hidden" name="programId" value={id} />
            <input name="name" placeholder="Block name" required style={input} />
            <select name="stageId" style={input} defaultValue="">
              <option value="">No stage</option>
              {detail.stages.map((stage) => <option key={stage.id} value={stage.id}>{stage.name}</option>)}
            </select>
            <input name="lengthWeeks" type="number" min="1" max="52" placeholder="Weeks" style={input} />
            <button type="submit" style={secondaryButton}>Create block</button>
          </form>
        </AddPanel>
      </EditorSection>

      <EditorSection openStep={openStep} number="5" title="Two-week schedule" subtitle="Place the next few sessions without turning the whole program into a rigid calendar.">
        {detail.schedule.missed.length ? (
          <div style={scheduleGroup}>
            <div style={scheduleLabel}>Needs a decision</div>
            {detail.schedule.missed.map((session) => (
              <div key={session.id} className="programScheduleRow" style={scheduledRow}>
                <div style={{ minWidth: 0, flex: 1 }}><strong>{session.label}</strong><div style={minorText}>Missed {session.currentYmd}{session.pinned ? " · fixed" : ""}</div></div>
                <form action={updatePlannedSession} style={rescheduleForm}>
                  <input type="hidden" name="programId" value={id} /><input type="hidden" name="sessionId" value={session.id} />
                  <input name="targetYmd" type="date" defaultValue={todayAppYmd()} style={dateInput} />
                  <button name="mode" value="MOVE_ONE" type="submit" style={stateButton}>Move one</button>
                  {!session.pinned ? <button name="mode" value="SLIDE" type="submit" style={stateButton}>Slide later work</button> : null}
                  <button name="mode" value="SKIP" type="submit" style={quietActionButton}>Skip</button>
                </form>
              </div>
            ))}
          </div>
        ) : null}
        {detail.schedule.next.length ? (
          <div style={scheduleGroup}>
            <div style={scheduleLabel}>Coming up</div>
            {detail.schedule.next.map((session) => (
              <div key={session.id} className="programScheduleRow" style={scheduledRow}>
                <div style={{ minWidth: 0, flex: 1 }}><strong>{session.label}</strong><div style={minorText}>{session.currentYmd}{session.pinned ? " · fixed" : ""}</div></div>
                <form action={updatePlannedSession}><input type="hidden" name="programId" value={id} /><input type="hidden" name="sessionId" value={session.id} /><button name="mode" value="DELETE" type="submit" style={quietActionButton}>Remove</button></form>
              </div>
            ))}
          </div>
        ) : <Empty text="Nothing is dated yet. That is fine until the next week or two is concrete." />}
        <AddPanel label="Place a session">
          <form action={createPlannedSession} style={inlineForm}>
            <input type="hidden" name="programId" value={id} />
            <select name="blockItemId" style={input} defaultValue="">
              <option value="">Choose training item (optional)</option>
              {detail.blocks.flatMap((block) => block.items.map((item) => <option key={item.id} value={item.id}>{block.name}: {item.label}</option>))}
            </select>
            <select name="routineId" style={input} defaultValue="">
              <option value="">Or choose a routine</option>
              {options.routines.map((routine) => <option key={routine.id} value={routine.id}>{routine.name}</option>)}
            </select>
            <input name="label" placeholder="Label (if no item or routine)" style={input} />
            <input name="currentYmd" type="date" defaultValue={todayAppYmd()} required style={input} />
            <label style={baselineToggle}><input name="pinned" type="checkbox" value="1" /> Fixed date</label>
            <button type="submit" style={secondaryButton}>Add to schedule</button>
          </form>
        </AddPanel>
        <p style={scheduleNote}>Flexible sessions can slide together after a miss. Fixed sessions stay on their date. Nothing is moved without your choice.</p>
      </EditorSection>

      <EditorSection openStep={openStep} number="6" title="Named targets and ladders" subtitle="Tick lists for climbs or skills; progression ladders for ordered skills.">
        {detail.targetLists.map((targetList) => (
          <div key={targetList.id} style={blockCard}>
            <div style={cardHead}><div><strong>{targetList.name}</strong>{targetList.membershipSource === "CLIMB_TICK_LIST" ? <div style={minorText}>Synced from starred climbing problems</div> : null}</div><span style={typeChip}>{targetList.kind.toLowerCase()}</span></div>
            {targetList.items.map((item, index) => <div key={item.id} style={itemRow}>
              <span style={{ color: item.status === "DROPPED" ? "rgba(255,255,255,0.38)" : "inherit", textDecoration: item.completed ? "line-through" : "none" }}>{item.status === "DROPPED" ? "Dropped" : item.completed ? "Done" : "Open"} · {item.label}</span>
              {targetList.membershipSource === "PROGRAM" ? <div style={actionGroup}>
                <MoveTargetForm programId={id} itemId={item.id} direction="up" disabled={index === 0} />
                <MoveTargetForm programId={id} itemId={item.id} direction="down" disabled={index === targetList.items.length - 1} />
                {item.status === "ACTIVE" ? <StatusForm action={setProgramTargetItemStatus} programId={id} entityName="itemId" entityId={item.id} status="COMPLETED" label="Done" /> : <StatusForm action={setProgramTargetItemStatus} programId={id} entityName="itemId" entityId={item.id} status="ACTIVE" label="Reopen" />}
                {item.status !== "DROPPED" ? <StatusForm action={setProgramTargetItemStatus} programId={id} entityName="itemId" entityId={item.id} status="DROPPED" label="Drop" tone="quiet" /> : null}
              </div> : item.climbProblem?.location ? <Link href={`/activities/climbing/locations/${item.climbProblem.location.id}`} style={inlineLink}>{item.climbProblem.grade} · {item.climbProblem.location.name}</Link> : null}
            </div>)}
            {targetList.membershipSource === "PROGRAM" ? <form action={addProgramTargetItem} style={miniForm}>
                <input type="hidden" name="programId" value={id} />
                <input type="hidden" name="listId" value={targetList.id} />
                <input name="label" required placeholder="Add target" style={input} />
                <button type="submit" style={iconButton} title="Add target" aria-label={`Add target to ${targetList.name}`}>+</button>
              </form> : <Link href="/activities/climbing" style={actionLink}>Manage starred climbs</Link>}
          </div>
        ))}
        <AddPanel label="Add a target list or ladder">
          <form action={createProgramTargetList} style={inlineForm}>
            <input type="hidden" name="programId" value={id} />
            <input type="hidden" name="sportSlug" value={detail.pursuitKey ?? ""} />
            <input name="name" placeholder="List name" required style={input} />
            <select name="kind" style={input} defaultValue="CHECKLIST">
              <option value="CHECKLIST">Checklist</option>
              <option value="PROGRESSION">Progression ladder</option>
            </select>
            <button type="submit" style={secondaryButton}>Create list</button>
          </form>
        </AddPanel>
      </EditorSection>
        </div>
      </div>
      <style>{`
        .programEditorSidebar { display: none; }
        @media (min-width: 900px) {
          .programEditorWorkspace { grid-template-columns: 228px minmax(0, 1fr) !important; align-items: start; }
          .programEditorSidebar { display: block; }
          .programEditorCanvas details[data-program-editor-step]:not([open]) { display: none; }
        }
        @media (max-width: 899px) {
          .programEditorSectionBody { padding-left: 0 !important; }
          .programScheduleRow { align-items: stretch !important; flex-direction: column; }
        }
      `}</style>
    </main>
  );
}

function SetupPart({ number, title, subtitle, children }: { number: string; title: string; subtitle: string; children: React.ReactNode }) {
  return <section style={setupPart}>
    <header style={setupPartHeader}>
      <span style={setupPartNumber}>{number}</span>
      <div style={{ minWidth: 0 }}><h3 style={setupPartTitle}>{title}</h3><p style={setupPartSubtitle}>{subtitle}</p></div>
    </header>
    <div style={setupPartBody}>{children}</div>
  </section>;
}

function EditorSection({ number, title, subtitle, openStep, children }: { number: string; title: string; subtitle: string; openStep: string; children: React.ReactNode }) {
  return <details id={`program-editor-step-${number}`} data-program-editor-step open={number === openStep} style={section}><summary style={sectionHeader}><span style={numberChip}>{number}</span><div style={{ flex: 1, minWidth: 0 }}><h2 style={sectionTitle}>{title}</h2><p style={sectionSubtitle}>{subtitle}</p></div><span aria-hidden style={sectionChevron}>⌄</span></summary><div className="programEditorSectionBody" style={sectionBody}>{children}</div></details>;
}

function PickerGroup({ title, count, children }: { title: string; count: number; children: React.ReactNode }) {
  return <details style={picker}><summary style={pickerSummary}>{title}<span style={countChip}>{count} selected</span></summary><div style={pickerBody}>{children}</div></details>;
}

function AddPanel({ label, children }: { label: string; children: React.ReactNode }) {
  return <details style={addPanel}><summary style={addPanelSummary}>{label}</summary><div style={{ padding: "4px 0 2px" }}>{children}</div></details>;
}

function CheckRow({ name, value, checked, label, meta }: { name: string; value: string; checked: boolean; label: string; meta: string }) {
  return <label style={checkRow}><input type="checkbox" name={name} value={value} defaultChecked={checked} style={{ width: 18, height: 18, accentColor: "#7ce8aa" }} /><span style={{ flex: 1, minWidth: 0 }}><span style={{ display: "block", fontWeight: 800 }}>{label}</span><span style={minorText}>{meta}</span></span></label>;
}

function Empty({ text }: { text: string }) { return <div style={empty}>{text}</div>; }
function humanize(value: string) {
  return value.toLowerCase().replaceAll("_", " ").replace(/^./, (letter) => letter.toUpperCase());
}
function stateDot(status: string): React.CSSProperties { return { width: 9, height: 9, borderRadius: 99, flexShrink: 0, background: status === "ACTIVE" ? "#7ce8aa" : status === "COMPLETED" ? "#60a5fa" : "rgba(255,255,255,0.25)" }; }

function StatusForm({ action, programId, entityName, entityId, status, label, tone = "default" }: {
  action: (formData: FormData) => Promise<void>;
  programId: string;
  entityName: "stageId" | "blockId" | "itemId";
  entityId: string;
  status?: string;
  label: string;
  tone?: "default" | "quiet";
}) {
  return <form action={action}><input type="hidden" name="programId" value={programId} /><input type="hidden" name={entityName} value={entityId} />{status ? <input type="hidden" name="status" value={status} /> : null}<button type="submit" style={tone === "quiet" ? quietActionButton : stateButton}>{label}</button></form>;
}

function MoveTargetForm({ programId, itemId, direction, disabled }: { programId: string; itemId: string; direction: "up" | "down"; disabled: boolean }) {
  return <form action={moveProgramTargetItem}><input type="hidden" name="programId" value={programId} /><input type="hidden" name="itemId" value={itemId} /><input type="hidden" name="direction" value={direction} /><button type="submit" disabled={disabled} style={{ ...moveButton, opacity: disabled ? 0.28 : 1 }} title={`Move ${direction}`} aria-label={`Move target ${direction}`}>{direction === "up" ? "↑" : "↓"}</button></form>;
}

const page: React.CSSProperties = { width: "100%", minWidth: 0, maxWidth: "var(--app-width-wide)", margin: "0 auto", padding: "16px clamp(14px, 3vw, 32px) 96px", boxSizing: "border-box", display: "grid", gridTemplateColumns: "minmax(0, 1fr)", gap: 18 };
const workspace: React.CSSProperties = { minWidth: 0, display: "grid", gridTemplateColumns: "minmax(0, 1fr)", gap: 28 };
const sidebar: React.CSSProperties = { position: "sticky", top: 18, minWidth: 0, padding: "12px 0" };
const canvas: React.CSSProperties = { minWidth: 0, maxWidth: "var(--app-width-content)", width: "100%" };
const topBar: React.CSSProperties = { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 };
const quietLink: React.CSSProperties = { color: "rgba(255,255,255,0.68)", textDecoration: "none", fontSize: 13, fontWeight: 800 };
const savedHint: React.CSSProperties = { fontSize: 11, color: "rgba(255,255,255,0.42)" };
const title: React.CSSProperties = { margin: 0, fontSize: 24, lineHeight: 1.2, fontWeight: 900 };
const subtitle: React.CSSProperties = { margin: 0, fontSize: 13, lineHeight: 1.5, color: "rgba(255,255,255,0.6)" };
const section: React.CSSProperties = { scrollMarginTop: 18, borderTop: "1px solid rgba(255,255,255,0.11)", borderBottom: "1px solid rgba(255,255,255,0.08)", padding: "2px 0 0" };
const sectionHeader: React.CSSProperties = { display: "flex", gap: 12, alignItems: "flex-start", cursor: "pointer", padding: "18px 2px 16px", minHeight: 58, listStyle: "none" };
const sectionBody: React.CSSProperties = { display: "grid", gap: 18, padding: "2px 0 28px 38px" };
const sectionChevron: React.CSSProperties = { color: "rgba(255,255,255,0.4)", fontSize: 18, lineHeight: 1.2, flexShrink: 0 };
const numberChip: React.CSSProperties = { width: 24, height: 24, borderRadius: 6, display: "grid", placeItems: "center", flexShrink: 0, fontSize: 11, fontWeight: 900, color: "#7ce8aa", background: "rgba(51,255,122,0.1)", border: "1px solid rgba(51,255,122,0.28)" };
const sectionTitle: React.CSSProperties = { margin: 0, fontSize: 18, lineHeight: 1.25, fontWeight: 900 };
const sectionSubtitle: React.CSSProperties = { margin: "4px 0 0", maxWidth: 660, fontSize: 12.5, lineHeight: 1.5, color: "rgba(255,255,255,0.53)" };
const setupPart: React.CSSProperties = { display: "grid", gap: 14, padding: "4px 0 24px", borderBottomWidth: 1, borderBottomStyle: "solid", borderBottomColor: "rgba(255,255,255,0.08)" };
const setupPartHeader: React.CSSProperties = { display: "flex", alignItems: "center", gap: 10 };
const setupPartNumber: React.CSSProperties = { width: 22, height: 22, display: "grid", placeItems: "center", flexShrink: 0, borderRadius: 6, background: "rgba(51,255,122,0.1)", color: "#7ce8aa", fontSize: 10, fontWeight: 900 };
const setupPartTitle: React.CSSProperties = { margin: 0, fontSize: 14, lineHeight: 1.3 };
const setupPartSubtitle: React.CSSProperties = { margin: "2px 0 0", fontSize: 10.5, color: "rgba(255,255,255,0.42)" };
const setupPartBody: React.CSSProperties = { minWidth: 0, paddingLeft: 32 };
const actionLink: React.CSSProperties = { ...quietLink, minHeight: 42, display: "inline-flex", alignItems: "center", padding: "0 12px", border: "1px solid rgba(255,255,255,0.14)", borderRadius: 8 };
const minorText: React.CSSProperties = { fontSize: 11, lineHeight: 1.35, color: "rgba(255,255,255,0.48)" };
const picker: React.CSSProperties = { border: "1px solid rgba(255,255,255,0.09)", borderRadius: 8, overflow: "hidden" };
const pickerSummary: React.CSSProperties = { minHeight: 44, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, padding: "0 12px", cursor: "pointer", fontSize: 12.5, fontWeight: 850 };
const addPanel: React.CSSProperties = { borderTop: "1px solid rgba(255,255,255,0.08)" };
const addPanelSummary: React.CSSProperties = { minHeight: 44, display: "flex", alignItems: "center", cursor: "pointer", color: "#7ce8aa", fontSize: 12, fontWeight: 850, listStyle: "none" };
const countChip: React.CSSProperties = { fontSize: 10, color: "#7ce8aa", background: "rgba(51,255,122,0.08)", padding: "3px 7px", borderRadius: 99 };
const pickerBody: React.CSSProperties = { display: "grid", maxHeight: 320, overflowY: "auto", borderTop: "1px solid rgba(255,255,255,0.08)" };
const checkRow: React.CSSProperties = { minHeight: 48, display: "flex", alignItems: "center", gap: 10, padding: "8px 12px", borderBottom: "1px solid rgba(255,255,255,0.06)", fontSize: 12.5, cursor: "pointer" };
const primaryButton: React.CSSProperties = { minHeight: 44, borderRadius: 8, border: "1px solid rgba(51,255,122,0.38)", background: "rgba(51,255,122,0.12)", color: "#7ce8aa", fontWeight: 900, cursor: "pointer" };
const secondaryButton: React.CSSProperties = { minHeight: 42, borderRadius: 8, border: "1px solid rgba(255,255,255,0.16)", background: "rgba(255,255,255,0.06)", color: "white", fontWeight: 850, cursor: "pointer", padding: "0 14px" };
const input: React.CSSProperties = { minWidth: 0, width: "100%", minHeight: 42, borderRadius: 8, border: "1px solid rgba(255,255,255,0.14)", background: "#111827", color: "white", padding: "9px 11px", fontSize: 16, boxSizing: "border-box" };
const smallInput: React.CSSProperties = { ...input, width: 110 };
const textarea: React.CSSProperties = { ...input, minHeight: 70, resize: "vertical" };
const inlineForm: React.CSSProperties = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 8, alignItems: "start" };
const miniForm: React.CSSProperties = { display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", paddingTop: 8 };
const baselineToggle: React.CSSProperties = { minHeight: 42, display: "inline-flex", alignItems: "center", gap: 6, whiteSpace: "nowrap", fontSize: 11, color: "rgba(255,255,255,0.6)" };
const iconButton: React.CSSProperties = { width: 42, height: 42, flexShrink: 0, borderRadius: 8, border: "1px solid rgba(51,255,122,0.35)", background: "rgba(51,255,122,0.1)", color: "#7ce8aa", fontSize: 20, cursor: "pointer" };
const list: React.CSSProperties = { display: "grid", gap: 8 };
const compactRow: React.CSSProperties = { minHeight: 48, display: "flex", alignItems: "center", gap: 10, padding: "9px 11px", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 8 };
const blockCard: React.CSSProperties = { display: "grid", gap: 7, padding: 12, border: "1px solid rgba(255,255,255,0.09)", borderRadius: 8, background: "rgba(0,0,0,0.12)" };
const cardHead: React.CSSProperties = { display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 };
const itemRow: React.CSSProperties = { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, minHeight: 34, padding: "4px 0", borderBottom: "1px solid rgba(255,255,255,0.05)", fontSize: 12.5 };
const typeChip: React.CSSProperties = { fontSize: 9.5, textTransform: "uppercase", color: "rgba(255,255,255,0.55)", padding: "3px 7px", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 99 };
const actionGroup: React.CSSProperties = { display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 5, flexWrap: "wrap", flexShrink: 0 };
const stateButton: React.CSSProperties = { minHeight: 32, padding: "0 9px", borderRadius: 7, border: "1px solid rgba(51,255,122,0.3)", background: "rgba(51,255,122,0.08)", color: "#7ce8aa", fontSize: 10.5, fontWeight: 850, cursor: "pointer" };
const quietActionButton: React.CSSProperties = { ...stateButton, borderColor: "rgba(255,255,255,0.12)", background: "transparent", color: "rgba(255,255,255,0.5)" };
const moveButton: React.CSSProperties = { width: 32, height: 32, borderRadius: 7, border: "1px solid rgba(255,255,255,0.12)", background: "transparent", color: "rgba(255,255,255,0.65)", cursor: "pointer" };
const inlineLink: React.CSSProperties = { color: "rgba(255,255,255,0.55)", textDecoration: "none", fontSize: 10.5, textAlign: "right" };
const empty: React.CSSProperties = { padding: "12px", borderRadius: 8, border: "1px dashed rgba(255,255,255,0.14)", color: "rgba(255,255,255,0.48)", fontSize: 12, lineHeight: 1.5 };
const scheduleGroup: React.CSSProperties = { display: "grid", gap: 7 };
const scheduleLabel: React.CSSProperties = { fontSize: 10, fontWeight: 900, textTransform: "uppercase", color: "rgba(255,255,255,0.43)" };
const scheduledRow: React.CSSProperties = { minHeight: 54, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, padding: "9px 11px", borderRadius: 7, borderWidth: 1, borderStyle: "solid", borderColor: "rgba(255,255,255,0.09)" };
const rescheduleForm: React.CSSProperties = { display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 5, flexWrap: "wrap" };
const dateInput: React.CSSProperties = { ...input, width: 150, minHeight: 36, fontSize: 14 };
const scheduleNote: React.CSSProperties = { margin: 0, color: "rgba(255,255,255,0.48)", fontSize: 11, lineHeight: 1.45 };
const builderActions: React.CSSProperties = { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap" };
const smallCreateButton: React.CSSProperties = { minHeight: 36, display: "inline-flex", alignItems: "center", padding: "0 10px", borderRadius: 7, borderWidth: 1, borderStyle: "solid", borderColor: "rgba(255,255,255,0.13)", background: "rgba(255,255,255,0.035)", color: "rgba(255,255,255,0.68)", fontSize: 11, fontWeight: 850, cursor: "pointer" };

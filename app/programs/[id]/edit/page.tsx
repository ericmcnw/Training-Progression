import Link from "next/link";
import { notFound } from "next/navigation";
import { getProgramDefinitionEditorData, getProgramDetailData, getProgramEditorOptions } from "@/app/programs/detail-data";
import FocusForm from "@/app/focus/FocusForm";
import {
  addProgramPhaseRoutine,
  addProgramGoalCheckpoint,
  addProgramTargetItem,
  createPlannedSession,
  createProgramStage,
  createProgramTargetList,
  moveProgramTargetItem,
  removeProgramBlockItem,
  saveProgramRelationships,
  setProgramStageStatus,
  setProgramTargetItemStatus,
  updatePlannedSession,
} from "@/app/programs/actions";
import { todayAppYmd } from "@/lib/dates";
import { NewGoalDrawerButton, NewRoutineDrawerButton } from "@/app/components/FormDrawerButtons";
import ProgramEditorNav, { type ProgramEditorStep } from "./ProgramEditorNav";

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
  const hasNamedMeasure = detail.targetLists.length > 0;
  const currentWork = detail.blocks.flatMap((block) => block.items.map((item) => ({
    ...item,
    phaseName: detail.stages.find((stage) => stage.id === block.stageId)?.name ?? "Current phase",
  })));
  const goalCount = selectedGoals.size + selectedFrequencyGoals.size;
  const steps: ProgramEditorStep[] = [
    { id: "program-editor-step-1", number: "1", label: "Program setup", meta: `Purpose, details, goal${currentWork.length ? ", routines" : ""}`, complete: goalCount > 0 || hasNamedMeasure },
    { id: "program-editor-step-2", number: "2", label: "Phases", meta: detail.stages.length > 1 ? `${detail.stages.length} phases` : "Optional — one continuous stretch", complete: detail.stages.length > 1 },
    { id: "program-editor-step-3", number: "3", label: "Work and prescriptions", meta: currentWork.length ? `${currentWork.length} routines` : "Optional — add later", complete: currentWork.length > 0 },
    { id: "program-editor-step-4", number: "4", label: "Schedule", meta: scheduledCount ? `${scheduledCount} placed` : "Optional", complete: scheduledCount > 0 },
    { id: "program-editor-step-5", number: "5", label: "Named targets", meta: targetCount ? `${targetCount} targets` : "Optional", complete: targetCount > 0 },
  ];
  // Optional dates and targets are never treated as setup debt. Once the
  // required foundation is sound, open current work only when it is absent.
  const requiredGap = steps.slice(0, 2).find((step) => !step.complete);
  const openStep = requiredGap?.number ?? (currentWork.length ? "1" : "3");

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

        <SetupPart number="2" title="Goal or target" subtitle={goalCount ? `${goalCount} goals` : hasNamedMeasure ? `${detail.targetLists.length} target lists` : "Choose at least one"}>
        <div style={builderActions}>
          <span style={minorText}>At least one measurable destination. This is what the Program is for.</span>
          <div style={actionGroup}><NewGoalDrawerButton style={smallCreateButton}>New goal</NewGoalDrawerButton></div>
        </div>
        <form action={saveProgramRelationships} style={{ display: "grid", gap: 14 }}>
          <input type="hidden" name="programId" value={id} />
          {[...selectedRoutines].map((routineId) => <input key={routineId} type="hidden" name="routineId" value={routineId} />)}
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
          {hasNamedMeasure ? <p style={minorText}>This Program also uses {detail.targetLists.length} named target list{detail.targetLists.length === 1 ? "" : "s"} ({targetCount} current items). Manage them in stage 5.</p> : null}
          <button type="submit" style={primaryButton}>Save connections</button>
        </form>
        </SetupPart>

        <SetupPart number="3" title="Checkpoints" subtitle={`${detail.assessments.length} measured goal${detail.assessments.length === 1 ? "" : "s"}`}>
        {detail.assessments.length ? (
          <div style={list}>
            {detail.assessments.map((goal) => {
              const latest = goal.results.at(-1);
              const value = latest?.numberValue ?? latest?.textValue ?? null;
              return (
                <div key={goal.id} style={compactRow}>
                  <div style={{ minWidth: 0 }}>
                    <strong>{goal.name}</strong>
                    <div style={minorText}>{value != null ? `Latest checkpoint: ${value}${goal.unit ? ` ${goal.unit}` : ""}` : "No checkpoint recorded"}</div>
                  </div>
                  <Link href={`/goals/${encodeURIComponent(goal.id)}`} style={quietLink}>Open goal</Link>
                  <form action={addProgramGoalCheckpoint} style={miniForm}>
                    <input type="hidden" name="programId" value={id} />
                    <input type="hidden" name="goalId" value={goal.id} />
                    <input name="measuredYmd" type="date" defaultValue={todayAppYmd()} style={dateInput} aria-label="Checkpoint date" />
                    <input name="value" required placeholder={goal.unit ? `Value (${goal.unit})` : "Value or grade"} style={smallInput} />
                    <label style={minorText}><input type="checkbox" name="isBaseline" value="1" /> baseline</label>
                    <button type="submit" style={quietActionButton}>Record</button>
                  </form>
                </div>
              );
            })}
          </div>
        ) : <Empty text="Connect a measured goal to keep its baseline and checkpoints with the program." />}
        <p style={minorText}>This is measurement history only. Choose or change the Program goals above.</p>
        </SetupPart>

        <SetupPart number="4" title="Outcomes and milestones" subtitle={`${definition.initial.milestones.length} defined`}>
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
      </EditorSection>

      <EditorSection openStep={openStep} number="2" title="Phases" subtitle="Optional. A phase is a stretch of the Program where the work has one purpose — add one when the work will actually change.">
        {detail.stages.length ? (
          <div style={list}>
            {detail.stages.map((stage) => (
              <div key={stage.id} style={compactRow}>
                <span style={stateDot(stage.status)} />
                <div style={{ minWidth: 0, flex: 1 }}>
                  <strong>{stage.name}</strong>
                  <div style={minorText}>
                    {stage.status.toLowerCase()}
                    {phaseRange(stage.notBeforeYmd, stage.targetEndYmd) ? ` · ${phaseRange(stage.notBeforeYmd, stage.targetEndYmd)}` : ""}
                    {" · "}{detail.blocks.filter((block) => block.stageId === stage.id).reduce((sum, block) => sum + block.items.length, 0)} work items
                  </div>
                </div>
                <div style={actionGroup}>
                  {stage.status === "PLANNED" ? <StatusForm action={setProgramStageStatus} programId={id} entityName="stageId" entityId={stage.id} status="ACTIVE" label="Start" /> : null}
                  {stage.status === "ACTIVE" ? <StatusForm action={setProgramStageStatus} programId={id} entityName="stageId" entityId={stage.id} status="COMPLETED" label="Complete" /> : null}
                  {stage.status === "COMPLETED" || stage.status === "SKIPPED" ? <StatusForm action={setProgramStageStatus} programId={id} entityName="stageId" entityId={stage.id} status="PLANNED" label="Reopen" /> : null}
                </div>
              </div>
            ))}
          </div>
        ) : <Empty text="No phases yet. The Program runs as one continuous stretch until you add one." />}
        <p style={minorText}>Phases never advance on their own — starting the next one is always your call.</p>
        <AddPanel label="Add a phase">
          <form action={createProgramStage} style={inlineForm}>
            <input type="hidden" name="programId" value={id} />
            <p style={phaseIntro}>
              Is there a stretch of this Program that matters most — a prime season, a trip, an
              event? That goes here, inside the Program, rather than becoming the Program&rsquo;s
              own dates.
            </p>
            <input name="name" placeholder="Phase name — e.g. Send season" required style={input} />
            <div style={phaseDateRow}>
              <label style={dateField}>From<input name="notBeforeYmd" type="date" style={input} /></label>
              <label style={dateField}>To<input name="targetEndYmd" type="date" style={input} /></label>
            </div>
            <textarea name="description" placeholder="Purpose or exit condition" style={textarea} />
            <button type="submit" style={secondaryButton}>Create phase</button>
          </form>
        </AddPanel>
      </EditorSection>

      <EditorSection openStep={openStep} number="3" title="Work and prescriptions" subtitle="The routines available to train now. Dates are optional and belong in stage 4.">
        {currentWork.length ? (
          <div style={list}>
            {currentWork.map((item) => (
              <div key={item.id} style={itemRow}>
                <div><strong>{item.label}</strong><div style={minorText}>{item.phaseName}</div></div>
                <div style={actionGroup}><span style={minorText}>{item.targetPerWeek ? `${item.targetPerWeek}x/week` : "flexible"}</span><StatusForm action={removeProgramBlockItem} programId={id} entityName="itemId" entityId={item.id} label="Remove" tone="quiet" /></div>
              </div>
            ))}
          </div>
        ) : <Empty text="No current work yet. Add one routine to make this Program ready to train." />}
        <div style={builderActions}>
          <span style={minorText}>Add a routine here once. It remains flexible until you put it on a date.</span>
          <NewRoutineDrawerButton style={smallCreateButton}>New routine</NewRoutineDrawerButton>
        </div>
        <form action={addProgramPhaseRoutine} style={miniForm}>
          <input type="hidden" name="programId" value={id} />
          {detail.stages.length ? <select name="stageId" style={input} defaultValue={detail.stages.find((stage) => stage.status === "ACTIVE")?.id ?? detail.stages[0].id}>{detail.stages.map((stage) => <option key={stage.id} value={stage.id}>{stage.name}</option>)}</select> : null}
          <select name="routineId" required style={input} defaultValue=""><option value="" disabled>Add current work...</option>{options.routines.map((routine) => <option key={routine.id} value={routine.id}>{routine.name}</option>)}</select>
          <input name="targetPerWeek" type="number" min="0.5" max="21" step="0.5" placeholder="times/week" style={smallInput} />
          <button type="submit" style={secondaryButton}>Add work</button>
        </form>
        {detail.stages.length > 1 ? <p style={minorText}>Work is added to a phase. Manage the phases themselves in stage 2.</p> : null}
      </EditorSection>

      <EditorSection openStep={openStep} number="4" title="Put work on dates" subtitle="Optional. This does not add new training—it only gives current work a date in the next two weeks.">
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
        {currentWork.length ? (
          <AddPanel label="Choose work and a date">
            <form action={createPlannedSession} style={inlineForm}>
              <input type="hidden" name="programId" value={id} />
              <select name="blockItemId" required style={input} defaultValue="">
                <option value="" disabled>Choose current work</option>
                {currentWork.map((item) => <option key={item.id} value={item.id}>{item.label}{detail.stages.length > 1 ? ` · ${item.phaseName}` : ""}</option>)}
              </select>
              <input name="currentYmd" type="date" defaultValue={todayAppYmd()} required style={input} />
              <label style={baselineToggle}><input name="pinned" type="checkbox" value="1" /> Fixed date</label>
              <button type="submit" style={secondaryButton}>Add date</button>
            </form>
          </AddPanel>
        ) : <p style={scheduleNote}>Add current work in step 3 before putting anything on the calendar.</p>}
        <p style={scheduleNote}>Flexible sessions can slide together after a miss. Fixed sessions stay on their date. Nothing is moved without your choice.</p>
      </EditorSection>

      <EditorSection openStep={openStep} number="5" title="Named targets" subtitle="Optional activity targets such as climbs or skills.">
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

function phaseRange(from: string | null, to: string | null) {
  if (!from && !to) return null;
  const show = (ymd: string) => {
    const [y, m, d] = ymd.split("-").map(Number);
    return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: "UTC" }).format(new Date(Date.UTC(y, m - 1, d)));
  };
  if (from && to) return `${show(from)} – ${show(to)}`;
  return from ? `from ${show(from)}` : `until ${show(to!)}`;
}
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
// inlineForm flows children into columns; these two need the full row.
const phaseIntro: React.CSSProperties = { ...minorText, gridColumn: "1 / -1", margin: 0 };
const phaseDateRow: React.CSSProperties = { gridColumn: "1 / -1", display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: 8 };
const dateField: React.CSSProperties = { display: "grid", gap: 4, fontSize: 11, fontWeight: 800, color: "rgba(255,255,255,0.6)" };
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

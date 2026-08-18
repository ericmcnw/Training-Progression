import Link from "next/link";
import { notFound } from "next/navigation";
import { getProgramDetailData, getProgramEditorOptions } from "@/app/programs/detail-data";
import {
  addProgramBlockRoutine,
  addProgramTargetItem,
  createProgramBlock,
  createProgramStage,
  createProgramTargetList,
  saveProgramRelationships,
} from "@/app/programs/actions";

export const dynamic = "force-dynamic";

export default async function EditProgramPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [detail, options] = await Promise.all([getProgramDetailData(id), getProgramEditorOptions(id)]);
  if (!detail || !options) notFound();

  const selectedRoutines = new Set(options.program.routineLinks.map((link) => link.routineId));
  const selectedGoals = new Set(options.program.goalLinks.map((link) => link.goalId));
  const selectedFrequencyGoals = new Set(options.program.frequencyGoalLinks.map((link) => link.frequencyGoalId));

  return (
    <main style={page} className="programEditor">
      <div style={topBar}>
        <Link href={`/programs/${id}`} style={quietLink}>Back to program</Link>
        <span style={savedHint}>Changes save by section</span>
      </div>

      <header style={{ display: "grid", gap: 5 }}>
        <h1 style={title}>Build {detail.name}</h1>
        <p style={subtitle}>Start with the outcome, connect what counts, then shape the training into stages and blocks.</p>
      </header>

      <EditorSection number="1" title="Outcome and roadmap" subtitle="Name the result and the milestones that prove progress.">
        <div style={summaryRow}>
          <div>
            <strong>{detail.milestones.length} milestones</strong>
            <div style={minorText}>{detail.milestones.filter((m) => m.status === "ACHIEVED").length} achieved</div>
          </div>
          <Link href={`/focus/${id}/edit`} style={actionLink}>Edit details and milestones</Link>
        </div>
      </EditorSection>

      <EditorSection number="2" title="What contributes" subtitle="Logs from these routines and progress from these goals count toward this program.">
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

      <EditorSection number="3" title="Stages" subtitle="High-level phases such as Base, Build, Send season, or Return to sport.">
        {detail.stages.length ? (
          <div style={list}>
            {detail.stages.map((stage) => (
              <div key={stage.id} style={compactRow}>
                <span style={stateDot(stage.status)} />
                <div style={{ minWidth: 0, flex: 1 }}>
                  <strong>{stage.name}</strong>
                  <div style={minorText}>{stage.status.toLowerCase()} · {stage.blocks.length} block{stage.blocks.length === 1 ? "" : "s"}</div>
                </div>
              </div>
            ))}
          </div>
        ) : <Empty text="No stages yet. Your existing milestones still remain the roadmap." />}
        <form action={createProgramStage} style={inlineForm}>
          <input type="hidden" name="programId" value={id} />
          <input name="name" placeholder="Stage name" required style={input} />
          <input name="notBeforeYmd" type="date" aria-label="Not before date" style={input} />
          <textarea name="description" placeholder="Purpose or exit condition" style={textarea} />
          <button type="submit" style={secondaryButton}>Add stage</button>
        </form>
      </EditorSection>

      <EditorSection number="4" title="Training blocks" subtitle="A few weeks of repeatable work. Flexible blocks do not force exact dates.">
        {detail.blocks.length ? (
          <div style={list}>
            {detail.blocks.map((block) => (
              <div key={block.id} style={blockCard}>
                <div style={cardHead}>
                  <div>
                    <strong>{block.name}</strong>
                    <div style={minorText}>{block.lengthWeeks ? `${block.lengthWeeks} weeks · ` : ""}{block.scheduleMode.toLowerCase()} · {block.status.toLowerCase()}</div>
                  </div>
                </div>
                {block.items.map((item) => (
                  <div key={item.id} style={itemRow}>
                    <span>{item.label}</span>
                    <span style={minorText}>{item.targetPerWeek ? `${item.targetPerWeek}x/week` : "flexible"}</span>
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
        <form action={createProgramBlock} style={inlineForm}>
          <input type="hidden" name="programId" value={id} />
          <input name="name" placeholder="Block name" required style={input} />
          <select name="stageId" style={input} defaultValue="">
            <option value="">No stage</option>
            {detail.stages.map((stage) => <option key={stage.id} value={stage.id}>{stage.name}</option>)}
          </select>
          <input name="lengthWeeks" type="number" min="1" max="52" placeholder="Weeks" style={input} />
          <button type="submit" style={secondaryButton}>Add block</button>
        </form>
      </EditorSection>

      <EditorSection number="5" title="Named targets and ladders" subtitle="Tick lists for climbs or skills; progression ladders for ordered skills.">
        {detail.targetLists.map((targetList) => (
          <div key={targetList.id} style={blockCard}>
            <div style={cardHead}><strong>{targetList.name}</strong><span style={typeChip}>{targetList.kind.toLowerCase()}</span></div>
            {targetList.items.map((item) => <div key={item.id} style={itemRow}><span>{item.completed ? "Done" : "Open"} · {item.label}</span></div>)}
            <form action={addProgramTargetItem} style={miniForm}>
              <input type="hidden" name="programId" value={id} />
              <input type="hidden" name="listId" value={targetList.id} />
              <input name="label" required placeholder="Add target" style={input} />
              <button type="submit" style={iconButton} title="Add target" aria-label={`Add target to ${targetList.name}`}>+</button>
            </form>
          </div>
        ))}
        <form action={createProgramTargetList} style={inlineForm}>
          <input type="hidden" name="programId" value={id} />
          <input type="hidden" name="sportSlug" value={detail.pursuitKey ?? ""} />
          <input name="name" placeholder="List name" required style={input} />
          <select name="kind" style={input} defaultValue="CHECKLIST">
            <option value="CHECKLIST">Checklist</option>
            <option value="PROGRESSION">Progression ladder</option>
          </select>
          <button type="submit" style={secondaryButton}>Add list</button>
        </form>
      </EditorSection>
    </main>
  );
}

function EditorSection({ number, title, subtitle, children }: { number: string; title: string; subtitle: string; children: React.ReactNode }) {
  return <section style={section}><div style={sectionHeader}><span style={numberChip}>{number}</span><div><h2 style={sectionTitle}>{title}</h2><p style={sectionSubtitle}>{subtitle}</p></div></div>{children}</section>;
}

function PickerGroup({ title, count, children }: { title: string; count: number; children: React.ReactNode }) {
  return <details style={picker}><summary style={pickerSummary}>{title}<span style={countChip}>{count} selected</span></summary><div style={pickerBody}>{children}</div></details>;
}

function CheckRow({ name, value, checked, label, meta }: { name: string; value: string; checked: boolean; label: string; meta: string }) {
  return <label style={checkRow}><input type="checkbox" name={name} value={value} defaultChecked={checked} style={{ width: 18, height: 18, accentColor: "#7ce8aa" }} /><span style={{ flex: 1, minWidth: 0 }}><span style={{ display: "block", fontWeight: 800 }}>{label}</span><span style={minorText}>{meta}</span></span></label>;
}

function Empty({ text }: { text: string }) { return <div style={empty}>{text}</div>; }
function stateDot(status: string): React.CSSProperties { return { width: 9, height: 9, borderRadius: 99, flexShrink: 0, background: status === "ACTIVE" ? "#7ce8aa" : status === "COMPLETED" ? "#60a5fa" : "rgba(255,255,255,0.25)" }; }

const page: React.CSSProperties = { maxWidth: 720, margin: "0 auto", padding: "16px clamp(14px, 4vw, 28px) 96px", display: "grid", gap: 16 };
const topBar: React.CSSProperties = { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 };
const quietLink: React.CSSProperties = { color: "rgba(255,255,255,0.68)", textDecoration: "none", fontSize: 13, fontWeight: 800 };
const savedHint: React.CSSProperties = { fontSize: 11, color: "rgba(255,255,255,0.42)" };
const title: React.CSSProperties = { margin: 0, fontSize: 24, lineHeight: 1.2, fontWeight: 900 };
const subtitle: React.CSSProperties = { margin: 0, fontSize: 13, lineHeight: 1.5, color: "rgba(255,255,255,0.6)" };
const section: React.CSSProperties = { display: "grid", gap: 14, padding: 16, border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10, background: "rgba(255,255,255,0.025)" };
const sectionHeader: React.CSSProperties = { display: "flex", gap: 10, alignItems: "flex-start" };
const numberChip: React.CSSProperties = { width: 24, height: 24, borderRadius: 6, display: "grid", placeItems: "center", flexShrink: 0, fontSize: 11, fontWeight: 900, color: "#7ce8aa", background: "rgba(51,255,122,0.1)", border: "1px solid rgba(51,255,122,0.28)" };
const sectionTitle: React.CSSProperties = { margin: 0, fontSize: 15, fontWeight: 900 };
const sectionSubtitle: React.CSSProperties = { margin: "3px 0 0", fontSize: 12, lineHeight: 1.45, color: "rgba(255,255,255,0.55)" };
const summaryRow: React.CSSProperties = { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 };
const actionLink: React.CSSProperties = { ...quietLink, minHeight: 42, display: "inline-flex", alignItems: "center", padding: "0 12px", border: "1px solid rgba(255,255,255,0.14)", borderRadius: 8 };
const minorText: React.CSSProperties = { fontSize: 11, lineHeight: 1.35, color: "rgba(255,255,255,0.48)" };
const picker: React.CSSProperties = { border: "1px solid rgba(255,255,255,0.09)", borderRadius: 8, overflow: "hidden" };
const pickerSummary: React.CSSProperties = { minHeight: 44, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, padding: "0 12px", cursor: "pointer", fontSize: 12.5, fontWeight: 850 };
const countChip: React.CSSProperties = { fontSize: 10, color: "#7ce8aa", background: "rgba(51,255,122,0.08)", padding: "3px 7px", borderRadius: 99 };
const pickerBody: React.CSSProperties = { display: "grid", maxHeight: 320, overflowY: "auto", borderTop: "1px solid rgba(255,255,255,0.08)" };
const checkRow: React.CSSProperties = { minHeight: 48, display: "flex", alignItems: "center", gap: 10, padding: "8px 12px", borderBottom: "1px solid rgba(255,255,255,0.06)", fontSize: 12.5, cursor: "pointer" };
const primaryButton: React.CSSProperties = { minHeight: 44, borderRadius: 8, border: "1px solid rgba(51,255,122,0.38)", background: "rgba(51,255,122,0.12)", color: "#7ce8aa", fontWeight: 900, cursor: "pointer" };
const secondaryButton: React.CSSProperties = { minHeight: 42, borderRadius: 8, border: "1px solid rgba(255,255,255,0.16)", background: "rgba(255,255,255,0.06)", color: "white", fontWeight: 850, cursor: "pointer", padding: "0 14px" };
const input: React.CSSProperties = { minWidth: 0, width: "100%", minHeight: 42, borderRadius: 8, border: "1px solid rgba(255,255,255,0.14)", background: "#111827", color: "white", padding: "9px 11px", fontSize: 16, boxSizing: "border-box" };
const smallInput: React.CSSProperties = { ...input, width: 110 };
const textarea: React.CSSProperties = { ...input, minHeight: 70, resize: "vertical" };
const inlineForm: React.CSSProperties = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 8, alignItems: "start" };
const miniForm: React.CSSProperties = { display: "flex", gap: 8, alignItems: "center", paddingTop: 8 };
const iconButton: React.CSSProperties = { width: 42, height: 42, flexShrink: 0, borderRadius: 8, border: "1px solid rgba(51,255,122,0.35)", background: "rgba(51,255,122,0.1)", color: "#7ce8aa", fontSize: 20, cursor: "pointer" };
const list: React.CSSProperties = { display: "grid", gap: 8 };
const compactRow: React.CSSProperties = { minHeight: 48, display: "flex", alignItems: "center", gap: 10, padding: "9px 11px", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 8 };
const blockCard: React.CSSProperties = { display: "grid", gap: 7, padding: 12, border: "1px solid rgba(255,255,255,0.09)", borderRadius: 8, background: "rgba(0,0,0,0.12)" };
const cardHead: React.CSSProperties = { display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 };
const itemRow: React.CSSProperties = { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, minHeight: 34, padding: "4px 0", borderBottom: "1px solid rgba(255,255,255,0.05)", fontSize: 12.5 };
const typeChip: React.CSSProperties = { fontSize: 9.5, textTransform: "uppercase", color: "rgba(255,255,255,0.55)", padding: "3px 7px", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 99 };
const empty: React.CSSProperties = { padding: "12px", borderRadius: 8, border: "1px dashed rgba(255,255,255,0.14)", color: "rgba(255,255,255,0.48)", fontSize: 12, lineHeight: 1.5 };

import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { isGuidedKind } from "@/lib/routines";
import { addGuidedStep, deleteGuidedStep, updateGuidedStep } from "./actions";

export const dynamic = "force-dynamic";

type Params = { id: string };

export default async function GuidedTemplatePage(props: { params: Promise<Params> | Params }) {
  const params = await Promise.resolve(props.params);
  const routineId = params?.id;
  if (!routineId) return <div style={{ padding: 20 }}>Missing routine id.</div>;

  const routine = await prisma.routine.findUnique({
    where: { id: routineId },
    select: {
      id: true,
      name: true,
      kind: true,
      category: true,
      guidedSteps: {
        orderBy: { sortOrder: "asc" },
        select: { id: true, title: true, durationSec: true, restSec: true, sortOrder: true },
      },
    },
  });
  if (!routine) return <div style={{ padding: 20 }}>Routine not found.</div>;
  if (!isGuidedKind(routine.kind)) return <div style={{ padding: 20 }}>This page is for GUIDED routines only.</div>;

  return (
    <div className="mobileGuidedTemplatePage" style={{ maxWidth: 980, margin: "0 auto", padding: 20 }}>
      <div className="mobileGuidedTemplateTopRow" style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12, flexWrap: "wrap" }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 900, margin: 0 }}>Guided Steps: {routine.name}</h1>
          <div style={{ marginTop: 6, opacity: 0.75, fontSize: 13 }}>{routine.category}</div>
        </div>
        <div className="mobileGuidedTemplateActions" style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <Link href={`/routines/${routineId}/edit`} style={linkBtn}>
            Back To Edit
          </Link>
          <Link href={`/routines/${routineId}/log-guided`} style={linkBtn}>
            Log Guided
          </Link>
        </div>
      </div>

      <section style={panel}>
        <div style={panelHeader}>ADD STEP</div>
        <form className="mobileGuidedTemplateGrid" action={addGuidedStep} style={{ padding: 14, display: "grid", gap: 10, gridTemplateColumns: "2fr 1fr 1fr auto", alignItems: "end" }}>
          <input type="hidden" name="routineId" value={routineId} />
          <label style={field}>
            <span>Title</span>
            <input name="title" style={input} placeholder="Breathing, hip opener, cooldown..." />
          </label>
          <label style={field}>
            <span>Duration (sec)</span>
            <input name="durationSec" style={input} inputMode="numeric" />
          </label>
          <label style={field}>
            <span>Rest (sec)</span>
            <input name="restSec" style={input} inputMode="numeric" />
          </label>
          <button type="submit" style={btn}>Add</button>
        </form>
      </section>

      <section style={{ ...panel, marginTop: 16 }}>
        <div style={panelHeader}>CURRENT STEPS</div>
        <div style={{ padding: 12, display: "grid", gap: 10 }}>
          {routine.guidedSteps.length === 0 && <div style={{ opacity: 0.75 }}>No steps yet.</div>}
          {routine.guidedSteps.map((step) => (
            <form key={step.id} action={updateGuidedStep} style={card}>
              <input type="hidden" name="routineId" value={routineId} />
              <input type="hidden" name="stepId" value={step.id} />
              <div style={{ fontSize: 12, fontWeight: 900, opacity: 0.8 }}>Step {step.sortOrder + 1}</div>
              <div className="mobileGuidedTemplateGrid" style={{ display: "grid", gap: 10, gridTemplateColumns: "2fr 1fr 1fr auto auto", alignItems: "end" }}>
                <label style={field}>
                  <span>Title</span>
                  <input name="title" defaultValue={step.title} style={input} />
                </label>
                <label style={field}>
                  <span>Duration (sec)</span>
                  <input name="durationSec" defaultValue={step.durationSec ?? ""} style={input} inputMode="numeric" />
                </label>
                <label style={field}>
                  <span>Rest (sec)</span>
                  <input name="restSec" defaultValue={step.restSec ?? ""} style={input} inputMode="numeric" />
                </label>
                <button type="submit" style={btn}>Save</button>
                <button type="submit" formAction={deleteGuidedStep} style={dangerBtn}>Delete</button>
              </div>
            </form>
          ))}
        </div>
      </section>
    </div>
  );
}

const panel: React.CSSProperties = {
  marginTop: 16,
  border: "1px solid rgba(128,128,128,0.35)",
  borderRadius: 12,
  overflow: "hidden",
};

const panelHeader: React.CSSProperties = {
  padding: "10px 14px",
  background: "rgba(128,128,128,0.14)",
  borderBottom: "1px solid rgba(128,128,128,0.25)",
  fontWeight: 900,
};

const card: React.CSSProperties = {
  border: "1px solid rgba(128,128,128,0.28)",
  borderRadius: 10,
  padding: 10,
  background: "rgba(128,128,128,0.06)",
  display: "grid",
  gap: 8,
};

const field: React.CSSProperties = {
  display: "grid",
  gap: 4,
  fontSize: 12,
  fontWeight: 800,
};

const input: React.CSSProperties = {
  width: "100%",
  padding: 8,
  border: "1px solid rgba(128,128,128,0.6)",
  borderRadius: 10,
  background: "#111827",
  color: "#ffffff",
};

const btn: React.CSSProperties = {
  padding: "9px 12px",
  border: "1px solid rgba(128,128,128,0.8)",
  borderRadius: 10,
  background: "rgba(128,128,128,0.12)",
  color: "inherit",
  fontWeight: 900,
};

const dangerBtn: React.CSSProperties = {
  ...btn,
  border: "1px solid rgba(255,80,80,0.65)",
};

const linkBtn: React.CSSProperties = {
  padding: "8px 12px",
  border: "1px solid rgba(128,128,128,0.8)",
  borderRadius: 10,
  textDecoration: "none",
  color: "inherit",
  fontWeight: 800,
  background: "rgba(128,128,128,0.12)",
};

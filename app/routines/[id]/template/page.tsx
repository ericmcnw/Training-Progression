import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { moveRoutineExercise, removeRoutineExercise, saveRoutineTemplate, setDefaultSets } from "./actions";
import ExercisePicker from "./ExercisePicker";
import TemplateMetricControl from "./TemplateMetricControl";

export const dynamic = "force-dynamic";

type Params = { id: string };

export default async function RoutineTemplatePage(props: { params: Promise<Params> | Params }) {
  const params = await Promise.resolve(props.params);
  const routineId = params?.id;

  if (!routineId) return <div style={{ padding: 20 }}>Missing routine id.</div>;

  const routine = await prisma.routine.findUnique({
    where: { id: routineId },
  });

  if (!routine) return <div style={{ padding: 20 }}>Routine not found.</div>;
  if (routine.kind !== "WORKOUT") {
    return (
      <div style={{ padding: 20 }}>
        This page is for WORKOUT routines only. <Link href="/routines">Back</Link>
      </div>
    );
  }

  const attached = await prisma.routineExercise.findMany({
    where: { routineId },
    orderBy: [{ sortOrder: "asc" }],
    include: { exercise: true },
  });

  const allExercises = await prisma.exercise.findMany({ orderBy: [{ name: "asc" }] });

  const attachedIds = new Set(attached.map((x) => x.exerciseId));
  const available = allExercises.filter((x) => !attachedIds.has(x.id));

  return (
    <div style={{ maxWidth: 980, margin: "0 auto", padding: 20 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 900, margin: 0 }}>Template: {routine.name}</h1>
          <div style={{ marginTop: 6, opacity: 0.75, fontSize: 13 }}>
            Attach exercises + set default sets (remembers extra rows).
          </div>
        </div>

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <form id="template-save-form" action={saveRoutineTemplate}>
            <input type="hidden" name="routineId" value={routineId} />
            <button type="submit" style={saveBtn}>
              Save
            </button>
          </form>
          <Link href="/exercises" style={linkBtn}>
            Exercises
          </Link>
          <Link href={`/routines/${routineId}/edit`} style={linkBtn}>
            Edit Routine
          </Link>
          <Link href="/routines" style={linkBtn}>
            Back
          </Link>
        </div>
      </div>

      <div style={{ marginTop: 16, border: border, borderRadius: 12, overflow: "hidden" }}>
        <div style={{ padding: "10px 14px", background: bgBar, borderBottom: border }}>
          <div style={{ fontWeight: 900, letterSpacing: 0.3 }}>ADD EXERCISE</div>
        </div>

        <div style={{ padding: 14 }}>
          <ExercisePicker routineId={routineId} available={available} />
          {available.length === 0 && (
            <div style={{ opacity: 0.75, marginTop: 8 }}>
              Every existing exercise is already attached. Use custom create above to add a new one.
            </div>
          )}
        </div>
      </div>

      <div style={{ marginTop: 16, border: border, borderRadius: 12, overflow: "hidden" }}>
        <div style={{ padding: "10px 14px", background: bgBar, borderBottom: border }}>
          <div style={{ fontWeight: 900, letterSpacing: 0.3 }}>EXERCISES IN THIS ROUTINE</div>
        </div>

        <div style={{ padding: 12, display: "grid", gap: 10 }}>
          {attached.map((re, i) => (
            <div key={re.id} style={{ border: border, borderRadius: 12, padding: 12, background: "rgba(128,128,128,0.06)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                <div>
                  <div style={{ fontWeight: 900, fontSize: 16 }}>
                    {i + 1}. {re.exercise.name}
                  </div>
                  <div style={{ marginTop: 4, fontSize: 13, opacity: 0.8 }}>
                    Unit: <b>{re.exercise.unit}</b> | Weight: <b>{re.exercise.supportsWeight ? "Yes" : "No"}</b>
                  </div>
                </div>

                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                  <TemplateMetricControl
                    routineId={routineId}
                    routineExerciseId={re.id}
                    initialUnit={re.exercise.unit}
                  />

                  <form action={moveRoutineExercise}>
                    <input type="hidden" name="routineId" value={routineId} />
                    <input type="hidden" name="routineExerciseId" value={re.id} />
                    <input type="hidden" name="dir" value="up" />
                    <button type="submit" style={btnSmall}>Up</button>
                  </form>

                  <form action={moveRoutineExercise}>
                    <input type="hidden" name="routineId" value={routineId} />
                    <input type="hidden" name="routineExerciseId" value={re.id} />
                    <input type="hidden" name="dir" value="down" />
                    <button type="submit" style={btnSmall}>Down</button>
                  </form>

                  <form action={setDefaultSets} style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    <input type="hidden" name="routineId" value={routineId} />
                    <input type="hidden" name="routineExerciseId" value={re.id} />
                    <label style={{ fontSize: 13, fontWeight: 800, opacity: 0.85 }}>Default sets</label>
                    <input
                      name="defaultSets"
                      style={{ ...inputStyle, width: 90 }}
                      inputMode="numeric"
                      defaultValue={re.defaultSets}
                    />
                    <button type="submit" style={btnSmall}>Save</button>
                  </form>

                  <form action={removeRoutineExercise}>
                    <input type="hidden" name="routineId" value={routineId} />
                    <input type="hidden" name="routineExerciseId" value={re.id} />
                    <button type="submit" style={{ ...btnSmall, borderColor: "rgba(255,0,0,0.55)" }}>
                      Remove
                    </button>
                  </form>
                </div>
              </div>
            </div>
          ))}

          {attached.length === 0 && (
            <div style={{ opacity: 0.75 }}>No exercises attached yet. Add one above.</div>
          )}
        </div>
      </div>
    </div>
  );
}

const border = "1px solid rgba(128,128,128,0.35)";
const bgBar = "rgba(128,128,128,0.14)";

const inputStyle: React.CSSProperties = {
  padding: 8,
  border: "1px solid rgba(128,128,128,0.6)",
  borderRadius: 10,
  background: "rgba(128,128,128,0.08)",
  color: "inherit",
  minWidth: 280,
};

const btnSmall: React.CSSProperties = {
  padding: "7px 10px",
  border: "1px solid rgba(128,128,128,0.8)",
  borderRadius: 10,
  background: "rgba(128,128,128,0.12)",
  color: "inherit",
  fontWeight: 900,
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

const saveBtn: React.CSSProperties = {
  padding: "8px 12px",
  border: "1px solid rgba(115,220,152,0.75)",
  borderRadius: 10,
  color: "inherit",
  fontWeight: 800,
  background: "rgba(115,220,152,0.16)",
};

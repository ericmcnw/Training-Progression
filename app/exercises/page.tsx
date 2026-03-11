import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { createExercise } from "./actions";

export const dynamic = "force-dynamic";

export default async function ExercisesPage() {
  const exercises = await prisma.exercise.findMany({
    orderBy: [{ name: "asc" }],
  });

  return (
    <div style={styles.container}>
      <div style={styles.topRow}>
        <div>
          <h1 style={styles.h1}>Exercises</h1>
          <div style={styles.sub}>Library of movements (reps/time + optional weight).</div>
        </div>

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <Link href="/routines" style={styles.linkBtn}>
            Back to Routines
          </Link>
        </div>
      </div>

      <div style={styles.panel}>
        <div style={styles.panelHeader}>NEW EXERCISE</div>

        <div style={{ padding: 14 }}>
          <form action={createExercise} style={{ display: "grid", gap: 12, maxWidth: 520 }}>
            <div>
              <label style={styles.label}>Name</label>
              <input
                name="name"
                style={styles.input}
                placeholder="Weighted Pull-Up, Lock-Off, Deadlift..."
              />
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div>
                <label style={styles.label}>Unit</label>
                <select name="unit" style={styles.input as React.CSSProperties} defaultValue="REPS">
                  <option value="REPS">REPS</option>
                  <option value="TIME">TIME (seconds)</option>
                </select>
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 22 }}>
                <input id="supportsWeight" name="supportsWeight" type="checkbox" />
                <label htmlFor="supportsWeight" style={{ fontWeight: 800 }}>
                  Supports Weight (lbs)
                </label>
              </div>
            </div>

            <button type="submit" style={styles.btn}>
              Create Exercise
            </button>
          </form>
        </div>
      </div>

      <div style={{ marginTop: 16, display: "grid", gap: 10 }}>
        {exercises.map((ex) => (
          <div key={ex.id} style={styles.card}>
            <div style={{ fontWeight: 900 }}>{ex.name}</div>
            <div style={{ marginTop: 4, fontSize: 13, opacity: 0.8 }}>
              Unit: <b>{ex.unit}</b> · Weight: <b>{ex.supportsWeight ? "Yes" : "No"}</b>
            </div>
          </div>
        ))}

        {exercises.length === 0 && (
          <div style={{ marginTop: 10, opacity: 0.75 }}>
            No exercises yet. Add your first one above.
          </div>
        )}
      </div>
    </div>
  );
}

const border = "1px solid rgba(128,128,128,0.35)";
const bgBar = "rgba(128,128,128,0.14)";

const styles = {
  container: { maxWidth: 980, margin: "0 auto", padding: 20 },
  topRow: { display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12 },
  h1: { fontSize: 26, fontWeight: 900 as const, margin: 0 },
  sub: { marginTop: 6, opacity: 0.75, fontSize: 13 },

  panel: { marginTop: 16, border, borderRadius: 12, overflow: "hidden" },
  panelHeader: { padding: "10px 14px", background: bgBar, borderBottom: border, fontWeight: 900 as const },

  label: { display: "block", fontWeight: 900 as const, marginBottom: 4 },
  input: {
    width: "100%",
    padding: 8,
    border: "1px solid rgba(128,128,128,0.6)",
    borderRadius: 10,
    background: "rgba(128,128,128,0.08)",
    color: "inherit",
  },

  btn: {
    padding: "10px 12px",
    border: "1px solid rgba(128,128,128,0.8)",
    borderRadius: 10,
    background: "rgba(128,128,128,0.12)",
    color: "inherit",
    fontWeight: 900 as const,
  },

  linkBtn: {
    padding: "8px 12px",
    border: "1px solid rgba(128,128,128,0.8)",
    borderRadius: 10,
    textDecoration: "none",
    color: "inherit",
    fontWeight: 800 as const,
    background: "rgba(128,128,128,0.12)",
  },

  card: { border, borderRadius: 12, padding: 12, background: "rgba(128,128,128,0.06)" },
};

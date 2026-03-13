import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { createExercise } from "./actions";
import ExerciseForm from "./ExerciseForm";

export const dynamic = "force-dynamic";

export default async function ExercisesPage() {
  const [exercises, metadataGroups] = await Promise.all([
    prisma.exercise.findMany({
      orderBy: [{ name: "asc" }],
      include: {
        metadataGroups: {
          include: {
            group: {
              select: { id: true, label: true, kind: true },
            },
          },
        },
      },
    }),
    prisma.metadataGroup.findMany({
      where: { appliesToExercise: true },
      select: { id: true, slug: true, label: true, kind: true },
      orderBy: [{ kind: "asc" }, { label: "asc" }],
    }),
  ]);

  return (
    <div style={styles.container}>
      <div style={styles.topRow}>
        <div>
          <h1 style={styles.h1}>Exercises</h1>
          <div style={styles.sub}>Library of movements with structured metadata for future progress rollups.</div>
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
          <ExerciseForm
            action={createExercise}
            metadataGroups={metadataGroups}
            submitLabel="Create Exercise"
          />
        </div>
      </div>

      <div style={{ marginTop: 16, display: "grid", gap: 10 }}>
        {exercises.map((exercise) => (
          <div key={exercise.id} style={styles.card}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "start" }}>
              <div style={{ fontWeight: 900 }}>{exercise.name}</div>
              <Link href={`/exercises/${exercise.id}`} style={styles.smallLink}>
                Edit
              </Link>
            </div>
            <div style={{ marginTop: 4, fontSize: 13, opacity: 0.8 }}>
              Unit: <b>{exercise.unit}</b> · Weight: <b>{exercise.supportsWeight ? "Yes" : "No"}</b>
            </div>
            {exercise.metadataGroups.length > 0 ? (
              <div style={{ marginTop: 8, display: "flex", gap: 6, flexWrap: "wrap" }}>
                {exercise.metadataGroups
                  .map((entry) => entry.group.label)
                  .sort((a, b) => a.localeCompare(b))
                  .map((label) => (
                    <span key={label} style={styles.badge}>
                      {label}
                    </span>
                  ))}
              </div>
            ) : (
              <div style={{ marginTop: 8, fontSize: 12, opacity: 0.7 }}>No structured metadata yet.</div>
            )}
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

  smallLink: {
    fontSize: 13,
    color: "inherit",
    opacity: 0.85,
    textDecoration: "none",
  },

  card: { border, borderRadius: 12, padding: 12, background: "rgba(128,128,128,0.06)" },
  badge: {
    border: "1px solid rgba(128,128,128,0.45)",
    borderRadius: 999,
    padding: "4px 8px",
    fontSize: 12,
    background: "rgba(128,128,128,0.12)",
  },
};

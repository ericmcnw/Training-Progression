import Link from "next/link";
import type { CSSProperties } from "react";
import { prisma } from "@/lib/prisma";
import { getRoutinePacks } from "@/lib/routine-packs-data";
import type { PackExercise } from "@/lib/routine-packs";
import { addPackRoutines } from "./pack-actions";

function prescriptionLabel(exercise: PackExercise) {
  if (exercise.seconds != null) return `${exercise.sets}×${exercise.seconds}s`;
  if (exercise.repsMin != null && exercise.repsMax != null && exercise.repsMin !== exercise.repsMax) {
    return `${exercise.sets}×${exercise.repsMin}–${exercise.repsMax}`;
  }
  const repCount = exercise.repsMax ?? exercise.repsMin;
  return repCount != null ? `${exercise.sets}×${repCount}` : `${exercise.sets} sets`;
}

export default async function RoutinePacksPageContent() {
  const [packs, mine] = await Promise.all([
    getRoutinePacks(),
    prisma.routine.findMany({ where: { isDeleted: false, isActive: true, isPlaceholder: false }, select: { name: true } }),
  ]);
  const myNames = new Set(mine.map((r) => r.name));

  return (
    <div className="mobilePageShell" style={container}>
      <div style={topRow}>
        <div>
          <h1 className="mobilePageTitle" style={{ fontSize: 26, fontWeight: 800, margin: 0 }}>Routine packs</h1>
          <div className="mobilePageSubtitle" style={sub}>
            Ready-made routines with exercises, sets and reps filled in. Add a whole pack or one routine, then edit anything.
          </div>
        </div>
        <Link href="/log" style={backLink}>Back</Link>
      </div>

      {packs.map((pack) => {
        const missing = pack.routines.filter((routine) => !myNames.has(routine.name));
        return (
          <section key={pack.key} style={packCard}>
            <div style={packHead}>
              <div style={{ minWidth: 0 }}>
                <h2 style={packTitle}>{pack.label}</h2>
                <p style={packCopy}>{pack.description}</p>
              </div>
              {missing.length > 1 ? (
                <form action={addPackRoutines}>
                  <input type="hidden" name="packKey" value={pack.key} />
                  <button type="submit" style={primaryBtn}>Add all {missing.length}</button>
                </form>
              ) : null}
            </div>

            <div style={{ display: "grid", gap: 8 }}>
              {pack.routines.map((routine) => (
                <div key={routine.key} style={routineRow}>
                  <div style={{ display: "grid", gap: 4, minWidth: 0 }}>
                    <div style={routineName}>{routine.name}</div>
                    {routine.description ? <div style={routineNote}>{routine.description}</div> : null}
                    <div style={exerciseLine}>
                      {routine.exercises.map((exercise) => `${exercise.name} ${prescriptionLabel(exercise)}`).join(" · ")}
                    </div>
                  </div>
                  {myNames.has(routine.name) ? (
                    <span style={addedTag}>Added</span>
                  ) : (
                    <form action={addPackRoutines}>
                      <input type="hidden" name="packKey" value={pack.key} />
                      <input type="hidden" name="routineKey" value={routine.key} />
                      <button type="submit" style={secondaryBtn}>Add</button>
                    </form>
                  )}
                </div>
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}

const container: CSSProperties = { maxWidth: 980, margin: "0 auto", padding: 4, display: "grid", gap: 18 };
const topRow: CSSProperties = { display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 };
const sub: CSSProperties = { marginTop: 6, opacity: 0.75, fontSize: 13, lineHeight: 1.45, maxWidth: 560 };
const backLink: CSSProperties = {
  minHeight: 44,
  display: "inline-flex",
  alignItems: "center",
  padding: "0 14px",
  border: "1px solid rgba(128,128,128,0.8)",
  borderRadius: 12,
  textDecoration: "none",
  color: "inherit",
  background: "rgba(128,128,128,0.12)",
  fontWeight: 700,
  flexShrink: 0,
};
const packCard: CSSProperties = {
  display: "grid",
  gap: 12,
  padding: 14,
  border: "1px solid rgba(128,128,128,0.35)",
  borderRadius: 16,
};
const packHead: CSSProperties = { display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, flexWrap: "wrap" };
const packTitle: CSSProperties = { margin: 0, fontSize: 17, fontWeight: 900 };
const packCopy: CSSProperties = { margin: "4px 0 0", fontSize: 13, lineHeight: 1.45, opacity: 0.72, maxWidth: 620 };
const routineRow: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 12,
  padding: "10px 12px",
  borderRadius: 10,
  border: "1px solid rgba(128,128,128,0.28)",
  background: "rgba(128,128,128,0.05)",
};
const routineName: CSSProperties = { fontSize: 14, fontWeight: 900 };
const routineNote: CSSProperties = { fontSize: 12, opacity: 0.72, lineHeight: 1.4 };
const exerciseLine: CSSProperties = { fontSize: 11.5, opacity: 0.6, lineHeight: 1.5 };
const secondaryBtn: CSSProperties = {
  minHeight: 44,
  minWidth: 64,
  padding: "0 14px",
  borderRadius: 10,
  border: "1px solid rgba(128,128,128,0.7)",
  background: "rgba(255,255,255,0.06)",
  color: "inherit",
  fontSize: 13,
  fontWeight: 800,
  cursor: "pointer",
};
const primaryBtn: CSSProperties = {
  ...secondaryBtn,
  border: "1px solid rgba(51,255,122,0.45)",
  background: "rgba(51,255,122,0.10)",
  color: "rgba(51,255,122,0.95)",
  fontWeight: 900,
};
const addedTag: CSSProperties = { fontSize: 12, fontWeight: 800, opacity: 0.55, flexShrink: 0, padding: "0 8px" };

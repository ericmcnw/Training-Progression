import Link from "next/link";
import type React from "react";
import { canonicalizeExerciseName, compareExerciseNames, exerciseMatchesQuery, exerciseUnitLabel } from "@/lib/exercises";
import { prisma } from "@/lib/prisma";
import { createExercise } from "./actions";
import ExerciseForm from "./ExerciseForm";

export const dynamic = "force-dynamic";

type SearchParams = Record<string, string | string[] | undefined>;

function getSearchParamValue(searchParams: SearchParams | undefined, key: string) {
  const raw = searchParams?.[key];
  if (Array.isArray(raw)) return raw[0] ?? "";
  return raw ?? "";
}

export default async function ExercisesPage({
  searchParams,
}: {
  searchParams?: SearchParams;
}) {
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

  const searchQuery = getSearchParamValue(searchParams, "q").trim();
  const unitFilter = getSearchParamValue(searchParams, "unit").trim();
  const filteredExercises = exercises.filter((exercise) => {
    if ((unitFilter === "REPS" || unitFilter === "TIME") && exercise.unit !== unitFilter) {
      return false;
    }
    return exerciseMatchesQuery(exercise.name, searchQuery);
  });

  const possibleDuplicateGroups = Array.from(
    exercises.reduce((map, exercise) => {
      const key = canonicalizeExerciseName(exercise.name);
      if (!key) return map;
      const existing = map.get(key) ?? [];
      existing.push(exercise);
      map.set(key, existing);
      return map;
    }, new Map<string, typeof exercises>())
  )
    .map(([, group]) => group.sort((left, right) => compareExerciseNames(left.name, right.name)))
    .filter((group) => group.length > 1);

  return (
    <div style={styles.container}>
      <div style={styles.topRow}>
        <div>
          <h1 style={styles.h1}>Exercises</h1>
          <div style={styles.sub}>Library of movements with cleaner search, cleaner unit labels, and metadata only when it helps.</div>
        </div>

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <Link href="/routines" style={styles.linkBtn}>
            Back to Routines
          </Link>
        </div>
      </div>

      <div style={styles.panel}>
        <div style={styles.panelHeader}>SEARCH LIBRARY</div>
        <form method="get" style={{ padding: 14, display: "grid", gap: 12 }}>
          <div style={styles.filterGrid}>
            <label style={{ display: "grid", gap: 6 }}>
              <span style={styles.label}>Search</span>
              <input
                type="search"
                name="q"
                defaultValue={searchQuery}
                placeholder="Pull, pull up, squat, plank..."
                style={styles.input}
              />
            </label>
            <label style={{ display: "grid", gap: 6 }}>
              <span style={styles.label}>Logging style</span>
              <select name="unit" defaultValue={unitFilter} style={styles.input}>
                <option value="">All exercises</option>
                <option value="REPS">Rep-based</option>
                <option value="TIME">Timed</option>
              </select>
            </label>
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button type="submit" style={styles.btn}>
              Search
            </button>
            {(searchQuery || unitFilter) ? (
              <Link href="/exercises" style={styles.linkBtn}>
                Clear
              </Link>
            ) : null}
          </div>
          <div style={styles.subtleText}>
            Search ignores punctuation and spacing, so <b>pull</b> also finds <b>Pull-Up</b> and <b>Pull Up</b>.
          </div>
        </form>
      </div>

      <div style={styles.panel}>
        <div style={styles.panelHeader}>NEW EXERCISE</div>

        <div style={{ padding: 14 }}>
          <ExerciseForm action={createExercise} metadataGroups={metadataGroups} submitLabel="Create Exercise" />
        </div>
      </div>

      <div style={{ marginTop: 16, display: "grid", gap: 10 }}>
        {possibleDuplicateGroups.length > 0 ? (
          <div style={styles.warningCard}>
            <div style={{ fontWeight: 900 }}>Possible duplicate names to review</div>
            <div style={styles.subtleText}>
              Older entries with different punctuation can still normalize to the same search key. New duplicates are now blocked.
            </div>
            <div style={{ display: "grid", gap: 6, marginTop: 10 }}>
              {possibleDuplicateGroups.map((group) => (
                <div key={group.map((exercise) => exercise.id).join(":")} style={{ fontSize: 13, opacity: 0.88 }}>
                  {group.map((exercise) => exercise.name).join(" / ")}
                </div>
              ))}
            </div>
          </div>
        ) : null}

        {filteredExercises.map((exercise) => (
          <div key={exercise.id} style={styles.card}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "start" }}>
              <div style={{ fontWeight: 900 }}>{exercise.name}</div>
              <Link href={`/exercises/${exercise.id}`} style={styles.smallLink}>
                Edit
              </Link>
            </div>
            <div style={{ marginTop: 4, fontSize: 13, opacity: 0.8 }}>
              Style: <b>{exerciseUnitLabel(exercise.unit)}</b> | Weight: <b>{exercise.supportsWeight ? "Yes" : "No"}</b>
            </div>
            {exercise.metadataGroups.length > 0 ? (
              <div style={{ marginTop: 8, display: "flex", gap: 6, flexWrap: "wrap" }}>
                {exercise.metadataGroups
                  .map((entry) => entry.group.label)
                  .sort((left, right) => left.localeCompare(right))
                  .map((label) => (
                    <span key={label} style={styles.badge}>
                      {label}
                    </span>
                  ))}
              </div>
            ) : (
              <div style={{ marginTop: 8, fontSize: 12, opacity: 0.7 }}>No groups assigned yet.</div>
            )}
          </div>
        ))}

        {filteredExercises.length === 0 ? (
          <div style={{ marginTop: 10, opacity: 0.75 }}>
            {searchQuery || unitFilter ? "No exercises match those filters." : "No exercises yet. Add your first one above."}
          </div>
        ) : null}
      </div>
    </div>
  );
}

const border = "1px solid rgba(128,128,128,0.35)";
const bgBar = "rgba(128,128,128,0.14)";

const styles: Record<string, React.CSSProperties> = {
  container: { maxWidth: 980, margin: "0 auto", padding: 20 },
  topRow: { display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12, flexWrap: "wrap" },
  h1: { fontSize: 26, fontWeight: 900 as const, margin: 0 },
  sub: { marginTop: 6, opacity: 0.75, fontSize: 13 },

  panel: { marginTop: 16, border, borderRadius: 12, overflow: "hidden" },
  panelHeader: { padding: "10px 14px", background: bgBar, borderBottom: border, fontWeight: 900 as const },
  filterGrid: { display: "grid", gap: 12, gridTemplateColumns: "minmax(220px, 1.4fr) minmax(180px, 0.8fr)" },

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
  warningCard: {
    border,
    borderRadius: 12,
    padding: 12,
    background: "rgba(245,158,11,0.12)",
  },
  badge: {
    border: "1px solid rgba(128,128,128,0.45)",
    borderRadius: 999,
    padding: "4px 8px",
    fontSize: 12,
    background: "rgba(128,128,128,0.12)",
  },
  subtleText: { fontSize: 12, opacity: 0.72 },
};

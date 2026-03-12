import Link from "next/link";
import MetadataGroupPicker from "@/app/components/MetadataGroupPicker";
import { prisma } from "@/lib/prisma";
import { updateExercise } from "../actions";

export const dynamic = "force-dynamic";

type Params = { id: string };

export default async function EditExercisePage(props: { params: Promise<Params> | Params }) {
  const params = await Promise.resolve(props.params);
  const id = params?.id;

  if (!id) return <div style={{ padding: 20 }}>Missing exercise id.</div>;

  const [exercise, metadataGroups] = await Promise.all([
    prisma.exercise.findUnique({
      where: { id },
      include: {
        metadataGroups: {
          select: { groupId: true },
        },
      },
    }),
    prisma.metadataGroup.findMany({
      where: { appliesToExercise: true },
      select: { id: true, slug: true, label: true, kind: true },
      orderBy: [{ kind: "asc" }, { label: "asc" }],
    }),
  ]);

  if (!exercise) return <div style={{ padding: 20 }}>Exercise not found.</div>;

  return (
    <div style={styles.container}>
      <div style={styles.topRow}>
        <div>
          <h1 style={styles.h1}>Edit Exercise</h1>
          <div style={styles.sub}>{exercise.name}</div>
        </div>

        <Link href="/exercises" style={styles.linkBtn}>
          Back
        </Link>
      </div>

      <div style={styles.panel}>
        <div style={styles.panelHeader}>DETAILS</div>

        <form action={updateExercise} style={{ padding: 14, display: "grid", gap: 12, maxWidth: 720 }}>
          <input type="hidden" name="id" value={exercise.id} />

          <div>
            <label style={styles.label}>Name</label>
            <input name="name" style={styles.input} defaultValue={exercise.name} />
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div>
              <label style={styles.label}>Unit</label>
              <select name="unit" style={styles.input as React.CSSProperties} defaultValue={exercise.unit}>
                <option value="REPS">REPS</option>
                <option value="TIME">TIME (seconds)</option>
              </select>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 22 }}>
              <input
                id="supportsWeight"
                name="supportsWeight"
                type="checkbox"
                defaultChecked={exercise.supportsWeight}
              />
              <label htmlFor="supportsWeight" style={{ fontWeight: 800 }}>
                Supports Weight (lbs)
              </label>
            </div>
          </div>

          <MetadataGroupPicker
            title="Exercise Metadata"
            help="Assign muscle groups, movement patterns, and broader training groups for future rollups."
            groups={metadataGroups}
            selectedIds={exercise.metadataGroups.map((entry) => entry.groupId)}
          />

          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button type="submit" style={styles.btn}>
              Save
            </button>
            <Link href="/exercises" style={styles.linkBtn}>
              Cancel
            </Link>
          </div>
        </form>
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
};

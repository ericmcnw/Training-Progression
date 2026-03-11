import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { deleteRoutine, toggleArchiveRoutine } from "../../actions";
import EditRoutineForm from "./EditRoutineForm";

export const dynamic = "force-dynamic";

type Params = { id: string };

export default async function EditRoutinePage(props: { params: Promise<Params> | Params }) {
  const params = await Promise.resolve(props.params);
  const id = params?.id;

  if (!id) return <div style={{ padding: 20 }}>Missing routine id.</div>;

  const routine = await prisma.routine.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      category: true,
      subtype: true,
      kind: true,
      timesPerWeek: true,
      isActive: true,
    },
  });
  if (!routine) return <div style={{ padding: 20 }}>Routine not found.</div>;

  const defaultCategories = ["General", "Daily", "Strength", "Running", "Climbing"];
  const categoryRows = await prisma.routine.findMany({
    select: { category: true },
    where: { isDeleted: false },
    distinct: ["category"],
    orderBy: { category: "asc" },
  });
  const categories = Array.from(
    new Set([
      ...defaultCategories,
      ...categoryRows.map((row) => row.category.trim()).filter((value) => value.length > 0),
      (routine.category || "").trim(),
    ])
  )
    .filter((value) => value.length > 0)
    .sort((a, b) => a.localeCompare(b));

  return (
    <div style={styles.container}>
      <div style={styles.topRow}>
        <div>
          <h1 style={styles.h1}>Edit Routine</h1>
          <div style={styles.sub}>
            {routine.name} · {routine.isActive ? "Active" : "Archived"}
          </div>
        </div>

        <Link href="/routines" style={styles.linkBtn}>
          Back
        </Link>
      </div>

      <div style={styles.panel}>
        <div style={styles.panelHeader}>DETAILS</div>
        <EditRoutineForm
          routine={{
            id: routine.id,
            name: routine.name,
            category: routine.category || "General",
            subtype: routine.subtype,
            kind: routine.kind,
            timesPerWeek: routine.timesPerWeek,
          }}
          categories={categories}
        />
      </div>

      <div style={{ marginTop: 14, display: "flex", gap: 10, flexWrap: "wrap" }}>
        <form
          action={async () => {
            "use server";
            await toggleArchiveRoutine(routine.id);
          }}
        >
          <button type="submit" style={styles.btn}>
            {routine.isActive ? "Archive" : "Unarchive"}
          </button>
        </form>

        <form
          action={async () => {
            "use server";
            await deleteRoutine(routine.id);
          }}
        >
          <button
            type="submit"
            style={{ ...styles.btn, borderColor: "rgba(255,0,0,0.55)" }}
          >
            Delete
          </button>
        </form>
      </div>

      <div style={styles.help}>
        Delete hides the routine but keeps logs for Progress.
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

  help: { marginTop: 10, opacity: 0.7, fontSize: 12 },
};

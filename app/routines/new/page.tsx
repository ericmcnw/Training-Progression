import Link from "next/link";
import NewRoutineForm from "./NewRoutineForm";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default function NewRoutinePage() {
  const defaultCategories = ["General", "Daily", "Strength", "Running", "Climbing"];
  const categoriesPromise = prisma.routine.findMany({
    select: { category: true },
    where: { isDeleted: false },
    distinct: ["category"],
    orderBy: { category: "asc" },
  });

  return (
    <NewRoutinePageInner categoriesPromise={categoriesPromise} defaultCategories={defaultCategories} />
  );
}

async function NewRoutinePageInner({
  categoriesPromise,
  defaultCategories,
}: {
  categoriesPromise: Promise<Array<{ category: string }>>;
  defaultCategories: string[];
}) {
  const categoryRows = await categoriesPromise;
  const categories = Array.from(
    new Set([
      ...defaultCategories,
      ...categoryRows.map((row) => row.category.trim()).filter((value) => value.length > 0),
    ])
  ).sort((a, b) => a.localeCompare(b));

  return (
    <div style={styles.container}>
      <div style={styles.topRow}>
        <div>
          <h1 style={styles.h1}>New Routine</h1>
          <div style={styles.sub}>Create a routine.</div>
        </div>

        <Link href="/routines" style={styles.linkBtn}>
          Back
        </Link>
      </div>

      <div style={styles.panel}>
        <div style={styles.panelHeader}>DETAILS</div>
        <NewRoutineForm categories={categories} />
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

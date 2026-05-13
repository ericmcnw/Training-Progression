import Link from "next/link";
import NewRoutineForm from "./new/NewRoutineForm";
import { prisma } from "@/lib/prisma";
import type { MetadataGroupKind } from "@/generated/prisma";
import { ROUTINE_METADATA_SELECTABLE_KINDS } from "@/lib/metadata";

export const dynamic = "force-dynamic";

export default function NewRoutinePage() {
  const metadataGroupsPromise = prisma.metadataGroup.findMany({
    where: {
      OR: [{ appliesToRoutine: true }, { kind: { in: ROUTINE_METADATA_SELECTABLE_KINDS } }],
    },
    select: { id: true, slug: true, label: true, kind: true },
    orderBy: [{ kind: "asc" }, { label: "asc" }],
  });
  const sessionTemplatesPromise = prisma.sessionTemplate.findMany({
    where: { isSystem: true },
    select: { id: true, key: true, name: true, description: true, sessionSubtype: true },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
  });
  const availableSubstituteRoutinesPromise = prisma.routine.findMany({
    where: { isActive: true, isDeleted: false },
    select: { id: true, name: true },
    orderBy: [{ name: "asc" }],
  });

  return (
    <NewRoutinePageInner
      metadataGroupsPromise={metadataGroupsPromise}
      sessionTemplatesPromise={sessionTemplatesPromise}
      availableSubstituteRoutinesPromise={availableSubstituteRoutinesPromise}
    />
  );
}

async function NewRoutinePageInner({
  metadataGroupsPromise,
  sessionTemplatesPromise,
  availableSubstituteRoutinesPromise,
}: {
  metadataGroupsPromise: Promise<Array<{ id: string; slug: string; label: string; kind: MetadataGroupKind }>>;
  sessionTemplatesPromise: Promise<Array<{ id: string; key: string; name: string; description: string | null; sessionSubtype: string | null }>>;
  availableSubstituteRoutinesPromise: Promise<Array<{ id: string; name: string }>>;
}) {
  const [metadataGroups, sessionTemplates, availableSubstituteRoutines] = await Promise.all([
    metadataGroupsPromise,
    sessionTemplatesPromise,
    availableSubstituteRoutinesPromise,
  ]);

  return (
    <div style={styles.container}>
      <div style={styles.topRow}>
        <div>
          <h1 style={styles.h1}>New Routine</h1>
          <div style={styles.sub}>Start with a preset, then open Advanced only if you need deeper control.</div>
          <div style={styles.altLinkRow}>
            <Link href="/routines?mode=starter" style={styles.altLink}>
              Want a faster start? Build a starter pack
            </Link>
          </div>
        </div>

        <Link href="/routines" style={styles.linkBtn}>
          Back
        </Link>
      </div>

      <div style={styles.panel}>
        <div style={styles.panelHeader}>QUICK SETUP</div>
        <NewRoutineForm
          metadataGroups={metadataGroups}
          sessionTemplates={sessionTemplates}
          availableSubstituteRoutines={availableSubstituteRoutines}
        />
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
  altLinkRow: { marginTop: 10 },
  altLink: {
    fontSize: 13,
    textDecoration: "none",
    color: "inherit",
    opacity: 0.84,
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

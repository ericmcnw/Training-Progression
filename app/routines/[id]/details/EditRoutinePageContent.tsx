import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { inferExerciseMetadataSlugs, ROUTINE_METADATA_SELECTABLE_KINDS } from "@/lib/metadata";
import { deleteRoutine, toggleArchiveRoutine } from "../../actions";
import EditRoutineForm from "../edit/EditRoutineForm";

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
      isActive: true,
      frequencyGoalEnabled: true,
      targetFrequencyCount: true,
      targetFrequencyUnit: true,
      targetFrequencyInterval: true,
      sessionDetails: {
        select: { templateId: true },
      },
      metadataGroups: {
        select: {
          groupId: true,
        },
      },
      exercises: {
        select: {
          exercise: {
            select: {
              name: true,
              metadataGroups: {
                select: {
                  groupId: true,
                },
              },
            },
          },
        },
      },
      tagAssignments: {
        select: {
          tag: {
            select: { name: true },
          },
        },
      },
    },
  });
  if (!routine) return <div style={{ padding: 20 }}>Routine not found.</div>;

  const derivedExerciseMetadataGroupIds = Array.from(
    new Set(
      routine.exercises.flatMap((entry) => entry.exercise.metadataGroups.map((groupEntry) => groupEntry.groupId))
    )
  );
  const inferredExerciseMetadataSlugs = Array.from(
    new Set(routine.exercises.flatMap((entry) => inferExerciseMetadataSlugs(entry.exercise.name)))
  );

  const metadataGroups = await prisma.metadataGroup.findMany({
    where: {
      OR: [
        { appliesToRoutine: true },
        { kind: { in: ROUTINE_METADATA_SELECTABLE_KINDS } },
        ...(inferredExerciseMetadataSlugs.length > 0 ? [{ slug: { in: inferredExerciseMetadataSlugs } }] : []),
      ],
    },
    select: { id: true, slug: true, label: true, kind: true },
    orderBy: [{ kind: "asc" }, { label: "asc" }],
  });
  const inferredExerciseMetadataGroupIds = metadataGroups
    .filter((group) => inferredExerciseMetadataSlugs.includes(group.slug))
    .map((group) => group.id);
  const sessionTemplates = await prisma.sessionTemplate.findMany({
    where: { isSystem: true },
    select: { id: true, name: true, description: true, sessionSubtype: true },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
  });

  return (
    <div className="mobileRoutineDetailPage mobilePageShell" style={styles.container}>
      <div className="mobilePageHeader" style={styles.topRow}>
        <div>
          <h1 className="mobilePageTitle" style={styles.h1}>Edit Routine</h1>
          <div className="mobilePageSubtitle" style={styles.sub}>
            {routine.name} | {routine.isActive ? "Active" : "Archived"}
          </div>
        </div>

        <Link href="/routines" style={styles.linkBtn}>
          Back
        </Link>
      </div>

      <div className="mobileSectionCard" style={styles.panel}>
        <div className="mobileSectionHeader" style={styles.panelHeader}>ROUTINE SETUP</div>
        <EditRoutineForm
          routine={{
            id: routine.id,
            name: routine.name,
            category: routine.category || "General",
            subtype: routine.subtype,
            kind: routine.kind,
            frequencyGoalEnabled: routine.frequencyGoalEnabled,
            targetFrequencyCount: routine.targetFrequencyCount,
            targetFrequencyUnit: routine.targetFrequencyUnit,
            targetFrequencyInterval: routine.targetFrequencyInterval,
            sessionTemplateId: routine.sessionDetails?.templateId ?? null,
            selectedMetadataGroupIds: Array.from(
              new Set([
                ...routine.metadataGroups.map((entry) => entry.groupId),
                ...derivedExerciseMetadataGroupIds,
                ...inferredExerciseMetadataGroupIds,
              ])
            ),
            tags: routine.tagAssignments.map((entry) => entry.tag.name),
          }}
          metadataGroups={metadataGroups}
          sessionTemplates={sessionTemplates}
        />
      </div>

      <div className="mobileActionRow" style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
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
  container: { maxWidth: 980, margin: "0 auto", padding: 4, display: "grid", gap: 18 },
  topRow: { display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12, flexWrap: "wrap" as const },
  h1: { fontSize: 26, fontWeight: 900 as const, margin: 0 },
  sub: { marginTop: 6, opacity: 0.75, fontSize: 13 },

  panel: { border, borderRadius: 16, overflow: "hidden" },
  panelHeader: { padding: "10px 14px", background: bgBar, borderBottom: border, fontWeight: 900 as const },

  btn: {
    minHeight: 44,
    padding: "10px 12px",
    border: "1px solid rgba(128,128,128,0.8)",
    borderRadius: 12,
    background: "rgba(128,128,128,0.12)",
    color: "inherit",
    fontWeight: 900 as const,
  },

  linkBtn: {
    minHeight: 44,
    padding: "10px 12px",
    border: "1px solid rgba(128,128,128,0.8)",
    borderRadius: 12,
    textDecoration: "none",
    color: "inherit",
    fontWeight: 800 as const,
    background: "rgba(128,128,128,0.12)",
  },

  help: { marginTop: 10, opacity: 0.7, fontSize: 12 },
};

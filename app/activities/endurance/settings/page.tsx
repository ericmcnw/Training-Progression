// Endurance settings — type management + legacy routine archive.
//
// Three sections, all reversible:
//   1. Activity types: enable/disable each leaf type (drops it from the
//      log picker without deleting data). Defaults to enabled.
//   2. Legacy retag: routines flagged "low confidence" by the migration
//      heuristic can be re-pointed at a different type.
//   3. Legacy routines: list of pre-unification endurance routines that
//      still exist as standalone routines. Per-row archive/restore
//      toggle. This is the T2-9 opt-in deprecation entry point — the
//      legacy routines never archive automatically, the user clicks
//      Archive when they're ready.

import { prisma } from "@/lib/prisma";
import { TargetHeader, SectionCard, SectionLinkButton, SectionBackButton, EmptyState } from "@/app/progress/ui";
import { SYNTHETIC_ENDURANCE_ROUTINE_ID } from "@/lib/activity-types";
import EnduranceSettingsClient, { type SettingsData } from "./EnduranceSettingsClient";

export const dynamic = "force-dynamic";

export default async function EnduranceSettingsPage() {
  const [families, legacyRoutines, prefs] = await Promise.all([
    prisma.enduranceFamily.findMany({
      orderBy: [{ sortOrder: "asc" }],
      include: {
        types: {
          orderBy: [{ sortOrder: "asc" }],
          select: {
            id: true,
            slug: true,
            name: true,
            _count: { select: { routineLogs: true, routines: true } },
          },
        },
      },
    }),
    // Endurance routines other than the synthetic placeholder. Both
    // active and archived appear so the user can toggle either way.
    prisma.routine.findMany({
      where: {
        kind: "CARDIO",
        isPlaceholder: false,
        NOT: { id: SYNTHETIC_ENDURANCE_ROUTINE_ID },
      },
      orderBy: [{ isDeleted: "asc" }, { name: "asc" }],
      select: {
        id: true,
        name: true,
        subtype: true,
        isDeleted: true,
        activityTypeId: true,
        activityType: { select: { name: true } },
        _count: { select: { logs: true } },
      },
    }),
    prisma.userActivityTypePreference.findMany({
      select: { activityTypeId: true, enabled: true },
    }),
  ]);

  const prefByTypeId = new Map(prefs.map((p) => [p.activityTypeId, p.enabled]));

  const data: SettingsData = {
    families: families.map((f) => ({
      id: f.id,
      slug: f.slug,
      name: f.name,
      types: f.types.map((t) => ({
        id: t.id,
        slug: t.slug,
        name: t.name,
        enabled: prefByTypeId.get(t.id) ?? true,
        logCount: t._count.routineLogs,
        routineCount: t._count.routines,
      })),
    })),
    legacyRoutines: legacyRoutines.map((r) => ({
      id: r.id,
      name: r.name,
      subtype: r.subtype,
      isDeleted: r.isDeleted,
      activityTypeId: r.activityTypeId,
      activityTypeName: r.activityType?.name ?? null,
      logCount: r._count.logs,
    })),
  };

  return (
    <>
      <TargetHeader
        section="sports"
        title="Endurance settings"
        eyebrow="Endurance"
        subtitle="Manage activity types and legacy routines. Every toggle here is reversible — no data is ever deleted."
        basePath="/activities/endurance/settings"
        tab="overview"
        range="all"
        hideTabs
        hideRange
        actions={
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", justifyContent: "flex-end" }}>
            <SectionBackButton fallbackHref="/activities/endurance" label="← Back" />
          </div>
        }
      />

      <div style={{ maxWidth: 1120, margin: "0 auto", padding: "0 14px 20px", display: "grid", gap: 16 }}>
        {data.families.length === 0 ? (
          <SectionCard title="Setup">
            <EmptyState message="Activity types haven't been seeded yet — run the latest migration." />
          </SectionCard>
        ) : (
          <EnduranceSettingsClient data={data} />
        )}
      </div>
    </>
  );
}

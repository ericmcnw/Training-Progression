import Link from "next/link";
import { getRoutineIndex, getRoutineLogs } from "@/app/progress/data";
import {
  ACTIVITY_FAMILY_META,
  ACTIVITY_FAMILY_ORDER,
  type ActivityFamily,
} from "@/lib/activity-families";
import {
  getFamilyStats,
  getTopActivitiesForFamily,
  getTopRoutinesForFamily,
  type LogForRanking,
  type RoutineForRanking,
} from "@/lib/activities/family-rankings";
import { formatHoursMinutes } from "@/lib/progress";
import FamilySection from "./_shared/FamilySection";
import Row from "./_shared/Row";
import SectionStrip from "./_shared/SectionStrip";

export const dynamic = "force-dynamic";

// The dashboard route for each family's hub page. Endurance + Strength
// already exist; Sports + Body Work ship as stub pages in this PR and
// flesh out in phase 2.
const FAMILY_DASHBOARD_HREF: Record<ActivityFamily, string> = {
  endurance: "/activities/endurance",
  sports: "/activities/sports",
  strength: "/activities/strength",
  "body-work": "/activities/body-work",
  mobility: "/activities/mobility",
  lifestyle: "/activities/lifestyle",
};

export default async function ActivitiesPage() {
  // Single roundtrip for the page — same data fed to every section helper.
  // No DB calls happen inside the ranking helpers themselves.
  const [routinesRaw, logs4wRaw] = await Promise.all([
    getRoutineIndex(),
    getRoutineLogs("4w"),
  ]);

  // Narrow to the shape the rankings need. The wider Prisma row keeps
  // its full structure for any downstream consumer; we just project the
  // fields we use here to keep helpers cheap.
  const routines: RoutineForRanking[] = routinesRaw.map((r) => ({
    id: r.id,
    name: r.name,
    subtype: r.subtype ?? null,
    domain: r.domain,
    kind: String(r.kind),
    isActive: r.isActive,
    metadataGroups: r.metadataGroups,
    // activityType isn't pulled by getRoutineIndex today; leave undefined
    // and the endurance classifier falls back to domain + metadata tags.
  }));

  const logs4w: LogForRanking[] = logs4wRaw.map((l) => ({
    id: l.id,
    routineId: l.routineId,
    performedAt: l.performedAt,
    distanceMi: l.distanceMi,
    durationSec: l.durationSec,
    // Forward activityType so the family-rankings helper can credit a
    // retyped log to its current type (e.g. Long Run → Trail Run) instead
    // of falling through to the routine's metadata. Required for typed
    // logs against the synthetic Endurance routine, which has no metadata.
    activityType: l.activityType
      ? { slug: l.activityType.slug, familyId: l.activityType.family?.slug ?? null }
      : null,
  }));

  return (
    <div style={pageStyle}>
      <header style={headerStyle}>
        <h1 style={titleStyle}>Activities</h1>
        <div style={{ display: "flex", gap: 8 }}>
          <Link href="/gear" style={mapLinkStyle}>
            🎒 Gear
          </Link>
          <Link href="/activities/map" style={mapLinkStyle}>
            🗺 Map
          </Link>
        </div>
      </header>

      <div style={{ display: "grid", gap: 10 }}>
        {ACTIVITY_FAMILY_ORDER.map((family) => {
          const meta = ACTIVITY_FAMILY_META[family];
          const stats = getFamilyStats(routines, logs4w, family);
          const topRoutines = getTopRoutinesForFamily(routines, logs4w, family, 6);

          // Endurance + Sports show "Top activities" stripe. Strength +
          // Body Work skip it — they don't have activity granularity.
          const topActivities =
            family === "endurance" || family === "sports"
              ? getTopActivitiesForFamily(routines, logs4w, family, 6)
              : [];

          return (
            <FamilySection
              key={family}
              label={meta.label}
              sessionsLabel={`${stats.sessions4w} session${stats.sessions4w === 1 ? "" : "s"}`}
              activeLabel={`${stats.activeRoutines} active`}
              accent={meta.accent}
              dashboardHref={FAMILY_DASHBOARD_HREF[family]}
            >
              {topActivities.length > 0 ? (
                <SectionStrip label="Top activities">
                  {topActivities.map((a) => (
                    <Row
                      key={a.entry.slug}
                      href={`/activities/${a.entry.slug}`}
                      label={a.entry.label}
                      metric={formatActivityMetric(a)}
                      accent={meta.accent}
                    />
                  ))}
                </SectionStrip>
              ) : null}

              {topRoutines.length > 0 ? (
                <SectionStrip label="Top routines">
                  {topRoutines.map((r) => (
                    <Row
                      key={r.id}
                      href={`/routines/${r.id}`}
                      label={r.name}
                      metric={`${r.sessions4w}× 4w`}
                      hint={r.lastSessionAt ? `Last ${formatShortDate(r.lastSessionAt)}` : undefined}
                      accent={meta.accent}
                    />
                  ))}
                </SectionStrip>
              ) : null}

              {topActivities.length === 0 && topRoutines.length === 0 ? (
                <EmptyState message={`No ${meta.label.toLowerCase()} activity in the last 4 weeks.`} />
              ) : null}

              <DashboardLink href={FAMILY_DASHBOARD_HREF[family]} accent={meta.accent}>
                More on {meta.label} Dashboard →
              </DashboardLink>
            </FamilySection>
          );
        })}
      </div>
    </div>
  );
}

// ─── Small inline UI bits used only here ─────────────────────────────────────

function EmptyState({ message }: { message: string }) {
  return (
    <div
      style={{
        padding: "12px 10px",
        borderRadius: 10,
        border: "1px dashed rgba(255,255,255,0.10)",
        background: "rgba(255,255,255,0.02)",
        fontSize: 12,
        opacity: 0.7,
        lineHeight: 1.5,
      }}
    >
      {message}
    </div>
  );
}

function DashboardLink({
  href,
  accent,
  children,
}: {
  href: string;
  accent: string;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      style={{
        display: "inline-flex",
        alignSelf: "flex-start",
        alignItems: "center",
        gap: 4,
        fontSize: 11,
        fontWeight: 800,
        textDecoration: "none",
        color: accent,
        padding: "6px 4px",
        opacity: 0.9,
      }}
    >
      {children}
    </Link>
  );
}

// ─── Formatters ──────────────────────────────────────────────────────────────

function formatActivityMetric(a: { sessions4w: number; totalDistanceMi: number; totalDurationSec: number }) {
  // Prefer distance for endurance activities; fall back to duration when
  // distance is zero (e.g., climbing/sport sessions log time only).
  if (a.totalDistanceMi > 0) {
    const v = a.totalDistanceMi >= 100 ? a.totalDistanceMi.toFixed(0) : a.totalDistanceMi.toFixed(1);
    return `${v} mi · ${a.sessions4w}×`;
  }
  if (a.totalDurationSec > 0) {
    return `${formatHoursMinutes(a.totalDurationSec)} · ${a.sessions4w}×`;
  }
  return `${a.sessions4w}×`;
}

function formatShortDate(date: Date): string {
  return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" }).format(date);
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const pageStyle: React.CSSProperties = {
  maxWidth: 720,
  margin: "0 auto",
  padding: "18px 14px 60px",
  display: "grid",
  gap: 16,
};

const headerStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "baseline",
  justifyContent: "space-between",
  gap: 12,
};

const titleStyle: React.CSSProperties = {
  margin: 0,
  fontSize: 26,
  fontWeight: 900,
  letterSpacing: -0.4,
};

const mapLinkStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
  fontSize: 12,
  fontWeight: 800,
  padding: "8px 14px",
  borderRadius: 999,
  border: "1px solid rgba(74,222,128,0.32)",
  background: "rgba(74,222,128,0.10)",
  color: "rgba(187,247,208,0.95)",
  textDecoration: "none",
};

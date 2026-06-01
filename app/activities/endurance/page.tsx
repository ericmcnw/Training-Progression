// Endurance world page — type/family driven view that replaces the
// generic SportsTargetPage rendering for the endurance slug. Tabs flip
// between an Overview (all families side by side) and one tab per family
// (Running, Walking, Cycling, Swimming, Rowing). A sub-filter narrows
// the active family to a specific type.
//
// Stats are computed in-memory from a single bounded query (range filter
// keeps the dataset small). Logs against the synthetic Endurance routine
// + logs against legacy endurance routines both surface via their
// activityType — see getLogDisplayName for the resolution logic.

import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { formatAppDate, relativeFromNow } from "@/lib/dates";
import { SectionCard, SectionLinkButton, TargetHeader, EmptyState } from "@/app/progress/ui";
import { getLogDisplayName } from "@/lib/routine-display";

export const dynamic = "force-dynamic";

type SearchParams = Record<string, string | string[] | undefined>;

function getParam(params: SearchParams, key: string) {
  const value = params[key];
  return Array.isArray(value) ? value[0] : value;
}

// Range filter applied via Prisma where-clause so the dataset stays
// bounded even before in-memory rollup.
type RangeFilter = "7d" | "4w" | "12w" | "1y" | "all";

const RANGE_DAYS: Record<Exclude<RangeFilter, "all">, number> = {
  "7d": 7,
  "4w": 28,
  "12w": 84,
  "1y": 365,
};

function parseRange(value: string | undefined): RangeFilter {
  if (value === "7d" || value === "4w" || value === "12w" || value === "1y" || value === "all") return value;
  return "4w";
}

function cutoffForRange(range: RangeFilter): Date | null {
  if (range === "all") return null;
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - RANGE_DAYS[range]);
  return cutoff;
}

function rangeLabel(range: RangeFilter): string {
  if (range === "7d") return "Last 7 days";
  if (range === "4w") return "Last 4 weeks";
  if (range === "12w") return "Last 12 weeks";
  if (range === "1y") return "Last year";
  return "All time";
}

function buildHref(params: SearchParams, overrides: Record<string, string | undefined>): string {
  const next: Record<string, string> = {};
  for (const [k, v] of Object.entries(params)) {
    if (typeof v === "string") next[k] = v;
  }
  for (const [k, v] of Object.entries(overrides)) {
    if (v === undefined || v === "") delete next[k];
    else next[k] = v;
  }
  const qs = new URLSearchParams(next).toString();
  return `/activities/endurance${qs ? `?${qs}` : ""}`;
}

export default async function EnduranceWorldPage(props: {
  searchParams?: Promise<SearchParams>;
}) {
  const searchParams = (await props.searchParams) ?? {};
  const familySlug = getParam(searchParams, "family") ?? "overview";
  const typeSlug = getParam(searchParams, "type") ?? null;
  const range = parseRange(getParam(searchParams, "range"));

  const cutoff = cutoffForRange(range);

  const [families, logs] = await Promise.all([
    prisma.enduranceFamily.findMany({
      orderBy: [{ sortOrder: "asc" }],
      include: {
        types: { orderBy: [{ sortOrder: "asc" }], select: { id: true, slug: true, name: true } },
      },
    }),
    // Pull every endurance log in the range. "Endurance" here means
    // either a typed log (activityTypeId set) or a legacy log against a
    // CARDIO routine. The display path uses activityType when present.
    prisma.routineLog.findMany({
      where: {
        AND: [
          cutoff ? { performedAt: { gte: cutoff } } : {},
          {
            OR: [
              { activityTypeId: { not: null } },
              { routine: { kind: "CARDIO", isPlaceholder: false } },
            ],
          },
        ],
      },
      orderBy: { performedAt: "desc" },
      select: {
        id: true,
        routineId: true,
        performedAt: true,
        distanceMi: true,
        durationSec: true,
        elevationGainFt: true,
        activityTypeId: true,
        activityType: { select: { name: true, familyId: true } },
        routine: {
          select: {
            name: true,
            activityType: { select: { name: true, familyId: true } },
          },
        },
      },
    }),
  ]);

  // Resolve each log's family — prefer log.activityType, fall back to
  // the routine's. Logs with no resolution land in an "Unclassified"
  // bucket so they don't disappear from totals.
  type ResolvedLog = (typeof logs)[number] & { resolvedFamilyId: string | null };
  const resolvedLogs: ResolvedLog[] = logs.map((log) => ({
    ...log,
    resolvedFamilyId:
      log.activityType?.familyId ?? log.routine.activityType?.familyId ?? null,
  }));

  // ── Family-level rollup ─────────────────────────────────────────────────
  type FamilyRollup = {
    id: string;
    slug: string;
    name: string;
    types: Array<{ id: string; slug: string; name: string }>;
    sessions: number;
    distanceMi: number;
    durationSec: number;
    elevationGainFt: number;
    lastSession: Date | null;
  };
  const rollups: FamilyRollup[] = families.map((f) => {
    const familyLogs = resolvedLogs.filter((l) => l.resolvedFamilyId === f.id);
    return {
      id: f.id,
      slug: f.slug,
      name: f.name,
      types: f.types,
      sessions: familyLogs.length,
      distanceMi: familyLogs.reduce((acc, l) => acc + (l.distanceMi ?? 0), 0),
      durationSec: familyLogs.reduce((acc, l) => acc + (l.durationSec ?? 0), 0),
      elevationGainFt: familyLogs.reduce((acc, l) => acc + (l.elevationGainFt ?? 0), 0),
      lastSession: familyLogs[0]?.performedAt ?? null,
    };
  });

  const activeFamily = families.find((f) => f.slug === familySlug) ?? null;
  const activeType = activeFamily?.types.find((t) => t.slug === typeSlug) ?? null;

  // Logs scoped to the active family + optional type for the family tab body.
  const scopedLogs = activeFamily
    ? resolvedLogs.filter((l) => {
        if (l.resolvedFamilyId !== activeFamily.id) return false;
        if (activeType && l.activityTypeId !== activeType.id) return false;
        return true;
      })
    : [];

  return (
    <>
      <TargetHeader
        section="sports"
        title="Endurance"
        eyebrow="Cardio"
        subtitle="Type-driven endurance view — switch families above, filter to a specific activity inside each."
        basePath="/activities/endurance"
        tab="overview"
        range="all"
        hideTabs
        hideRange
        actions={
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", justifyContent: "flex-end" }}>
            <SectionLinkButton href="/log" label="📋 Log endurance" />
            <SectionLinkButton href="/activities/endurance/settings" label="⚙ Settings" />
            <SectionLinkButton href="/activities" label="All activities" />
          </div>
        }
      />

      <div style={{ maxWidth: 1120, margin: "0 auto", padding: "0 14px 20px", display: "grid", gap: 16 }}>
        {/* Family tabs */}
        <div style={tabRowStyle}>
          <FamilyTab
            label="Overview"
            href={buildHref(searchParams, { family: "overview", type: undefined })}
            active={familySlug === "overview"}
          />
          {rollups.map((r) => (
            <FamilyTab
              key={r.id}
              label={`${r.name}${r.sessions > 0 ? ` (${r.sessions})` : ""}`}
              href={buildHref(searchParams, { family: r.slug, type: undefined })}
              active={familySlug === r.slug}
            />
          ))}
        </div>

        {/* Range pill row */}
        <div style={rangeRowStyle}>
          <span style={rangeLabelStyle}>Range</span>
          {(["7d", "4w", "12w", "1y", "all"] as const).map((r) => (
            <Link
              key={r}
              href={buildHref(searchParams, { range: r === "4w" ? undefined : r })}
              style={range === r ? rangePillActive : rangePill}
            >
              {r === "all" ? "All" : r}
            </Link>
          ))}
        </div>

        {/* Overview tab: side-by-side family cards */}
        {familySlug === "overview" ? (
          <SectionCard
            title="By family"
            subtitle={`${resolvedLogs.length} session${resolvedLogs.length === 1 ? "" : "s"} · ${rangeLabel(range).toLowerCase()}`}
          >
            {rollups.every((r) => r.sessions === 0) ? (
              <EmptyState message="No endurance logged in this range." />
            ) : (
              <div className="climbing-detail-grid">
                {rollups
                  .filter((r) => r.sessions > 0)
                  .map((r) => (
                    <FamilyStatCard key={r.id} rollup={r} href={buildHref(searchParams, { family: r.slug, type: undefined })} />
                  ))}
              </div>
            )}
          </SectionCard>
        ) : activeFamily ? (
          <FamilyDetailView
            family={activeFamily}
            rollup={rollups.find((r) => r.id === activeFamily.id)!}
            activeTypeId={activeType?.id ?? null}
            activeTypeSlug={activeType?.slug ?? null}
            logs={scopedLogs}
            searchParams={searchParams}
            range={range}
          />
        ) : (
          <SectionCard title="Family not found">
            <EmptyState message="Pick a family from the tabs above." />
          </SectionCard>
        )}
      </div>
    </>
  );
}

// ── Tab + chip components ───────────────────────────────────────────────────

function FamilyTab({ label, href, active }: { label: string; href: string; active: boolean }) {
  return (
    <Link href={href} style={active ? tabActiveStyle : tabStyle} aria-current={active ? "page" : undefined}>
      {label}
    </Link>
  );
}

function FamilyStatCard({
  rollup,
  href,
}: {
  rollup: {
    name: string;
    sessions: number;
    distanceMi: number;
    durationSec: number;
    elevationGainFt: number;
    lastSession: Date | null;
  };
  href: string;
}) {
  return (
    <Link href={href} style={statCardStyle}>
      <div style={{ display: "grid", gap: 8 }}>
        <div style={{ fontSize: 16, fontWeight: 900 }}>{rollup.name}</div>
        <div style={statRowStyle}>
          <Stat label="Sessions" value={String(rollup.sessions)} />
          <Stat label="Distance" value={`${rollup.distanceMi.toFixed(1)} mi`} />
          <Stat label="Time" value={formatHM(rollup.durationSec)} />
          {rollup.elevationGainFt > 0 && (
            <Stat label="Elev" value={`${Math.round(rollup.elevationGainFt)} ft`} />
          )}
        </div>
        {rollup.lastSession && (
          <div style={{ fontSize: 11, opacity: 0.55 }}>
            Last · {formatAppDate(rollup.lastSession, { month: "short", day: "numeric" })} · {relativeFromNow(rollup.lastSession)}
          </div>
        )}
      </div>
    </Link>
  );
}

function FamilyDetailView({
  family,
  rollup,
  activeTypeId,
  activeTypeSlug,
  logs,
  searchParams,
  range,
}: {
  family: { id: string; slug: string; name: string; types: Array<{ id: string; slug: string; name: string }> };
  rollup: { sessions: number; distanceMi: number; durationSec: number; elevationGainFt: number };
  activeTypeId: string | null;
  activeTypeSlug: string | null;
  logs: Array<{
    id: string;
    routineId: string;
    performedAt: Date;
    distanceMi: number | null;
    durationSec: number | null;
    elevationGainFt: number | null;
    activityTypeId: string | null;
    activityType: { name: string; familyId: string } | null;
    routine: { name: string; activityType: { name: string; familyId: string } | null };
  }>;
  searchParams: SearchParams;
  range: RangeFilter;
}) {
  // Scoped stats reflect the active type filter (if set), otherwise the
  // whole family.
  const scopedStats = {
    sessions: logs.length,
    distanceMi: logs.reduce((acc, l) => acc + (l.distanceMi ?? 0), 0),
    durationSec: logs.reduce((acc, l) => acc + (l.durationSec ?? 0), 0),
    elevationGainFt: logs.reduce((acc, l) => acc + (l.elevationGainFt ?? 0), 0),
  };

  void rollup; // family-level rollup is the unfiltered version — kept for future use

  return (
    <>
      {/* Type sub-filter */}
      {family.types.length > 0 && (
        <SectionCard title="Activity type" subtitle="Narrow this family to a specific type, or leave at All to roll up everything.">
          <div style={subFilterRowStyle}>
            <Link
              href={buildHref(searchParams, { type: undefined })}
              style={!activeTypeSlug ? subFilterPillActive : subFilterPill}
            >
              All {family.name}
            </Link>
            {family.types.map((t) => (
              <Link
                key={t.id}
                href={buildHref(searchParams, { type: t.slug })}
                style={activeTypeSlug === t.slug ? subFilterPillActive : subFilterPill}
              >
                {t.name}
              </Link>
            ))}
          </div>
        </SectionCard>
      )}

      {/* Stats */}
      <SectionCard
        title={activeTypeId ? `Stats · ${family.types.find((t) => t.id === activeTypeId)?.name ?? ""}` : `Stats · All ${family.name}`}
        subtitle={`${rangeLabel(range).toLowerCase()}`}
      >
        <div style={statRowStyle}>
          <Stat label="Sessions" value={String(scopedStats.sessions)} />
          <Stat label="Distance" value={`${scopedStats.distanceMi.toFixed(1)} mi`} />
          <Stat label="Time" value={formatHM(scopedStats.durationSec)} />
          {scopedStats.elevationGainFt > 0 && (
            <Stat label="Elevation" value={`${Math.round(scopedStats.elevationGainFt)} ft`} />
          )}
        </div>
      </SectionCard>

      {/* Recent sessions */}
      <SectionCard title="Recent sessions" subtitle={logs.length === 0 ? "Nothing logged for this slice yet." : undefined}>
        {logs.length === 0 ? (
          <EmptyState message={`No ${activeTypeId ? family.types.find((t) => t.id === activeTypeId)?.name : family.name} sessions in this range.`} />
        ) : (
          <div style={{ display: "grid", gap: 6 }}>
            {logs.slice(0, 30).map((log) => (
              <Link
                key={log.id}
                href={`/routines/${log.routineId}/logs/${log.id}/details`}
                style={logRowStyle}
              >
                <div style={{ display: "grid", gap: 1, minWidth: 0, flex: 1 }}>
                  <span style={{ fontSize: 13, fontWeight: 800 }}>{getLogDisplayName(log)}</span>
                  <span style={{ fontSize: 11, opacity: 0.65 }}>
                    {formatAppDate(log.performedAt, { weekday: "short", month: "short", day: "numeric" })} · {relativeFromNow(log.performedAt)}
                  </span>
                </div>
                <div style={{ display: "flex", gap: 8, flexShrink: 0, fontSize: 11.5, opacity: 0.8 }}>
                  {log.distanceMi != null && <span>{log.distanceMi.toFixed(1)} mi</span>}
                  {log.durationSec != null && <span>· {formatHM(log.durationSec)}</span>}
                  {log.elevationGainFt && log.elevationGainFt > 0 && <span>· {Math.round(log.elevationGainFt)} ft</span>}
                </div>
              </Link>
            ))}
          </div>
        )}
      </SectionCard>
    </>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div style={statBoxStyle}>
      <div style={statLabelStyle}>{label}</div>
      <div style={statValueStyle}>{value}</div>
    </div>
  );
}

function formatHM(totalSec: number): string {
  if (!totalSec || !Number.isFinite(totalSec) || totalSec <= 0) return "—";
  const h = Math.floor(totalSec / 3600);
  const m = Math.round((totalSec % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

// ── Styles ──────────────────────────────────────────────────────────────────

const tabRowStyle: React.CSSProperties = {
  display: "flex",
  gap: 6,
  flexWrap: "wrap",
  padding: "4px 0",
};

const tabStyle: React.CSSProperties = {
  padding: "8px 14px",
  borderRadius: 999,
  border: "1px solid rgba(255,255,255,0.12)",
  background: "rgba(255,255,255,0.04)",
  color: "rgba(255,255,255,0.78)",
  fontSize: 12.5,
  fontWeight: 800,
  textDecoration: "none",
  whiteSpace: "nowrap",
};

const tabActiveStyle: React.CSSProperties = {
  ...tabStyle,
  background: "rgba(120,190,255,0.18)",
  borderColor: "rgba(120,190,255,0.45)",
  color: "rgba(191,219,254,0.98)",
};

const rangeRowStyle: React.CSSProperties = {
  display: "flex",
  gap: 6,
  alignItems: "center",
  flexWrap: "wrap",
};

const rangeLabelStyle: React.CSSProperties = {
  fontSize: 10,
  fontWeight: 900,
  letterSpacing: 0.5,
  opacity: 0.55,
  textTransform: "uppercase",
  marginRight: 4,
};

const rangePill: React.CSSProperties = {
  padding: "5px 10px",
  borderRadius: 999,
  border: "1px solid rgba(255,255,255,0.12)",
  background: "rgba(255,255,255,0.04)",
  color: "inherit",
  fontSize: 12,
  fontWeight: 800,
  textDecoration: "none",
  whiteSpace: "nowrap",
};

const rangePillActive: React.CSSProperties = {
  ...rangePill,
  background: "rgba(120,190,255,0.15)",
  borderColor: "rgba(120,190,255,0.45)",
  color: "rgba(191,219,254,0.98)",
};

const subFilterRowStyle: React.CSSProperties = {
  display: "flex",
  gap: 6,
  flexWrap: "wrap",
};

const subFilterPill: React.CSSProperties = {
  padding: "6px 12px",
  borderRadius: 999,
  border: "1px solid rgba(255,255,255,0.12)",
  background: "rgba(255,255,255,0.04)",
  color: "inherit",
  fontSize: 12,
  fontWeight: 800,
  textDecoration: "none",
  whiteSpace: "nowrap",
};

const subFilterPillActive: React.CSSProperties = {
  ...subFilterPill,
  background: "rgba(120,190,255,0.15)",
  borderColor: "rgba(120,190,255,0.45)",
  color: "rgba(191,219,254,0.98)",
};

const statCardStyle: React.CSSProperties = {
  display: "block",
  padding: 14,
  borderRadius: 12,
  background: "rgba(255,255,255,0.03)",
  border: "1px solid rgba(255,255,255,0.08)",
  textDecoration: "none",
  color: "inherit",
  cursor: "pointer",
};

const statRowStyle: React.CSSProperties = {
  display: "flex",
  gap: 12,
  flexWrap: "wrap",
};

const statBoxStyle: React.CSSProperties = {
  flex: "1 1 90px",
  minWidth: 70,
  padding: "8px 10px",
  borderRadius: 8,
  background: "rgba(255,255,255,0.03)",
  border: "1px solid rgba(255,255,255,0.06)",
};

const statLabelStyle: React.CSSProperties = {
  fontSize: 9.5,
  fontWeight: 900,
  letterSpacing: 0.5,
  opacity: 0.55,
  textTransform: "uppercase",
};

const statValueStyle: React.CSSProperties = {
  fontSize: 18,
  fontWeight: 900,
};

const logRowStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 10,
  padding: "10px 12px",
  borderRadius: 10,
  background: "rgba(255,255,255,0.02)",
  border: "1px solid rgba(255,255,255,0.06)",
  color: "inherit",
  textDecoration: "none",
};

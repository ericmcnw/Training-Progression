import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { formatAppDate } from "@/lib/dates";
import { effectiveRoutineDomain } from "@/lib/routines";
import { SectionCard, EmptyState } from "@/app/progress/ui";
import { NewRoutineDrawerButton } from "@/app/components/FormDrawerButtons";

export const dynamic = "force-dynamic";

const ACCENT = "rgba(192,132,252,0.9)";
const ACCENT_BG = "rgba(192,132,252,0.08)";
const ACCENT_BORDER = "rgba(192,132,252,0.28)";
const ACCENT_TEXT = "rgba(216,180,254,0.95)";

export default async function MobilityWorldPage() {
  const routines = await prisma.routine.findMany({
    where: { isActive: true, isDeleted: false },
    select: { id: true, name: true, domain: true, kind: true, subtype: true },
  });

  const mobilityRoutines = routines.filter(
    (r) => effectiveRoutineDomain(r.domain, r.kind, r.subtype) === "mobility"
  );
  const mobilityRoutineIds = mobilityRoutines.map((r) => r.id);

  const now = new Date();
  const twelveWeeksAgo = new Date(now.getTime() - 84 * 24 * 60 * 60 * 1000);

  const logs = mobilityRoutineIds.length
    ? await prisma.routineLog.findMany({
        where: {
          routineId: { in: mobilityRoutineIds },
          performedAt: { gte: twelveWeeksAgo },
        },
        select: {
          id: true,
          routineId: true,
          performedAt: true,
          notes: true,
          routine: { select: { name: true } },
        },
        orderBy: { performedAt: "desc" },
      })
    : [];

  const thisWeekStart = startOfWeek(now);
  const lastWeekStart = new Date(thisWeekStart.getTime() - 7 * 24 * 60 * 60 * 1000);
  const fourWeeksAgo = new Date(now.getTime() - 28 * 24 * 60 * 60 * 1000);

  const sessionsThisWeek = logs.filter((l) => l.performedAt >= thisWeekStart).length;
  const sessionsLastWeek = logs.filter(
    (l) => l.performedAt >= lastWeekStart && l.performedAt < thisWeekStart
  ).length;
  const sessions4w = logs.filter((l) => l.performedAt >= fourWeeksAgo).length;
  const sessions12w = logs.length;

  // Last-session lookup for routine rows
  const lastSessionByRoutineId = new Map<string, Date>();
  for (const log of logs) {
    if (!lastSessionByRoutineId.has(log.routineId)) {
      lastSessionByRoutineId.set(log.routineId, log.performedAt);
    }
  }

  const recentSessions = logs.slice(0, 8);

  return (
    <div style={pageStyle}>
      <Link href="/activities" style={backLinkStyle}>
        ← Activities
      </Link>
      <header style={{ display: "grid", gap: 6 }}>
        <div style={eyebrowStyle}>Activity world</div>
        <h1 style={{ ...titleStyle, color: ACCENT }}>Mobility</h1>
        <p style={subtitleStyle}>Stretching, yoga, warmups, breathwork, rehab.</p>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 4 }}>
          <NewRoutineDrawerButton presetDomain="mobility" style={primaryCtaStyle}>
            + New mobility routine
          </NewRoutineDrawerButton>
        </div>
      </header>

      <div style={pulseRowStyle}>
        <PulseStat label="This week" value={sessionsThisWeek} sublabel="sessions" />
        <PulseStat label="Last week" value={sessionsLastWeek} sublabel="sessions" />
        <PulseStat label="4 weeks" value={sessions4w} sublabel="total" />
        <PulseStat label="12 weeks" value={sessions12w} sublabel="total" />
      </div>

      <SectionCard
        title="Mobility Routines"
        subtitle="Your active mobility, stretching, and rehab routines."
      >
        {mobilityRoutines.length === 0 ? (
          <EmptyState message="No active mobility routines yet. Create one from the Log page or below." />
        ) : (
          <div style={{ display: "grid", gap: 8 }}>
            {mobilityRoutines.map((r) => (
              <RoutineRow
                key={r.id}
                href={`/routines/${r.id}`}
                name={r.name}
                subtype={r.subtype ?? r.kind}
                lastDate={lastSessionByRoutineId.get(r.id) ?? null}
              />
            ))}
          </div>
        )}
      </SectionCard>

      {recentSessions.length > 0 ? (
        <SectionCard
          title="Recent Sessions"
          subtitle="Your last 8 mobility sessions."
        >
          <div style={{ display: "grid", gap: 8 }}>
            {recentSessions.map((s) => (
              <SessionRow
                key={s.id}
                href={`/routines/${s.routineId}/logs/${s.id}/details`}
                routineName={s.routine.name}
                date={s.performedAt}
              />
            ))}
          </div>
        </SectionCard>
      ) : null}

      <SectionCard
        title="Coming soon"
        subtitle="Deeper mobility analytics, planned for phase 2."
      >
        <ul style={comingSoonListStyle}>
          <li>Sessions per week — 12 week bar chart</li>
          <li>Body-zone mobility heatmap — which zones you stretch most</li>
          <li>Top stretches and poses by recent frequency</li>
          <li>Pose progression — flexibility milestones over time</li>
        </ul>
      </SectionCard>

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        <Link href="/log?domain=mobility" style={quickLinkStyle}>Mobility routines →</Link>
        <Link href="/activities/body-work" style={quickLinkStyle}>Body status →</Link>
        <Link href="/activities" style={quickLinkStyle}>Back to Activities</Link>
      </div>
    </div>
  );
}

function startOfWeek(d: Date) {
  const date = new Date(d);
  date.setHours(0, 0, 0, 0);
  const day = date.getDay();
  const diff = (day + 6) % 7; // Monday as start
  date.setDate(date.getDate() - diff);
  return date;
}

function PulseStat({ label, value, sublabel }: { label: string; value: number; sublabel: string }) {
  return (
    <div style={pulseStatStyle}>
      <div style={pulseLabelStyle}>{label}</div>
      <div style={{ ...pulseValueStyle, color: ACCENT_TEXT }}>{value}</div>
      <div style={pulseSubStyle}>{sublabel}</div>
    </div>
  );
}

function RoutineRow({
  href,
  name,
  subtype,
  lastDate,
}: {
  href: string;
  name: string;
  subtype: string;
  lastDate: Date | null;
}) {
  return (
    <Link href={href} style={routineRowStyle}>
      <div style={{ display: "grid", gap: 3, minWidth: 0 }}>
        <span style={{ fontSize: 14, fontWeight: 900, lineHeight: 1.2 }}>{name}</span>
        <span style={{ fontSize: 11, opacity: 0.6, fontWeight: 700 }}>
          {formatSubtypeLabel(subtype)}
        </span>
      </div>
      <span style={{ fontSize: 11, opacity: 0.55, fontWeight: 700, whiteSpace: "nowrap" }}>
        {lastDate ? `Last ${formatAppDate(lastDate, { month: "short", day: "numeric" })}` : "Not logged"}
      </span>
    </Link>
  );
}

function SessionRow({ href, routineName, date }: { href: string; routineName: string; date: Date }) {
  return (
    <Link href={href} style={sessionRowStyle}>
      <div style={{ display: "grid", gap: 2, minWidth: 0 }}>
        <span style={{ fontSize: 13, fontWeight: 900, lineHeight: 1.2 }}>{routineName}</span>
        <span style={{ fontSize: 11, opacity: 0.55, fontWeight: 700 }}>
          {formatAppDate(date, { weekday: "short", month: "short", day: "numeric" })}
        </span>
      </div>
    </Link>
  );
}

function formatSubtypeLabel(raw: string) {
  return raw
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

const pageStyle: React.CSSProperties = {
  maxWidth: 720,
  margin: "0 auto",
  padding: "18px 14px 60px",
  display: "grid",
  gap: 18,
};

const backLinkStyle: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 800,
  opacity: 0.65,
  textDecoration: "none",
  color: "inherit",
};

const eyebrowStyle: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 900,
  letterSpacing: 0.6,
  textTransform: "uppercase",
  opacity: 0.55,
};

const titleStyle: React.CSSProperties = {
  margin: 0,
  fontSize: 26,
  fontWeight: 900,
  letterSpacing: -0.4,
};

const subtitleStyle: React.CSSProperties = {
  margin: 0,
  fontSize: 13,
  opacity: 0.72,
  lineHeight: 1.5,
};

const pulseRowStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(4, 1fr)",
  gap: 8,
};

const pulseStatStyle: React.CSSProperties = {
  display: "grid",
  gap: 4,
  padding: "12px 10px",
  borderRadius: 12,
  border: `1px solid ${ACCENT_BORDER}`,
  background: `linear-gradient(180deg, ${ACCENT_BG}, rgba(255,255,255,0.02))`,
  textAlign: "center",
};

const pulseLabelStyle: React.CSSProperties = {
  fontSize: 10,
  fontWeight: 900,
  letterSpacing: 0.5,
  textTransform: "uppercase",
  opacity: 0.62,
};

const pulseValueStyle: React.CSSProperties = {
  fontSize: 22,
  fontWeight: 900,
  lineHeight: 1,
};

const pulseSubStyle: React.CSSProperties = {
  fontSize: 10,
  opacity: 0.55,
  fontWeight: 700,
};

const routineRowStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 12,
  padding: "12px 14px",
  borderRadius: 12,
  border: `1px solid ${ACCENT_BORDER}`,
  background: `linear-gradient(180deg, ${ACCENT_BG}, rgba(255,255,255,0.02))`,
  textDecoration: "none",
  color: "inherit",
  minHeight: 44,
};

const sessionRowStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 12,
  padding: "10px 14px",
  borderRadius: 12,
  border: "1px solid rgba(255,255,255,0.07)",
  background: "rgba(255,255,255,0.025)",
  textDecoration: "none",
  color: "inherit",
  minHeight: 44,
};

const comingSoonListStyle: React.CSSProperties = {
  margin: 0,
  padding: "0 0 0 18px",
  display: "grid",
  gap: 6,
  fontSize: 13,
  lineHeight: 1.55,
  opacity: 0.78,
};

const quickLinkStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  padding: "10px 14px",
  borderRadius: 10,
  border: "1px solid rgba(255,255,255,0.12)",
  background: "rgba(255,255,255,0.04)",
  fontSize: 12,
  fontWeight: 800,
  textDecoration: "none",
  color: "inherit",
  minHeight: 44,
};

const primaryCtaStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  padding: "10px 16px",
  borderRadius: 10,
  border: `1px solid ${ACCENT_BORDER}`,
  background: ACCENT_BG,
  color: ACCENT_TEXT,
  fontSize: 13,
  fontWeight: 900,
  cursor: "pointer",
  minHeight: 44,
};

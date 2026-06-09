import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { formatAppDate } from "@/lib/dates";
import { effectiveRoutineDomain } from "@/lib/routines";
import { SectionCard, EmptyState } from "@/app/progress/ui";
import { NewRoutineDrawerButton } from "@/app/components/FormDrawerButtons";

export const dynamic = "force-dynamic";

const ACCENT = "rgba(251,191,36,0.9)";
const ACCENT_BG = "rgba(251,191,36,0.08)";
const ACCENT_BORDER = "rgba(251,191,36,0.28)";
const ACCENT_TEXT = "rgba(253,224,71,0.95)";

export default async function LifestyleWorldPage() {
  const routines = await prisma.routine.findMany({
    where: { isActive: true, isDeleted: false },
    select: { id: true, name: true, domain: true, kind: true, subtype: true },
  });

  const lifestyleRoutines = routines.filter(
    (r) => effectiveRoutineDomain(r.domain, r.kind, r.subtype) === "lifestyle"
  );
  const lifestyleRoutineIds = lifestyleRoutines.map((r) => r.id);

  const now = new Date();
  const twelveWeeksAgo = new Date(now.getTime() - 84 * 24 * 60 * 60 * 1000);

  const logs = lifestyleRoutineIds.length
    ? await prisma.routineLog.findMany({
        where: {
          routineId: { in: lifestyleRoutineIds },
          performedAt: { gte: twelveWeeksAgo },
        },
        select: {
          id: true,
          routineId: true,
          performedAt: true,
          routine: { select: { name: true } },
        },
        orderBy: { performedAt: "desc" },
      })
    : [];

  const thisWeekStart = startOfWeek(now);
  const lastWeekStart = new Date(thisWeekStart.getTime() - 7 * 24 * 60 * 60 * 1000);
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const fourWeeksAgo = new Date(now.getTime() - 28 * 24 * 60 * 60 * 1000);

  const completionsThisWeek = logs.filter((l) => l.performedAt >= thisWeekStart).length;
  const completionsLastWeek = logs.filter(
    (l) => l.performedAt >= lastWeekStart && l.performedAt < thisWeekStart
  ).length;
  const completions4w = logs.filter((l) => l.performedAt >= fourWeeksAgo).length;
  const completions12w = logs.length;

  // Per-routine last-completed + last-7d count
  const lastByRoutineId = new Map<string, Date>();
  const last7dCount = new Map<string, number>();
  for (const log of logs) {
    if (!lastByRoutineId.has(log.routineId)) {
      lastByRoutineId.set(log.routineId, log.performedAt);
    }
    if (log.performedAt >= sevenDaysAgo) {
      last7dCount.set(log.routineId, (last7dCount.get(log.routineId) ?? 0) + 1);
    }
  }

  // Sort routines: most recently logged first, then by name
  const sortedRoutines = [...lifestyleRoutines].sort((a, b) => {
    const da = lastByRoutineId.get(a.id)?.getTime() ?? 0;
    const db = lastByRoutineId.get(b.id)?.getTime() ?? 0;
    if (da !== db) return db - da;
    return a.name.localeCompare(b.name);
  });

  const recentLogs = logs.slice(0, 10);

  return (
    <div style={pageStyle}>
      <Link href="/activities" style={backLinkStyle}>
        ← Activities
      </Link>
      <header style={{ display: "grid", gap: 6 }}>
        <div style={eyebrowStyle}>Activity world</div>
        <h1 style={{ ...titleStyle, color: ACCENT }}>Lifestyle</h1>
        <p style={subtitleStyle}>
          Daily habits, recovery, supplements, journaling — anything outside of training.
        </p>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 4 }}>
          <NewRoutineDrawerButton presetDomain="lifestyle" style={primaryCtaStyle}>
            + New lifestyle routine
          </NewRoutineDrawerButton>
        </div>
      </header>

      <div style={pulseRowStyle}>
        <PulseStat label="This week" value={completionsThisWeek} sublabel="completions" />
        <PulseStat label="Last week" value={completionsLastWeek} sublabel="completions" />
        <PulseStat label="4 weeks" value={completions4w} sublabel="total" />
        <PulseStat label="12 weeks" value={completions12w} sublabel="total" />
      </div>

      <SectionCard
        title="Your Habits"
        subtitle="Active lifestyle routines. Most recently logged first."
      >
        {sortedRoutines.length === 0 ? (
          <EmptyState message="No active lifestyle habits yet. Create one from the Log page or below." />
        ) : (
          <div style={{ display: "grid", gap: 8 }}>
            {sortedRoutines.map((r) => (
              <HabitRow
                key={r.id}
                href={`/routines/${r.id}`}
                name={r.name}
                subtype={r.subtype ?? r.kind}
                lastDate={lastByRoutineId.get(r.id) ?? null}
                weekCount={last7dCount.get(r.id) ?? 0}
              />
            ))}
          </div>
        )}
      </SectionCard>

      {recentLogs.length > 0 ? (
        <SectionCard
          title="Recent Completions"
          subtitle="Your last 10 lifestyle log entries."
        >
          <div style={{ display: "grid", gap: 8 }}>
            {recentLogs.map((s) => (
              <LogRow
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
        subtitle="Deeper habit analytics, planned for phase 2."
      >
        <ul style={comingSoonListStyle}>
          <li>Habit consistency heatmap — 12 weeks of daily hits and misses</li>
          <li>Per-habit streak overview — current and longest streaks side by side</li>
          <li>Frequency-goal progress bars — &quot;3 of 5 this week&quot; with at-risk markers</li>
          <li>Top habits by current streak</li>
          <li>Optional gentle reminders on home page for habits due today</li>
        </ul>
      </SectionCard>

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        <Link href="/log?domain=lifestyle" style={quickLinkStyle}>Lifestyle routines →</Link>
        <Link href="/goals" style={quickLinkStyle}>Frequency goals →</Link>
        <Link href="/activities" style={quickLinkStyle}>Back to Activities</Link>
      </div>
    </div>
  );
}

function startOfWeek(d: Date) {
  const date = new Date(d);
  date.setHours(0, 0, 0, 0);
  const day = date.getDay();
  const diff = (day + 6) % 7;
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

function HabitRow({
  href,
  name,
  subtype,
  lastDate,
  weekCount,
}: {
  href: string;
  name: string;
  subtype: string;
  lastDate: Date | null;
  weekCount: number;
}) {
  return (
    <Link href={href} style={habitRowStyle}>
      <div style={{ display: "grid", gap: 3, minWidth: 0 }}>
        <span style={{ fontSize: 14, fontWeight: 900, lineHeight: 1.2 }}>{name}</span>
        <span style={{ fontSize: 11, opacity: 0.6, fontWeight: 700 }}>
          {formatSubtypeLabel(subtype)}
          {lastDate ? ` · Last ${formatAppDate(lastDate, { month: "short", day: "numeric" })}` : " · Not logged"}
        </span>
      </div>
      <div style={weekBadgeStyle}>
        <span style={{ fontSize: 13, fontWeight: 900, lineHeight: 1, color: ACCENT_TEXT }}>
          {weekCount}
        </span>
        <span style={{ fontSize: 9, opacity: 0.6, fontWeight: 800, letterSpacing: 0.5 }}>7d</span>
      </div>
    </Link>
  );
}

function LogRow({ href, routineName, date }: { href: string; routineName: string; date: Date }) {
  return (
    <Link href={href} style={logRowStyle}>
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

const habitRowStyle: React.CSSProperties = {
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

const weekBadgeStyle: React.CSSProperties = {
  display: "grid",
  justifyItems: "center",
  gap: 1,
  padding: "6px 10px",
  borderRadius: 10,
  border: `1px solid ${ACCENT_BORDER}`,
  background: ACCENT_BG,
  minWidth: 44,
};

const logRowStyle: React.CSSProperties = {
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

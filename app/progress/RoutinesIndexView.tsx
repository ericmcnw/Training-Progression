import Link from "next/link";
import { getRoutineIndex, getRoutineLogs, routineSubtitle, summarizeRoutineLogs } from "./data";
import { EmptyState, FilterBar, FilterInput, FilterSelect, ProgressShell, SectionCard, SectionLinkButton, TargetCard } from "./ui";
import { getMaxRoutineFrequencyWindowDays, getRoutineFrequencyStatuses } from "@/lib/routine-frequency";
import { effectiveRoutineDomain, ROUTINE_DOMAIN_OPTIONS } from "@/lib/routines";
import { prisma } from "@/lib/prisma";

type SearchParams = Record<string, string | string[] | undefined>;

function getParam(params: SearchParams, key: string) {
  const value = params[key];
  return Array.isArray(value) ? value[0] : value;
}

export default async function RoutinesIndexView(props: {
  searchParams?: Promise<SearchParams> | SearchParams;
}) {
  const searchParams = await Promise.resolve(props.searchParams ?? {});
  const query = (getParam(searchParams, "q") ?? "").trim().toLowerCase();
  const kind = (getParam(searchParams, "kind") ?? "all").trim().toUpperCase();
  const status = (getParam(searchParams, "status") ?? "active").trim();
  const domainFilter = (getParam(searchParams, "domain") ?? "").trim().toLowerCase();
  const now = new Date();
  const [routines, logs] = await Promise.all([getRoutineIndex(), getRoutineLogs("4w")]);
  const maxFrequencyWindowDays = getMaxRoutineFrequencyWindowDays(routines);
  const frequencyWindowStart = new Date(now.getTime() - Math.max(1, maxFrequencyWindowDays) * 24 * 60 * 60 * 1000);
  const frequencyLogs =
    maxFrequencyWindowDays > 0
      ? await prisma.routineLog.findMany({
          where: { performedAt: { gte: frequencyWindowStart } },
          select: { routineId: true, performedAt: true },
        })
      : [];
  const frequencyStatusByRoutineId = getRoutineFrequencyStatuses({
    routines,
    logs: frequencyLogs,
    now,
  });

  const rows = routines
    .map((routine) => {
      const routineLogs = logs.filter((log) => log.routineId === routine.id);
      const summary = summarizeRoutineLogs(routineLogs, routine.timesPerWeek);
      const frequencySummary = frequencyStatusByRoutineId.get(routine.id);
      return { routine, summary, frequencySummary };
    })
    .filter(({ routine }) => {
      if (query && !routine.name.toLowerCase().includes(query) && !routine.category.toLowerCase().includes(query)) return false;
      if (kind !== "ALL" && routine.kind !== kind) return false;
      if (status === "active" && !routine.isActive) return false;
      if (status === "archived" && routine.isActive) return false;
      if (domainFilter && effectiveRoutineDomain(routine.domain, routine.kind, routine.subtype) !== domainFilter) return false;
      return true;
    })
    .sort((a, b) =>
      Number(b.routine.isActive) - Number(a.routine.isActive) ||
      b.summary.sessions - a.summary.sessions ||
      a.routine.name.localeCompare(b.routine.name)
    );

  return (
    <ProgressShell
      section="routines"
      title="Routine Progress"
      subtitle="Find a routine quickly, then switch between summary, completion, performance, and workload."
      actions={<SectionLinkButton href="/routines" label="Manage Routines" />}
    >
      <SectionCard title="Find a Routine">
        {domainFilter ? (
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10, flexWrap: "wrap" }}>
            <span style={{ fontSize: 12, fontWeight: 800, padding: "5px 10px", borderRadius: 999, background: "rgba(84,203,130,0.12)", border: "1px solid rgba(84,203,130,0.3)", color: "rgba(84,203,130,0.9)" }}>
              Focus area: {ROUTINE_DOMAIN_OPTIONS.find((o) => o.value === domainFilter)?.label ?? domainFilter}
            </span>
            <Link href="?tab=routines" style={{ fontSize: 12, opacity: 0.65 }}>
              Clear filter
            </Link>
          </div>
        ) : null}
        <FilterBar>
          <input type="hidden" name="section" value="routines" />
          {domainFilter ? <input type="hidden" name="domain" value={domainFilter} /> : null}
          <FilterInput name="q" defaultValue={query} placeholder="Search routine or category" />
          <FilterSelect
            name="kind"
            defaultValue={kind.toLowerCase()}
            options={[
              { value: "all", label: "All types" },
              { value: "completion", label: "Completion" },
              { value: "workout", label: "Workout" },
              { value: "cardio", label: "Cardio" },
              { value: "guided", label: "Guided" },
              { value: "session", label: "Session" },
            ]}
          />
          <FilterSelect
            name="status"
            defaultValue={status}
            options={[
              { value: "active", label: "Active only" },
              { value: "all", label: "Active + archived" },
              { value: "archived", label: "Archived only" },
            ]}
          />
          <button type="submit" style={{ padding: "8px 12px" }}>
            Apply
          </button>
        </FilterBar>
      </SectionCard>

      <SectionCard title="All Routines">
        {rows.length === 0 ? <EmptyState message="No routines match the current filters." /> : null}
        <div style={{ display: "grid", gap: 10, gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))" }}>
          {rows.map(({ routine, summary, frequencySummary }) => (
            <TargetCard
              key={routine.id}
              href={`/progress/routines/${routine.id}?tab=overview&range=4w`}
              title={routine.name}
              subtitle={routineSubtitle(routine)}
              chips={[
                `${summary.sessions} sessions`,
                `${summary.ytd} YTD`,
                frequencySummary?.summaryLabel ?? `${summary.weeksActive} active weeks`,
                frequencySummary?.hasTarget ? frequencySummary.detailLabel : `${summary.weeksActive} active weeks`,
                summary.lastSession ? `Last ${new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" }).format(summary.lastSession)}` : "No recent activity",
              ]}
            />
          ))}
        </div>
      </SectionCard>
    </ProgressShell>
  );
}

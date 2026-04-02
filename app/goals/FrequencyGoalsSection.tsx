import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getFrequencyGoalProgressList, getFrequencyGoalWindowDays } from "@/lib/frequency-goals";
import { deleteFrequencyGoal, updateFrequencyGoal } from "@/app/routines/actions";
import { SectionCard } from "@/app/progress/ui";
import { formInputStyle, subtleTextStyle } from "./ui";
import { normalizeRoutineKind } from "@/lib/routines";

export default async function FrequencyGoalsSection() {
  const now = new Date();
  const [goals, allRoutines] = await Promise.all([
    prisma.frequencyGoal.findMany({
      orderBy: { name: "asc" },
      include: {
        routines: {
          select: { routineId: true, routine: { select: { id: true, name: true, kind: true, isActive: true } } },
        },
      },
    }),
    prisma.routine.findMany({
      where: { isDeleted: false, isActive: true },
      orderBy: [{ kind: "asc" }, { name: "asc" }],
      select: { id: true, name: true, kind: true },
    }),
  ]);

  // Calculate progress for active goals
  const activeGoals = goals.filter((g) => g.isActive);
  const maxWindowDays = activeGoals.reduce((max, g) => Math.max(max, getFrequencyGoalWindowDays(g)), 0);

  const logs =
    maxWindowDays > 0
      ? await prisma.routineLog.findMany({
          where: { performedAt: { gte: new Date(now.getTime() - maxWindowDays * 24 * 60 * 60 * 1000) } },
          select: { routineId: true, performedAt: true },
        })
      : [];

  const goalShapes = activeGoals.map((g) => ({
    id: g.id,
    name: g.name,
    targetCount: g.targetCount,
    targetInterval: g.targetInterval,
    targetUnit: g.targetUnit,
    isActive: g.isActive,
    routineIds: g.routines.map((r) => r.routineId),
  }));

  const progressList = getFrequencyGoalProgressList({ goals: goalShapes, logs });

  const progressById = new Map(progressList.map((p) => [p.goal.id, p]));

  return (
    <SectionCard title="Group Frequency Goals">
      <div style={{ display: "grid", gap: 16 }}>
        <p style={subtleTextStyle}>
          Track frequency across multiple routines. Sessions from any included routine count toward the goal.
        </p>

        {goals.length === 0 ? (
          <div style={subtleTextStyle}>No group frequency goals yet.</div>
        ) : (
          <div style={{ display: "grid", gap: 12 }}>
            {goals.map((goal) => {
              const progress = progressById.get(goal.id);
              const memberIds = new Set(goal.routines.map((r) => r.routineId));
              return (
                <div key={goal.id} style={goalCardStyle}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8, flexWrap: "wrap" }}>
                    <div style={{ fontWeight: 800, fontSize: 15 }}>{goal.name}</div>
                    {progress ? (
                      <div
                        style={{
                          fontSize: 13,
                          fontWeight: 700,
                          color:
                            progress.status === "behind"
                              ? "rgba(248,113,113,0.9)"
                              : progress.status === "ahead"
                              ? "rgba(84,203,130,0.9)"
                              : "rgba(100,180,255,0.9)",
                        }}
                      >
                        {progress.summaryLabel}
                      </div>
                    ) : (
                      <div style={{ fontSize: 12, opacity: 0.6 }}>Inactive</div>
                    )}
                  </div>

                  {progress && (
                    <div style={{ fontSize: 12, opacity: 0.75 }}>{progress.detailLabel}</div>
                  )}

                  <div style={{ fontSize: 12, opacity: 0.65 }}>
                    {goal.routines.length} routine{goal.routines.length !== 1 ? "s" : ""} ·{" "}
                    {goal.targetCount}× per {goal.targetInterval} {goal.targetUnit.toLowerCase()}{goal.targetInterval !== 1 ? "s" : ""}
                  </div>

                  <details style={detailsBoxStyle}>
                    <summary data-collapsible-summary style={detailsSummaryStyle}>Edit</summary>
                    <form action={updateFrequencyGoal} style={{ marginTop: 10, display: "grid", gap: 10 }}>
                      <input type="hidden" name="id" value={goal.id} />

                      <div>
                        <label style={labelStyle}>Goal name</label>
                        <input name="name" defaultValue={goal.name} style={formInputStyle} required />
                      </div>

                      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                        <div style={{ flex: "0 0 auto" }}>
                          <label style={labelStyle}>Target</label>
                          <input name="targetCount" defaultValue={goal.targetCount} style={{ ...formInputStyle, width: 72 }} inputMode="numeric" />
                        </div>
                        <span style={{ alignSelf: "flex-end", paddingBottom: 6, fontSize: 12, opacity: 0.8 }}>times per</span>
                        <div style={{ flex: "0 0 auto" }}>
                          <label style={labelStyle}>Every</label>
                          <input name="targetInterval" defaultValue={goal.targetInterval} style={{ ...formInputStyle, width: 72 }} inputMode="numeric" />
                        </div>
                        <div style={{ flex: "0 0 auto" }}>
                          <label style={labelStyle}>Unit</label>
                          <select name="targetUnit" defaultValue={goal.targetUnit} style={{ ...formInputStyle, width: 110 }}>
                            <option value="DAY">day</option>
                            <option value="WEEK">week</option>
                            <option value="MONTH">month</option>
                          </select>
                        </div>
                      </div>

                      <div>
                        <label style={labelStyle}>Included routines</label>
                        <div style={routineChecklistStyle}>
                          {allRoutines.map((r) => (
                            <label key={r.id} style={checkboxRowStyle}>
                              <input
                                type="checkbox"
                                name="routineIds"
                                value={r.id}
                                defaultChecked={memberIds.has(r.id)}
                              />
                              <span style={{ fontSize: 13 }}>
                                {r.name}
                                <span style={{ fontSize: 11, opacity: 0.6, marginLeft: 6 }}>
                                  {normalizeRoutineKind(r.kind)}
                                </span>
                              </span>
                            </label>
                          ))}
                        </div>
                      </div>

                      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                        <button type="submit" suppressHydrationWarning style={btnStyle}>Save</button>
                        <button
                          formAction={deleteFrequencyGoal.bind(null, goal.id)}
                          type="submit"
                          suppressHydrationWarning
                          style={{ ...btnStyle, borderColor: "rgba(248,113,113,0.5)", color: "rgba(248,113,113,0.9)" }}
                        >
                          Delete
                        </button>
                      </div>
                    </form>
                  </details>
                </div>
              );
            })}
          </div>
        )}

        <div style={{ fontSize: 13, opacity: 0.7 }}>
          To add a new group frequency goal, use{" "}
          <Link href="/goals?mode=new&template=GROUP_ROUTINE_FREQUENCY" style={{ color: "inherit" }}>
            New Goal
          </Link>{" "}
          and select the &ldquo;Group routine frequency&rdquo; template.
        </div>
      </div>
    </SectionCard>
  );
}

const goalCardStyle: React.CSSProperties = {
  border: "1px solid rgba(128,128,128,0.3)",
  borderRadius: 12,
  padding: "12px 14px",
  background: "rgba(128,128,128,0.04)",
  display: "grid",
  gap: 6,
};

const detailsBoxStyle: React.CSSProperties = {
  border: "1px solid rgba(128,128,128,0.25)",
  borderRadius: 10,
  padding: "8px 10px",
  marginTop: 4,
};

const detailsSummaryStyle: React.CSSProperties = {
  cursor: "pointer",
  fontSize: 12,
  fontWeight: 800,
  opacity: 0.85,
};

const labelStyle: React.CSSProperties = {
  display: "block",
  fontSize: 11,
  fontWeight: 800,
  opacity: 0.75,
  marginBottom: 4,
  textTransform: "uppercase",
  letterSpacing: 0.4,
};

const routineChecklistStyle: React.CSSProperties = {
  display: "grid",
  gap: 6,
  padding: "8px 10px",
  border: "1px solid rgba(128,128,128,0.3)",
  borderRadius: 8,
  background: "rgba(128,128,128,0.04)",
  maxHeight: 240,
  overflowY: "auto",
};

const checkboxRowStyle: React.CSSProperties = {
  display: "flex",
  gap: 8,
  alignItems: "center",
  cursor: "pointer",
};

const btnStyle: React.CSSProperties = {
  minHeight: 38,
  padding: "7px 14px",
  border: "1px solid rgba(128,128,128,0.55)",
  borderRadius: 10,
  background: "rgba(128,128,128,0.1)",
  color: "inherit",
  fontWeight: 700,
  fontSize: 13,
  cursor: "pointer",
};

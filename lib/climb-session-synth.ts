// Shared synthesis helpers used by both the create and edit climbing session
// forms. Kept out of climb-types to avoid pulling session-templates into that
// module's dependency graph.

import type { ClimbAttemptDraft, ClimbOutcome, QuickClimbRow } from "@/lib/climb-types";
import type { SessionMetricDefinitionWithConfig } from "@/lib/session-templates";

// Per-climb attempts → grade-bucket count metrics, so the existing progress
// queries (which read sessionMetricValues) keep working without a schema
// change. One numberValue per (grade, FLASHED|DONE) column on the template.
export function synthesizeClimbingMetrics(
  attempts: ClimbAttemptDraft[],
  definitions: SessionMetricDefinitionWithConfig[]
): Array<{ metricDefinitionId: string; numberValue?: number }> {
  const gradeCounts = new Map<string, { flash: number; done: number }>();
  for (const attempt of attempts) {
    const current = gradeCounts.get(attempt.grade) ?? { flash: 0, done: 0 };
    if (attempt.outcome === "FLASH" || attempt.outcome === "ONSIGHT") current.flash++;
    else if (attempt.outcome === "SEND" || attempt.outcome === "REDPOINT") current.done++;
    gradeCounts.set(attempt.grade, current);
  }

  const result: Array<{ metricDefinitionId: string; numberValue?: number }> = [];
  for (const def of definitions) {
    const config = def.config;
    if (!config?.gradeBucket || !config?.climbingColumn) continue;
    const grade = config.gradeBucket as string;
    const column = config.climbingColumn as string;
    const counts = gradeCounts.get(grade);
    if (!counts) continue;
    const value = column === "FLASHED" ? counts.flash : counts.done;
    if (value > 0) result.push({ metricDefinitionId: def.id, numberValue: value });
  }
  return result;
}

// Quick-mode rows → individual ClimbAttemptDraft entries. The flash outcome
// flips to ONSIGHT for rope disciplines; send flips to REDPOINT for sport
// lead. Mirrors the producer in SessionLogForm so edits stay consistent
// with the create path. The localId is only used by the React list keys
// in the editor; the save action ignores it.
export function synthesizeAttemptsFromQuickRows(rows: QuickClimbRow[]): ClimbAttemptDraft[] {
  const attempts: ClimbAttemptDraft[] = [];
  let order = 0;
  for (const row of rows) {
    const flashOutcome: ClimbOutcome = row.discipline === "BOULDER" ? "FLASH" : "ONSIGHT";
    const sendOutcome: ClimbOutcome = row.discipline === "SPORT_LEAD" ? "REDPOINT" : "SEND";
    const flashCount = parseInt(row.flashCount || "0") || 0;
    const sendCount = parseInt(row.sendCount || "0") || 0;
    const projectCount = parseInt(row.projectCount || "0") || 0;

    for (let i = 0; i < flashCount; i++) {
      attempts.push({
        localId: `${row.localId}-flash-${i}`,
        discipline: row.discipline,
        grade: row.grade,
        gradeSystem: row.gradeSystem,
        outcome: flashOutcome,
        attemptOrder: order++,
      });
    }
    for (let i = 0; i < sendCount; i++) {
      attempts.push({
        localId: `${row.localId}-send-${i}`,
        discipline: row.discipline,
        grade: row.grade,
        gradeSystem: row.gradeSystem,
        outcome: sendOutcome,
        attemptOrder: order++,
      });
    }
    for (let i = 0; i < projectCount; i++) {
      attempts.push({
        localId: `${row.localId}-project-${i}`,
        discipline: row.discipline,
        grade: row.grade,
        gradeSystem: row.gradeSystem,
        outcome: "PROJECT",
        attemptOrder: order++,
      });
    }
  }
  return attempts;
}

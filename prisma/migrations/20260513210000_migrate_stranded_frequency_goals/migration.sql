-- Phase 4: collapse "frequency goals" into a single storage path.
--
-- Before this migration:
--   • A FREQUENCY goal could live in either the Goal table OR the
--     FrequencyGoal table depending on which UI created it.
--   • The /goals overview synthesizes a unified view by querying both,
--     deduping records pointing at the same routine.
--
-- After this migration: FrequencyGoal is the single source of truth for
-- "do this routine N times per period." The Goal table keeps PERFORMANCE,
-- VOLUME, and COMPLETION rows; per-routine FREQUENCY rows are migrated
-- across and the Goal counterparts deleted.
--
-- The stranded rows (Goal where goalType=FREQUENCY/targetType=ROUTINE/
-- metricType=SESSIONS) get:
--   1. A new FrequencyGoal row at id=fg_<routineId>, *unless* one already
--      exists (then we just delete the Goal row — fg_ wins).
--   2. A FrequencyGoalRoutine join row with role=PRIMARY.
--   3. The original Goal row deleted.

-- 1. Create fg_<routineId> FrequencyGoal records for stranded rows that
--    don't already have one. Map Goal.timeframe → FrequencyGoal.targetUnit
--    (DAY/WEEK/MONTH all line up; ONE_TIME wouldn't have FREQUENCY anyway
--    so we exclude it defensively).
INSERT INTO "FrequencyGoal" (id, name, "targetCount", "targetInterval", "targetUnit", "weekdayMask", "isActive", "createdAt", "updatedAt")
SELECT
  CONCAT('fg_', g."targetId") AS id,
  g.name,
  GREATEST(1, CAST(g."targetValue" AS INTEGER)) AS "targetCount",
  1 AS "targetInterval",
  CASE
    WHEN g.timeframe = 'DAY'   THEN 'DAY'::"RoutineFrequencyUnit"
    WHEN g.timeframe = 'MONTH' THEN 'MONTH'::"RoutineFrequencyUnit"
    ELSE 'WEEK'::"RoutineFrequencyUnit"
  END AS "targetUnit",
  NULL AS "weekdayMask",
  g."isActive",
  g."createdAt",
  g."updatedAt"
FROM "Goal" g
WHERE g."goalType"   = 'FREQUENCY'
  AND g."targetType" = 'ROUTINE'
  AND g."metricType" = 'SESSIONS'
  AND g.timeframe IN ('DAY', 'WEEK', 'MONTH')
  AND NOT EXISTS (
    SELECT 1 FROM "FrequencyGoal" fg WHERE fg.id = CONCAT('fg_', g."targetId")
  );

-- 2. Ensure the PRIMARY join row exists for every (now-migrated or
--    pre-existing) fg_ goal. ON CONFLICT keeps existing role.
INSERT INTO "FrequencyGoalRoutine" ("goalId", "routineId", "addedAt", "role")
SELECT
  CONCAT('fg_', g."targetId"),
  g."targetId",
  NOW(),
  'PRIMARY'::"FrequencyGoalRole"
FROM "Goal" g
WHERE g."goalType"   = 'FREQUENCY'
  AND g."targetType" = 'ROUTINE'
  AND g."metricType" = 'SESSIONS'
  AND g.timeframe IN ('DAY', 'WEEK', 'MONTH')
ON CONFLICT ("goalId", "routineId") DO NOTHING;

-- 3. Drop the now-redundant Goal rows.
DELETE FROM "Goal"
WHERE "goalType"   = 'FREQUENCY'
  AND "targetType" = 'ROUTINE'
  AND "metricType" = 'SESSIONS';

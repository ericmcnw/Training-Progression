-- ============================================================================
-- Phase 1: Data Model Cleanup
-- ============================================================================
-- Foundation for the activity-world restructure. Internal cleanup with no
-- intended user-visible behavior change.
--
-- Step order matters: data backfills MUST run before column drops, since the
-- backfills read from the columns that get dropped at the end.
--
--   1. Backfill CARDIO_ACTIVITY metadata for routines, derived from subtype.
--      Cardio subtypes (RUN, BIKE, etc.) and SESSION sport subtypes (SURFING,
--      SNOWBOARDING, etc.) become first-class metadata tags so the upcoming
--      activity-world UI can filter by tag instead of by enum.
--
--   2. Backfill FrequencyGoal records from legacy per-routine target columns.
--      The legacy target system (Routine.targetFrequencyCount/Unit/Interval)
--      had no UI; FrequencyGoal is the single canonical path. We preserve the
--      target data by creating one single-routine FrequencyGoal per affected
--      routine, with a deterministic id of 'fg_<routineId>' so the join row
--      can be linked without a temp table.
--
--   3. Re-derive routines currently in the "habit" domain to "recovery".
--      The "habit" domain is being dropped — habit tracking moves to the
--      FrequencyGoal lens (Phase 4). Recovery is the semantically nearest
--      remaining domain for HABIT/HEALTH/OTHER COMPLETION subtypes.
--
--   4. Drop legacy columns and indexes:
--        Routine.targetFrequencyCount, targetFrequencyUnit,
--        targetFrequencyInterval, frequencyGoalEnabled, category
--      and the indexes on (targetFrequencyUnit, targetFrequencyInterval) and
--      (category).
-- ============================================================================


-- ============================================================
-- Step 1: Backfill metadata from subtype
-- ============================================================
-- Mirror of ROUTINE_SUBTYPE_GROUP_DEFAULTS in lib/metadata.ts. Subtypes that
-- already had their tags assigned at creation time are skipped via NOT EXISTS.

WITH subtype_metadata(subtype, slug) AS (
  -- Cardio subtypes
  VALUES
    ('RUN', 'running'), ('RUN', 'run-walk'),
    ('EASY_RUN', 'easy-run'), ('EASY_RUN', 'running'), ('EASY_RUN', 'run-walk'),
    ('TEMPO_RUN', 'tempo-run'), ('TEMPO_RUN', 'running'), ('TEMPO_RUN', 'run-walk'), ('TEMPO_RUN', 'endurance'),
    ('LONG_RUN', 'long-run'), ('LONG_RUN', 'running'), ('LONG_RUN', 'run-walk'), ('LONG_RUN', 'endurance'),
    ('WALK', 'walking'), ('WALK', 'run-walk'),
    ('EASY_WALK', 'easy-walk'), ('EASY_WALK', 'walking'), ('EASY_WALK', 'run-walk'),
    ('BIKE', 'biking'),
    ('SWIM', 'swimming'),
    ('HIKE', 'hiking'), ('HIKE', 'outdoor'),
    ('ROW', 'rowing'),
    -- Session subtypes (sports)
    ('CLIMBING', 'climbing'), ('CLIMBING', 'skill-practice'), ('CLIMBING', 'strength'),
    ('SURFING', 'surfing'), ('SURFING', 'board-sports'), ('SURFING', 'cardio'), ('SURFING', 'core'), ('SURFING', 'grip'), ('SURFING', 'outdoor'),
    ('SNOWBOARDING', 'snowboarding'), ('SNOWBOARDING', 'board-sports'), ('SNOWBOARDING', 'cardio'), ('SNOWBOARDING', 'core'), ('SNOWBOARDING', 'outdoor'),
    ('BASKETBALL', 'basketball'), ('BASKETBALL', 'cardio'), ('BASKETBALL', 'core'), ('BASKETBALL', 'skill-practice'),
    ('TENNIS', 'tennis'), ('TENNIS', 'cardio'), ('TENNIS', 'core'), ('TENNIS', 'skill-practice'),
    ('GOLF', 'golf'), ('GOLF', 'outdoor'), ('GOLF', 'core'), ('GOLF', 'skill-practice'),
    ('YOGA_SESSION', 'mobility'),
    ('HIKE_DAY', 'hiking'), ('HIKE_DAY', 'cardio'), ('HIKE_DAY', 'outdoor')
)
INSERT INTO "RoutineMetadataGroup" ("routineId", "groupId", "assignedAt")
SELECT DISTINCT r.id, mg.id, NOW()
FROM "Routine" r
JOIN subtype_metadata sm ON sm.subtype = r.subtype
JOIN "MetadataGroup" mg ON mg.slug = sm.slug
WHERE r.subtype IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM "RoutineMetadataGroup" rmg
    WHERE rmg."routineId" = r.id AND rmg."groupId" = mg.id
  );


-- ============================================================
-- Step 2: Backfill FrequencyGoal records from legacy fields
-- ============================================================
-- Use a deterministic goal id ('fg_' || routineId) so the join row can find
-- it by stripping the prefix. Only for routines with valid + enabled targets
-- and no existing FrequencyGoal link.

WITH new_goals AS (
  INSERT INTO "FrequencyGoal" ("id", "name", "targetCount", "targetInterval", "targetUnit", "isActive", "createdAt", "updatedAt")
  SELECT
    'fg_' || r."id",
    r."name" || ' frequency goal',
    r."targetFrequencyCount",
    r."targetFrequencyInterval",
    r."targetFrequencyUnit",
    true,
    NOW(),
    NOW()
  FROM "Routine" r
  WHERE r."targetFrequencyCount" IS NOT NULL
    AND r."targetFrequencyCount" > 0
    AND r."targetFrequencyUnit" IS NOT NULL
    AND r."targetFrequencyInterval" IS NOT NULL
    AND r."targetFrequencyInterval" > 0
    AND r."frequencyGoalEnabled" = true
    AND NOT EXISTS (
      SELECT 1 FROM "FrequencyGoalRoutine" fgr WHERE fgr."routineId" = r.id
    )
  RETURNING "id"
)
INSERT INTO "FrequencyGoalRoutine" ("goalId", "routineId", "addedAt")
SELECT ng."id", SUBSTRING(ng."id" FROM 4), NOW()
FROM new_goals ng;


-- ============================================================
-- Step 3: Re-derive habit-domain routines to recovery
-- ============================================================
UPDATE "Routine" SET "domain" = 'recovery' WHERE "domain" = 'habit';


-- ============================================================
-- Step 4: Drop legacy columns and indexes
-- ============================================================
DROP INDEX IF EXISTS "Routine_targetFrequencyUnit_targetFrequencyInterval_idx";
DROP INDEX IF EXISTS "Routine_category_idx";

ALTER TABLE "Routine"
  DROP COLUMN IF EXISTS "targetFrequencyCount",
  DROP COLUMN IF EXISTS "targetFrequencyUnit",
  DROP COLUMN IF EXISTS "targetFrequencyInterval",
  DROP COLUMN IF EXISTS "frequencyGoalEnabled",
  DROP COLUMN IF EXISTS "category";

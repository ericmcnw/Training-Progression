-- Structured interval support for endurance types where uniform reps
-- matter (Interval Run, Sprint, future hill repeats etc.). Adds:
--   - ActivityType.usesIntervals flag — UI gates the interval block on it
--   - RoutineLog.intervalsConfig JSON — stores the reps/work/rest payload
-- Plus seeds a new Sprint activity type under the Running family.
--
-- Sprint sits under Running because it's still a running movement at the
-- biomechanical level. If/when the planned domain restructure lands
-- (Aerobic Capacity / Anaerobic / etc., see project_domain_restructure.md),
-- Sprint can move to whatever family makes sense for power-focused work.

-- AlterTable
ALTER TABLE "ActivityType" ADD COLUMN "usesIntervals" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "RoutineLog" ADD COLUMN "intervalsConfig" JSONB;

-- Flip the existing Interval Run type to use the structured form.
UPDATE "ActivityType" SET "usesIntervals" = true WHERE "slug" = 'interval-run';

-- Seed Sprint as a new Running-family type, also using intervals. Lower
-- sortOrder than Interval Run is intentional — sprints feel more
-- foundational than tempo/interval workouts when shown in the dropdown.
INSERT INTO "ActivityType" (
  "id", "slug", "name", "familyId", "sortOrder",
  "hasDistance", "hasElevation", "hasPace", "usesIntervals",
  "updatedAt"
) VALUES (
  'actype_sprint', 'sprint', 'Sprint', 'endfam_running', 60,
  true, false, true, true,
  CURRENT_TIMESTAMP
) ON CONFLICT ("slug") DO UPDATE SET "usesIntervals" = EXCLUDED."usesIntervals";

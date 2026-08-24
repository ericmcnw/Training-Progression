-- Backfill only the campaign metadata introduced in the prior migration.
-- Existing Focus rows, milestones, goals, routines, and all training history
-- remain otherwise unchanged.

UPDATE "Focus"
SET "objectiveKind" = CASE
  WHEN "linkedInjuryId" IS NOT NULL THEN 'RECOVERY'::"ProgramObjectiveKind"
  WHEN "pursuitKey" = 'endurance' THEN 'ENDURANCE'::"ProgramObjectiveKind"
  WHEN "pursuitKey" IS NOT NULL THEN 'SPORT'::"ProgramObjectiveKind"
  ELSE "objectiveKind"
END
WHERE "objectiveKind" = 'GENERAL'::"ProgramObjectiveKind";

UPDATE "Focus"
SET "timelineMode" = CASE
  WHEN "linkedInjuryId" IS NOT NULL AND "targetDate" IS NOT NULL THEN 'TARGET_DATE'::"ProgramTimelineMode"
  WHEN "targetKind" = 'HARD' AND "targetDate" IS NOT NULL THEN 'TARGET_DATE'::"ProgramTimelineMode"
  WHEN "pursuitKey" IS NOT NULL AND "pursuitKey" <> 'endurance' AND "targetDate" IS NOT NULL THEN 'SEASON'::"ProgramTimelineMode"
  ELSE 'REVIEW_DATE'::"ProgramTimelineMode"
END
WHERE "startYmd" IS NULL AND "endYmd" IS NULL AND "reviewYmd" IS NULL;

UPDATE "Focus"
SET
  "startYmd" = to_char("createdAt" AT TIME ZONE 'America/New_York', 'YYYY-MM-DD'),
  "endYmd" = CASE
    WHEN "timelineMode" IN ('SEASON'::"ProgramTimelineMode", 'DURATION'::"ProgramTimelineMode", 'TARGET_DATE'::"ProgramTimelineMode")
      AND "targetDate" IS NOT NULL
    THEN to_char("targetDate" AT TIME ZONE 'UTC', 'YYYY-MM-DD')
    ELSE "endYmd"
  END,
  "reviewYmd" = CASE
    WHEN "timelineMode" = 'REVIEW_DATE'::"ProgramTimelineMode" AND "targetDate" IS NOT NULL
    THEN to_char("targetDate" AT TIME ZONE 'UTC', 'YYYY-MM-DD')
    ELSE "reviewYmd"
  END
WHERE "startYmd" IS NULL;

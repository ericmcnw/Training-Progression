-- Per-climb discipline support. Today every ClimbAttempt's discipline is
-- implied by its session's template key (indoor-bouldering, outdoor-sport-
-- climbing, etc.). Storing it per attempt lets a single gym/crag session
-- mix bouldering and rope work without forcing the user into two sessions.
--
-- The column defaults to BOULDER on the schema side so new rows always have
-- a value; the backfill below replaces those defaults for historical rows
-- using each attempt's session template. Anything that can't be derived
-- stays BOULDER as a safe fallback (bouldering is the most common case in
-- practice and easy to spot-correct from the UI if wrong).

-- CreateEnum
CREATE TYPE "ClimbingDiscipline" AS ENUM ('BOULDER', 'TOP_ROPE', 'SPORT_LEAD');

-- AlterTable
ALTER TABLE "ClimbAttempt" ADD COLUMN "discipline" "ClimbingDiscipline" NOT NULL DEFAULT 'BOULDER';

-- Backfill from each attempt's session template key. Walk the chain
-- ClimbAttempt → RoutineLog → Routine → SessionRoutineDetails →
-- SessionTemplate.key, then map the key to the right discipline. Single
-- UPDATE statement runs in milliseconds at our scale.
UPDATE "ClimbAttempt" AS ca
SET "discipline" = (
  CASE
    WHEN st.key IN ('indoor-bouldering', 'outdoor-bouldering') THEN 'BOULDER'::"ClimbingDiscipline"
    WHEN st.key IN ('indoor-top-rope', 'indoor-rope-climbing', 'outdoor-top-rope') THEN 'TOP_ROPE'::"ClimbingDiscipline"
    WHEN st.key IN ('indoor-sport-climbing', 'outdoor-sport-climbing', 'outdoor-trad-climbing') THEN 'SPORT_LEAD'::"ClimbingDiscipline"
    ELSE 'BOULDER'::"ClimbingDiscipline"
  END
)
FROM "RoutineLog" rl
JOIN "Routine" r ON r."id" = rl."routineId"
LEFT JOIN "SessionRoutineDetails" srd ON srd."routineId" = r."id"
LEFT JOIN "SessionTemplate" st ON st."id" = srd."templateId"
WHERE ca."sessionLogId" = rl."id";

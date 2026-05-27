-- One-time data migration: convert legacy FELL attempts to either PROJECT
-- or delete them entirely, depending on whether the problem was eventually
-- sent. After this migration the FELL outcome should rarely (or never)
-- appear in new data — the live logger no longer offers it, and historical
-- ambiguity is resolved.
--
-- Rules:
--   1) FELL with problemId AND a clean send (SEND/FLASH/ONSIGHT/REDPOINT)
--      exists on the same problem  → DELETE (it was a working attempt for
--      something that's already been sent — noise).
--   2) FELL with problemId but no clean send on the same problem
--      → UPDATE outcome to PROJECT (the user is working on it).
--   3) FELL with no problemId (quick-mode tallies)
--      → UPDATE outcome to PROJECT (volume tracking; user's mental model
--      treats every non-send as a project).
--
-- The FELL value stays in the ClimbOutcome enum — removing an enum value
-- in Postgres is expensive and unnecessary, since the live logger no longer
-- produces it.

-- 1) Delete FELL attempts on problems that have been cleanly sent.
DELETE FROM "ClimbAttempt"
WHERE "outcome" = 'FELL'
  AND "problemId" IS NOT NULL
  AND EXISTS (
    SELECT 1
    FROM "ClimbAttempt" sent
    WHERE sent."problemId" = "ClimbAttempt"."problemId"
      AND sent."outcome" IN ('SEND', 'FLASH', 'ONSIGHT', 'REDPOINT')
  );

-- 2) Remaining FELL with problemId → PROJECT (no clean send exists).
UPDATE "ClimbAttempt"
SET "outcome" = 'PROJECT'
WHERE "outcome" = 'FELL'
  AND "problemId" IS NOT NULL;

-- 3) Quick-mode FELLs (no problemId) → PROJECT.
UPDATE "ClimbAttempt"
SET "outcome" = 'PROJECT'
WHERE "outcome" = 'FELL'
  AND "problemId" IS NULL;

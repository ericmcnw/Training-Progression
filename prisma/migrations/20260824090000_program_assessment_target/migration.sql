-- Additive: a program assessment gains a target alongside its baseline.
-- All columns are nullable; existing assessments keep behaving as before.

ALTER TABLE "ProgramAssessment"
  ADD COLUMN "targetNumberValue" DOUBLE PRECISION,
  ADD COLUMN "targetNumerator" DOUBLE PRECISION,
  ADD COLUMN "targetDenominator" DOUBLE PRECISION,
  ADD COLUMN "targetTextValue" TEXT;

-- Additive: one nullable-by-default boolean. No existing row changes behaviour,
-- since auto-tick is off unless a step opts in.
ALTER TABLE "ProgressionMilestone" ADD COLUMN "autoTick" BOOLEAN NOT NULL DEFAULT false;

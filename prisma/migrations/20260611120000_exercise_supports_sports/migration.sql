-- Additive: sport slugs an exercise trains for (mirrors Routine.supportsSports)
ALTER TABLE "Exercise" ADD COLUMN "supportsSports" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

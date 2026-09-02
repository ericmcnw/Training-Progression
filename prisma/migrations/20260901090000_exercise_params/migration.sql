-- Setup parameters that vary the difficulty of the same movement:
-- hangboard/edge-lift edge size, slant-board angle, step-down box height.
-- Additive only.

ALTER TABLE "Exercise" ADD COLUMN "paramKeys" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

ALTER TABLE "SessionExercise" ADD COLUMN "params" JSONB;

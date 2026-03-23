ALTER TABLE "GuidedStep"
ADD COLUMN IF NOT EXISTS "repCount" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN IF NOT EXISTS "setCount" INTEGER NOT NULL DEFAULT 1;

UPDATE "GuidedStep"
SET
  "repCount" = 1,
  "setCount" = GREATEST(COALESCE("repeatCount", 1), 1)
WHERE
  COALESCE("repCount", 1) = 1
  AND COALESCE("setCount", 1) = 1;

ALTER TABLE "GuidedStepLog"
ADD COLUMN IF NOT EXISTS "repCount" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN IF NOT EXISTS "setCount" INTEGER NOT NULL DEFAULT 1;

UPDATE "GuidedStepLog"
SET
  "repCount" = 1,
  "setCount" = GREATEST(COALESCE("repeatCount", 1), 1)
WHERE
  COALESCE("repCount", 1) = 1
  AND COALESCE("setCount", 1) = 1;

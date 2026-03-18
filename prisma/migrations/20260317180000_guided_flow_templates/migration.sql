DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'GuidedStepKind') THEN
    CREATE TYPE "GuidedStepKind" AS ENUM ('STEP', 'EXERCISE');
  END IF;
END $$;

ALTER TABLE "GuidedStep"
ADD COLUMN IF NOT EXISTS "kind" "GuidedStepKind" NOT NULL DEFAULT 'STEP',
ADD COLUMN IF NOT EXISTS "exerciseId" TEXT,
ADD COLUMN IF NOT EXISTS "repeatCount" INTEGER NOT NULL DEFAULT 1;

ALTER TABLE "GuidedStepLog"
ADD COLUMN IF NOT EXISTS "kind" "GuidedStepKind" NOT NULL DEFAULT 'STEP',
ADD COLUMN IF NOT EXISTS "exerciseId" TEXT,
ADD COLUMN IF NOT EXISTS "repeatCount" INTEGER NOT NULL DEFAULT 1;

CREATE INDEX IF NOT EXISTS "GuidedStep_exerciseId_idx" ON "GuidedStep"("exerciseId");
CREATE INDEX IF NOT EXISTS "GuidedStepLog_exerciseId_idx" ON "GuidedStepLog"("exerciseId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE constraint_name = 'GuidedStep_exerciseId_fkey'
      AND table_name = 'GuidedStep'
  ) THEN
    ALTER TABLE "GuidedStep"
    ADD CONSTRAINT "GuidedStep_exerciseId_fkey"
    FOREIGN KEY ("exerciseId") REFERENCES "Exercise"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE constraint_name = 'GuidedStepLog_exerciseId_fkey'
      AND table_name = 'GuidedStepLog'
  ) THEN
    ALTER TABLE "GuidedStepLog"
    ADD CONSTRAINT "GuidedStepLog_exerciseId_fkey"
    FOREIGN KEY ("exerciseId") REFERENCES "Exercise"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

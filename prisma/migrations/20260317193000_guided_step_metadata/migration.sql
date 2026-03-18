CREATE TABLE IF NOT EXISTS "GuidedStepMetadataGroup" (
    "guidedStepId" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GuidedStepMetadataGroup_pkey" PRIMARY KEY ("guidedStepId","groupId")
);

CREATE INDEX IF NOT EXISTS "GuidedStepMetadataGroup_groupId_idx" ON "GuidedStepMetadataGroup"("groupId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE constraint_name = 'GuidedStepMetadataGroup_guidedStepId_fkey'
      AND table_name = 'GuidedStepMetadataGroup'
  ) THEN
    ALTER TABLE "GuidedStepMetadataGroup"
    ADD CONSTRAINT "GuidedStepMetadataGroup_guidedStepId_fkey"
    FOREIGN KEY ("guidedStepId") REFERENCES "GuidedStep"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE constraint_name = 'GuidedStepMetadataGroup_groupId_fkey'
      AND table_name = 'GuidedStepMetadataGroup'
  ) THEN
    ALTER TABLE "GuidedStepMetadataGroup"
    ADD CONSTRAINT "GuidedStepMetadataGroup_groupId_fkey"
    FOREIGN KEY ("groupId") REFERENCES "MetadataGroup"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

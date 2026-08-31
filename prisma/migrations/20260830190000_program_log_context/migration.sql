-- Preserve the plan a user actually followed. Program edits may change future
-- targets, but this immutable snapshot remains attached to the completed log.
CREATE TABLE "ProgramLogContext" (
    "id" TEXT NOT NULL,
    "routineLogId" TEXT NOT NULL,
    "programId" TEXT,
    "stageId" TEXT,
    "blockItemId" TEXT,
    "plannedSessionId" TEXT,
    "prescriptionSnapshot" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ProgramLogContext_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ProgramLogContext_routineLogId_key" ON "ProgramLogContext"("routineLogId");
CREATE UNIQUE INDEX "ProgramLogContext_plannedSessionId_key" ON "ProgramLogContext"("plannedSessionId");
CREATE INDEX "ProgramLogContext_programId_createdAt_idx" ON "ProgramLogContext"("programId", "createdAt");
CREATE INDEX "ProgramLogContext_stageId_idx" ON "ProgramLogContext"("stageId");
CREATE INDEX "ProgramLogContext_blockItemId_idx" ON "ProgramLogContext"("blockItemId");

ALTER TABLE "ProgramLogContext" ADD CONSTRAINT "ProgramLogContext_routineLogId_fkey"
  FOREIGN KEY ("routineLogId") REFERENCES "RoutineLog"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProgramLogContext" ADD CONSTRAINT "ProgramLogContext_programId_fkey"
  FOREIGN KEY ("programId") REFERENCES "Focus"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ProgramLogContext" ADD CONSTRAINT "ProgramLogContext_stageId_fkey"
  FOREIGN KEY ("stageId") REFERENCES "ProgramStage"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ProgramLogContext" ADD CONSTRAINT "ProgramLogContext_blockItemId_fkey"
  FOREIGN KEY ("blockItemId") REFERENCES "ProgramBlockItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ProgramLogContext" ADD CONSTRAINT "ProgramLogContext_plannedSessionId_fkey"
  FOREIGN KEY ("plannedSessionId") REFERENCES "PlannedSession"("id") ON DELETE SET NULL ON UPDATE CASCADE;

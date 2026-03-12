ALTER TABLE "Routine" ADD COLUMN "cardioType" TEXT;

CREATE INDEX "Routine_cardioType_idx" ON "Routine"("cardioType");

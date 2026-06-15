-- Add per-area media support: ClimbMedia can now attach to a ClimbArea.
ALTER TABLE "ClimbMedia" ADD COLUMN "areaId" TEXT;

ALTER TABLE "ClimbMedia"
  ADD CONSTRAINT "ClimbMedia_areaId_fkey"
  FOREIGN KEY ("areaId") REFERENCES "ClimbArea"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX "ClimbMedia_areaId_sortOrder_idx" ON "ClimbMedia"("areaId", "sortOrder");

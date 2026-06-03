-- First-class sub-region (sector/wall/boulder) inside a ClimbLocation.
-- Climbers think in areas: "I climbed at Cave Wall today" — we want to
-- group attempts by it and filter the browse page on it. Until now the
-- ClimbAttempt.area column held free text per climb, with no dedup and
-- no rollup. This migration:
--   1. creates the ClimbArea table (one row per (location, name)),
--   2. adds ClimbAttempt.areaId nullable FK,
--   3. backfills areas from existing free-text ClimbAttempt.area values
--      bucketed by lower(trim(name)) within each location,
--   4. wires existing attempts to the new rows.
--
-- The free-text ClimbAttempt.area column is intentionally left in place
-- as a legacy fallback for the few rows whose sessions had no
-- climbLocationId — those can't be migrated (no parent location to
-- attach to). UI prefers climbArea.name, falls back to ClimbAttempt.area.

-- CreateTable
CREATE TABLE "ClimbArea" (
    "id" TEXT NOT NULL,
    "locationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ClimbArea_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ClimbArea_locationId_name_key" ON "ClimbArea"("locationId", "name");
CREATE INDEX "ClimbArea_locationId_idx" ON "ClimbArea"("locationId");

-- AddForeignKey
ALTER TABLE "ClimbArea" ADD CONSTRAINT "ClimbArea_locationId_fkey"
    FOREIGN KEY ("locationId") REFERENCES "ClimbLocation"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

-- AlterTable
ALTER TABLE "ClimbAttempt" ADD COLUMN "areaId" TEXT;

-- CreateIndex
CREATE INDEX "ClimbAttempt_areaId_idx" ON "ClimbAttempt"("areaId");

-- AddForeignKey
ALTER TABLE "ClimbAttempt" ADD CONSTRAINT "ClimbAttempt_areaId_fkey"
    FOREIGN KEY ("areaId") REFERENCES "ClimbArea"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

-- Backfill ClimbArea rows from existing free-text ClimbAttempt.area values.
-- Bucket by (climbLocationId, lower(trim(area))) so case/whitespace variants
-- collapse into a single area row. Pick MIN(trim(area)) as the display name
-- for stability across re-runs. Skip attempts without a parent location —
-- areas only make sense scoped under a location.
INSERT INTO "ClimbArea" ("id", "locationId", "name", "createdAt", "updatedAt")
SELECT
    'carea_' || md5(rl."climbLocationId" || '::' || lower(trim(ca."area"))),
    rl."climbLocationId",
    MIN(trim(ca."area")),
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
FROM "ClimbAttempt" ca
JOIN "RoutineLog" rl ON rl."id" = ca."sessionLogId"
WHERE ca."area" IS NOT NULL
  AND trim(ca."area") <> ''
  AND rl."climbLocationId" IS NOT NULL
GROUP BY rl."climbLocationId", lower(trim(ca."area"))
ON CONFLICT ("locationId", "name") DO NOTHING;

-- Link each existing attempt to its newly-created ClimbArea (or to one that
-- already existed via re-run). Match case-insensitively on trimmed name +
-- the attempt's session-log location.
UPDATE "ClimbAttempt" ca
SET "areaId" = a."id"
FROM "ClimbArea" a
JOIN "RoutineLog" rl ON rl."climbLocationId" = a."locationId"
WHERE ca."sessionLogId" = rl."id"
  AND ca."area" IS NOT NULL
  AND trim(ca."area") <> ''
  AND lower(a."name") = lower(trim(ca."area"));

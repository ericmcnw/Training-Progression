-- Daily wearable context: sleep, steps, distance. One row per day.
--
-- Additive: a new table, no existing column touched. Nothing reads it until
-- the profile surface ships, so applying this ahead of the code is a no-op
-- for every existing page.

CREATE TABLE "DailyMetric" (
  "id" TEXT NOT NULL,
  "profileKey" TEXT NOT NULL DEFAULT 'default',
  "day" TIMESTAMP(3) NOT NULL,
  "source" TEXT NOT NULL DEFAULT 'manual',
  "sleepMinutes" INTEGER,
  "sleepScore" INTEGER,
  "steps" INTEGER,
  "distanceMi" DOUBLE PRECISION,
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "DailyMetric_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "DailyMetric_profileKey_day_key" ON "DailyMetric"("profileKey", "day");

CREATE INDEX "DailyMetric_profileKey_day_idx" ON "DailyMetric"("profileKey", "day");

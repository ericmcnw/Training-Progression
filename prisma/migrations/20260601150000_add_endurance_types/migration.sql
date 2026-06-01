-- Endurance type unification, Phase 1: schema + seed.
--
-- Adds the EnduranceFamily + ActivityType + UserActivityTypePreference
-- tables, plus activityTypeId columns on every record that needs to know
-- about types (Routine, RoutineLog, ScheduleEntry, ScheduleManualEntry).
-- FrequencyGoal gains polymorphic trigger arrays so goals can target by
-- type or family (mirrors the existing triggerSubtypes pattern).
--
-- All seed data lives in this migration so a fresh database is immediately
-- usable: 5 families + 16 activity types + 1 synthetic Endurance routine
-- that holds every typed-endurance log's routineId FK.
--
-- The Phase 2 data migration (separate file) backfills existing endurance
-- routines/logs to their typeIds.

-- ─── New tables ─────────────────────────────────────────────────────────────

CREATE TABLE "EnduranceFamily" (
  "id" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "EnduranceFamily_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "EnduranceFamily_slug_key" ON "EnduranceFamily"("slug");
CREATE INDEX "EnduranceFamily_sortOrder_idx" ON "EnduranceFamily"("sortOrder");

CREATE TABLE "ActivityType" (
  "id" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "familyId" TEXT NOT NULL,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "hasDistance" BOOLEAN NOT NULL DEFAULT true,
  "hasElevation" BOOLEAN NOT NULL DEFAULT false,
  "hasPace" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ActivityType_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "ActivityType_slug_key" ON "ActivityType"("slug");
CREATE INDEX "ActivityType_familyId_sortOrder_idx" ON "ActivityType"("familyId", "sortOrder");
CREATE INDEX "ActivityType_slug_idx" ON "ActivityType"("slug");
ALTER TABLE "ActivityType" ADD CONSTRAINT "ActivityType_familyId_fkey"
  FOREIGN KEY ("familyId") REFERENCES "EnduranceFamily"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "UserActivityTypePreference" (
  "id" TEXT NOT NULL,
  "activityTypeId" TEXT NOT NULL,
  "enabled" BOOLEAN NOT NULL DEFAULT true,
  "sortOrder" INTEGER,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "UserActivityTypePreference_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "UserActivityTypePreference_activityTypeId_key" ON "UserActivityTypePreference"("activityTypeId");
ALTER TABLE "UserActivityTypePreference" ADD CONSTRAINT "UserActivityTypePreference_activityTypeId_fkey"
  FOREIGN KEY ("activityTypeId") REFERENCES "ActivityType"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ─── Add activityTypeId columns to existing tables ──────────────────────────

ALTER TABLE "Routine" ADD COLUMN "activityTypeId" TEXT;
ALTER TABLE "Routine" ADD CONSTRAINT "Routine_activityTypeId_fkey"
  FOREIGN KEY ("activityTypeId") REFERENCES "ActivityType"("id") ON DELETE SET NULL ON UPDATE CASCADE;
CREATE INDEX "Routine_activityTypeId_idx" ON "Routine"("activityTypeId");

ALTER TABLE "RoutineLog" ADD COLUMN "activityTypeId" TEXT;
ALTER TABLE "RoutineLog" ADD CONSTRAINT "RoutineLog_activityTypeId_fkey"
  FOREIGN KEY ("activityTypeId") REFERENCES "ActivityType"("id") ON DELETE SET NULL ON UPDATE CASCADE;
CREATE INDEX "RoutineLog_activityTypeId_performedAt_idx" ON "RoutineLog"("activityTypeId", "performedAt");

ALTER TABLE "ScheduleEntry" ADD COLUMN "activityTypeId" TEXT;
ALTER TABLE "ScheduleEntry" ADD CONSTRAINT "ScheduleEntry_activityTypeId_fkey"
  FOREIGN KEY ("activityTypeId") REFERENCES "ActivityType"("id") ON DELETE SET NULL ON UPDATE CASCADE;
CREATE INDEX "ScheduleEntry_activityTypeId_idx" ON "ScheduleEntry"("activityTypeId");

ALTER TABLE "ScheduleManualEntry" ADD COLUMN "activityTypeId" TEXT;
ALTER TABLE "ScheduleManualEntry" ADD CONSTRAINT "ScheduleManualEntry_activityTypeId_fkey"
  FOREIGN KEY ("activityTypeId") REFERENCES "ActivityType"("id") ON DELETE SET NULL ON UPDATE CASCADE;
CREATE INDEX "ScheduleManualEntry_activityTypeId_idx" ON "ScheduleManualEntry"("activityTypeId");

-- ─── Frequency goal trigger arrays ──────────────────────────────────────────
-- Mirror the existing triggerSubtypes pattern. Empty array = no trigger.

ALTER TABLE "FrequencyGoal" ADD COLUMN "triggerActivityTypeIds" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "FrequencyGoal" ADD COLUMN "triggerActivityFamilyIds" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

-- ─── RLS for new tables ─────────────────────────────────────────────────────
-- Per the convention in 20260520120000_enable_rls_on_public_tables, every
-- new table must enable RLS. Without policies this denies all anon access
-- via PostgREST; Prisma queries (postgres superuser) bypass RLS and keep
-- working unchanged.

ALTER TABLE "EnduranceFamily" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ActivityType" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "UserActivityTypePreference" ENABLE ROW LEVEL SECURITY;

-- ─── Seed: families ─────────────────────────────────────────────────────────
-- Stable cuid-like ids so client code can reference them by constant if
-- needed. Slugs are the canonical user-facing identifier; ids stay private.

INSERT INTO "EnduranceFamily" ("id", "slug", "name", "sortOrder", "updatedAt") VALUES
  ('endfam_running',  'running',  'Running',  10, CURRENT_TIMESTAMP),
  ('endfam_walking',  'walking',  'Walking',  20, CURRENT_TIMESTAMP),
  ('endfam_cycling',  'cycling',  'Cycling',  30, CURRENT_TIMESTAMP),
  ('endfam_swimming', 'swimming', 'Swimming', 40, CURRENT_TIMESTAMP),
  ('endfam_rowing',   'rowing',   'Rowing',   50, CURRENT_TIMESTAMP);

-- ─── Seed: activity types ───────────────────────────────────────────────────
-- Family generic first (sortOrder=0 within the family), then specifics.
-- hasElevation flag: trail/hike/MTB-style outdoor types where elevation is
-- meaningful; flat-road / pool types leave it false.

INSERT INTO "ActivityType" ("id", "slug", "name", "familyId", "sortOrder", "hasDistance", "hasElevation", "hasPace", "updatedAt") VALUES
  -- Running family
  ('actype_run',          'run',          'Run',          'endfam_running', 0,  true,  false, true, CURRENT_TIMESTAMP),
  ('actype_trail_run',    'trail-run',    'Trail Run',    'endfam_running', 10, true,  true,  true, CURRENT_TIMESTAMP),
  ('actype_long_run',     'long-run',     'Long Run',     'endfam_running', 20, true,  true,  true, CURRENT_TIMESTAMP),
  ('actype_tempo_run',    'tempo-run',    'Tempo Run',    'endfam_running', 30, true,  false, true, CURRENT_TIMESTAMP),
  ('actype_easy_run',     'easy-run',     'Easy Run',     'endfam_running', 40, true,  false, true, CURRENT_TIMESTAMP),
  ('actype_interval_run', 'interval-run', 'Interval Run', 'endfam_running', 50, true,  false, true, CURRENT_TIMESTAMP),
  -- Walking family
  ('actype_walk',         'walk',         'Walk',         'endfam_walking', 0,  true,  false, true, CURRENT_TIMESTAMP),
  ('actype_hike',         'hike',         'Hike',         'endfam_walking', 10, true,  true,  true, CURRENT_TIMESTAMP),
  -- Cycling family
  ('actype_bike',         'bike',         'Bike',         'endfam_cycling', 0,  true,  true,  true, CURRENT_TIMESTAMP),
  ('actype_mtb',          'mtb',          'MTB',          'endfam_cycling', 10, true,  true,  true, CURRENT_TIMESTAMP),
  ('actype_road_bike',    'road-bike',    'Road Bike',    'endfam_cycling', 20, true,  true,  true, CURRENT_TIMESTAMP),
  ('actype_gravel_bike',  'gravel-bike',  'Gravel Bike',  'endfam_cycling', 30, true,  true,  true, CURRENT_TIMESTAMP),
  -- Swimming family
  ('actype_swim',         'swim',         'Swim',         'endfam_swimming', 0,  true, false, true, CURRENT_TIMESTAMP),
  ('actype_ows',          'open-water-swim', 'Open Water Swim', 'endfam_swimming', 10, true, false, true, CURRENT_TIMESTAMP),
  -- Rowing family
  ('actype_row',          'row',          'Row',          'endfam_rowing', 0,  true, false, true, CURRENT_TIMESTAMP),
  ('actype_erg_row',      'erg-row',      'Erg Row',      'endfam_rowing', 10, false, false, true, CURRENT_TIMESTAMP);

-- ─── Seed: synthetic Endurance routine ──────────────────────────────────────
-- Every typed-endurance log references this single routine via routineId so
-- the FK invariant holds without nulling out RoutineLog.routineId across the
-- codebase. isPlaceholder = true keeps it out of routine lists / pickers /
-- goal-target dropdowns (existing UI already filters those).
--
-- Idempotent: if a prior partial migration created this row, the
-- ON CONFLICT DO NOTHING keeps the migration replayable.

-- Note: domain = 'cardio' (not 'endurance') to match the existing
-- ROUTINE_DOMAIN_OPTIONS convention in lib/routines.ts, where the "cardio"
-- domain value maps to the user-facing "Endurance" label. Using "cardio"
-- means the synthetic routine lands in the existing endurance section on
-- the routines list page without any special-casing.
INSERT INTO "Routine" (
  "id", "name", "domain", "kind", "isActive", "isPlaceholder", "isDeleted", "updatedAt"
) VALUES (
  'endurance-synthetic', 'Endurance', 'cardio', 'CARDIO', true, true, false, CURRENT_TIMESTAMP
) ON CONFLICT ("id") DO NOTHING;

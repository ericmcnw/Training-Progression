-- Pool Swim activity type.
--
-- The "pool-swimming" registry slug already existed in lib/activity-families.ts,
-- had a chart color, and had a CARDIO_ACTIVITY metadata group — but no
-- ActivityType fed it, so nothing could ever land in that bucket. This adds the
-- missing row between Swim (0) and Open Water Swim (10).
--
-- usesIntervals stays false: pool swims render their own structured set builder
-- (RoutineLog.sportData, sport: "pool-swim") rather than the running-shaped
-- reps/work/rest block that flag drives.

INSERT INTO "ActivityType" ("id", "slug", "name", "familyId", "sortOrder", "hasDistance", "hasElevation", "hasPace", "usesIntervals", "updatedAt") VALUES
  ('actype_pool_swim', 'pool-swim', 'Pool Swim', 'endfam_swimming', 5, true, false, true, false, CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO NOTHING;

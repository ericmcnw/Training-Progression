-- Carried load on an endurance log: total weight on your back for the session.
--
-- Distance and elevation describe the route; they say nothing about what you
-- carried over it. A loaded approach and an empty-handed walk of the same
-- shape are the same row today.
--
-- Additive: one nullable column, nothing existing is touched and there is no
-- backfill. Every prior log reads null, which renders as "not recorded"
-- rather than as zero. Grams to match Gear.weightGrams and the existing
-- BackpackingTrip.packWeightGrams.

ALTER TABLE "RoutineLog" ADD COLUMN "packWeightGrams" INTEGER;

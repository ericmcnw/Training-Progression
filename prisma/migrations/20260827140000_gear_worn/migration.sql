-- Per-item worn/carried default.
--
-- Whether something is worn or carried is really a property of the SESSION —
-- the same jacket is worn on a cold approach and packed on a warm one — so the
-- log's pick can override this. But most items have a stable habit, and the
-- gear-type default (GEAR_TYPES.worn) is wrong for anything free-typed, which
-- is most apparel.
--
-- Nullable on purpose: null means "no opinion, use the type default", so a row
-- only stores a value once you've actually overridden it. Additive, no backfill.

ALTER TABLE "Gear" ADD COLUMN "worn" BOOLEAN;

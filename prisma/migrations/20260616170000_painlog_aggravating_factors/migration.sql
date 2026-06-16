-- Capture aggravating factors at pain-log time (also merged into the zone's
-- active injury by the logPain action). Additive.
ALTER TABLE "PainLog" ADD COLUMN "aggravatingFactors" TEXT[] NOT NULL DEFAULT '{}';

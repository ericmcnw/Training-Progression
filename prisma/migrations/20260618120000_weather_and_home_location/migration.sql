-- RoutineLog: weather snapshot captured at save time (sport + endurance logs).
ALTER TABLE "RoutineLog" ADD COLUMN "weather" JSONB;

-- AppProfile: home base location (default weather anchor).
ALTER TABLE "AppProfile" ADD COLUMN "homeLat" DOUBLE PRECISION;
ALTER TABLE "AppProfile" ADD COLUMN "homeLng" DOUBLE PRECISION;
ALTER TABLE "AppProfile" ADD COLUMN "homeLabel" TEXT;

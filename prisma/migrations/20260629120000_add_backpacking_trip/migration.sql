-- BackpackingTrip: parent of a multi-day trip's per-day RoutineLog rows.
CREATE TABLE "BackpackingTrip" (
    "id" TEXT NOT NULL,
    "profileKey" TEXT NOT NULL,
    "routineId" TEXT NOT NULL,
    "trail" TEXT,
    "location" TEXT,
    "activitySpotId" TEXT,
    "startYmd" TEXT NOT NULL,
    "endYmd" TEXT NOT NULL,
    "totalMiles" DOUBLE PRECISION,
    "gear" JSONB,
    "packWeightGrams" INTEGER,
    "baseWeightGrams" INTEGER,
    "notes" TEXT,
    "effort" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BackpackingTrip_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "BackpackingTrip_profileKey_startYmd_idx" ON "BackpackingTrip"("profileKey", "startYmd");

-- RoutineLog: link each day-log back to its trip (cascade on trip delete).
ALTER TABLE "RoutineLog" ADD COLUMN "backpackingTripId" TEXT;

CREATE INDEX "RoutineLog_backpackingTripId_idx" ON "RoutineLog"("backpackingTripId");

ALTER TABLE "RoutineLog" ADD CONSTRAINT "RoutineLog_backpackingTripId_fkey"
    FOREIGN KEY ("backpackingTripId") REFERENCES "BackpackingTrip"("id") ON DELETE CASCADE ON UPDATE CASCADE;

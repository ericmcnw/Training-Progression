-- LocationPing: passive location breadcrumbs captured on app open, used to
-- attribute weather to past Week-at-a-glance days you visited but didn't log at.
CREATE TABLE "LocationPing" (
    "id" TEXT NOT NULL,
    "profileKey" TEXT NOT NULL,
    "lat" DOUBLE PRECISION NOT NULL,
    "lng" DOUBLE PRECISION NOT NULL,
    "capturedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LocationPing_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "LocationPing_profileKey_capturedAt_idx" ON "LocationPing"("profileKey", "capturedAt");

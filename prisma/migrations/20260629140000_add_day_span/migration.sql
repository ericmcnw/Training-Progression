-- DaySpan: a generic multi-day annotation (vacation / travel / away) rendered
-- as a bar across the Week-at-a-glance. Pure annotation; no logs attached.
CREATE TABLE "DaySpan" (
    "id" TEXT NOT NULL,
    "profileKey" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "startYmd" TEXT NOT NULL,
    "endYmd" TEXT NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DaySpan_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "DaySpan_profileKey_startYmd_idx" ON "DaySpan"("profileKey", "startYmd");

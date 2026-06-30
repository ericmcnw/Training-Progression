-- Gear: owned, reusable inventory items picked on logs.
CREATE TABLE "Gear" (
    "id" TEXT NOT NULL,
    "profileKey" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "weightGrams" INTEGER,
    "activitySlug" TEXT,
    "consumable" BOOLEAN NOT NULL DEFAULT false,
    "retiredAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Gear_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Gear_profileKey_retiredAt_idx" ON "Gear"("profileKey", "retiredAt");

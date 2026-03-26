CREATE TABLE "AppProfile" (
  "id" TEXT NOT NULL,
  "key" TEXT NOT NULL DEFAULT 'default',
  "selectedStimulusPresetKeys" TEXT[] DEFAULT ARRAY[]::TEXT[],
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "AppProfile_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "UserStimulusPreference" (
  "id" TEXT NOT NULL,
  "profileId" TEXT NOT NULL,
  "stimulusCategoryId" TEXT NOT NULL,
  "priorityWeight" DOUBLE PRECISION NOT NULL DEFAULT 1,
  "maintenanceFloor" DOUBLE PRECISION,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "UserStimulusPreference_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AppProfile_key_key" ON "AppProfile"("key");
CREATE UNIQUE INDEX "UserStimulusPreference_profileId_stimulusCategoryId_key"
ON "UserStimulusPreference"("profileId", "stimulusCategoryId");
CREATE INDEX "UserStimulusPreference_stimulusCategoryId_idx" ON "UserStimulusPreference"("stimulusCategoryId");

ALTER TABLE "UserStimulusPreference"
ADD CONSTRAINT "UserStimulusPreference_profileId_fkey"
FOREIGN KEY ("profileId") REFERENCES "AppProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "UserStimulusPreference"
ADD CONSTRAINT "UserStimulusPreference_stimulusCategoryId_fkey"
FOREIGN KEY ("stimulusCategoryId") REFERENCES "StimulusCategory"("id") ON DELETE CASCADE ON UPDATE CASCADE;

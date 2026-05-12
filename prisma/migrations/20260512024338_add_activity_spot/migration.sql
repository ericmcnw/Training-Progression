-- AlterTable
ALTER TABLE "RoutineLog" ADD COLUMN     "activitySpotId" TEXT;

-- CreateTable
CREATE TABLE "ActivitySpot" (
    "id" TEXT NOT NULL,
    "activitySlug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ActivitySpot_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ActivitySpot_activitySlug_name_idx" ON "ActivitySpot"("activitySlug", "name");

-- CreateIndex
CREATE INDEX "RoutineLog_activitySpotId_idx" ON "RoutineLog"("activitySpotId");

-- AddForeignKey
ALTER TABLE "RoutineLog" ADD CONSTRAINT "RoutineLog_activitySpotId_fkey" FOREIGN KEY ("activitySpotId") REFERENCES "ActivitySpot"("id") ON DELETE SET NULL ON UPDATE CASCADE;

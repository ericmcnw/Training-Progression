-- AlterTable
ALTER TABLE "ActivitySpot" ADD COLUMN     "osmId" TEXT,
ADD COLUMN     "osmType" TEXT;

-- AlterTable
ALTER TABLE "ClimbLocation" ADD COLUMN     "osmId" TEXT,
ADD COLUMN     "osmType" TEXT;

-- CreateIndex
CREATE INDEX "ActivitySpot_osmType_osmId_idx" ON "ActivitySpot"("osmType", "osmId");

-- CreateIndex
CREATE INDEX "ClimbLocation_osmType_osmId_idx" ON "ClimbLocation"("osmType", "osmId");

-- Rotations: ordered training slots advanced by logging, with coverage maps.
CREATE TABLE "Rotation" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Rotation_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Rotation_isActive_idx" ON "Rotation"("isActive");

CREATE TABLE "RotationSlot" (
  "id" TEXT NOT NULL,
  "rotationId" TEXT NOT NULL,
  "position" INTEGER NOT NULL DEFAULT 0,
  "name" TEXT NOT NULL,
  "primaryRoutineId" TEXT,
  CONSTRAINT "RotationSlot_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "RotationSlot_rotationId_position_idx" ON "RotationSlot"("rotationId", "position");

CREATE TABLE "RotationSlotCoverage" (
  "id" TEXT NOT NULL,
  "slotId" TEXT NOT NULL,
  "routineId" TEXT,
  "tag" TEXT,
  CONSTRAINT "RotationSlotCoverage_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "RotationSlotCoverage_slotId_idx" ON "RotationSlotCoverage"("slotId");

ALTER TABLE "RotationSlot"
  ADD CONSTRAINT "RotationSlot_rotationId_fkey"
  FOREIGN KEY ("rotationId") REFERENCES "Rotation"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "RotationSlotCoverage"
  ADD CONSTRAINT "RotationSlotCoverage_slotId_fkey"
  FOREIGN KEY ("slotId") REFERENCES "RotationSlot"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TYPE "ExerciseLibraryKind" AS ENUM (
  'STRENGTH',
  'CONDITIONING',
  'MOBILITY',
  'STRETCH',
  'BREATHWORK',
  'SKILL'
);

ALTER TABLE "Exercise"
ADD COLUMN "libraryKind" "ExerciseLibraryKind" NOT NULL DEFAULT 'STRENGTH';

CREATE TABLE "StimulusCategory" (
  "id" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "label" TEXT NOT NULL,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "StimulusCategory_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "MetadataStimulusMapping" (
  "id" TEXT NOT NULL,
  "metadataGroupId" TEXT NOT NULL,
  "stimulusCategoryId" TEXT NOT NULL,
  "loadWeight" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "stretchWeight" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "MetadataStimulusMapping_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "RoutineLogStimulus" (
  "id" TEXT NOT NULL,
  "routineLogId" TEXT NOT NULL,
  "stimulusCategoryId" TEXT NOT NULL,
  "loadValue" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "stretchValue" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "confidence" DOUBLE PRECISION,
  "sourceKind" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "RoutineLogStimulus_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "StimulusCategory_slug_key" ON "StimulusCategory"("slug");
CREATE INDEX "StimulusCategory_sortOrder_label_idx" ON "StimulusCategory"("sortOrder", "label");

CREATE UNIQUE INDEX "MetadataStimulusMapping_metadataGroupId_stimulusCategoryId_key"
ON "MetadataStimulusMapping"("metadataGroupId", "stimulusCategoryId");
CREATE INDEX "MetadataStimulusMapping_stimulusCategoryId_idx" ON "MetadataStimulusMapping"("stimulusCategoryId");

CREATE UNIQUE INDEX "RoutineLogStimulus_routineLogId_stimulusCategoryId_key"
ON "RoutineLogStimulus"("routineLogId", "stimulusCategoryId");
CREATE INDEX "RoutineLogStimulus_stimulusCategoryId_idx" ON "RoutineLogStimulus"("stimulusCategoryId");

CREATE INDEX "Exercise_libraryKind_name_idx" ON "Exercise"("libraryKind", "name");

ALTER TABLE "MetadataStimulusMapping"
ADD CONSTRAINT "MetadataStimulusMapping_metadataGroupId_fkey"
FOREIGN KEY ("metadataGroupId") REFERENCES "MetadataGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "MetadataStimulusMapping"
ADD CONSTRAINT "MetadataStimulusMapping_stimulusCategoryId_fkey"
FOREIGN KEY ("stimulusCategoryId") REFERENCES "StimulusCategory"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "RoutineLogStimulus"
ADD CONSTRAINT "RoutineLogStimulus_routineLogId_fkey"
FOREIGN KEY ("routineLogId") REFERENCES "RoutineLog"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "RoutineLogStimulus"
ADD CONSTRAINT "RoutineLogStimulus_stimulusCategoryId_fkey"
FOREIGN KEY ("stimulusCategoryId") REFERENCES "StimulusCategory"("id") ON DELETE CASCADE ON UPDATE CASCADE;

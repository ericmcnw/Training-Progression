-- CreateEnum
CREATE TYPE "MetadataGroupKind" AS ENUM ('MUSCLE_GROUP', 'MOVEMENT_PATTERN', 'TRAINING_GROUP', 'CARDIO_ACTIVITY', 'ROUTINE_FOCUS');

-- CreateTable
CREATE TABLE "MetadataGroup" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "kind" "MetadataGroupKind" NOT NULL,
    "description" TEXT,
    "appliesToRoutine" BOOLEAN NOT NULL DEFAULT false,
    "appliesToExercise" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MetadataGroup_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MetadataGroupRelation" (
    "parentGroupId" TEXT NOT NULL,
    "childGroupId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MetadataGroupRelation_pkey" PRIMARY KEY ("parentGroupId","childGroupId")
);

-- CreateTable
CREATE TABLE "RoutineMetadataGroup" (
    "routineId" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RoutineMetadataGroup_pkey" PRIMARY KEY ("routineId","groupId")
);

-- CreateTable
CREATE TABLE "ExerciseMetadataGroup" (
    "exerciseId" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ExerciseMetadataGroup_pkey" PRIMARY KEY ("exerciseId","groupId")
);

-- CreateTable
CREATE TABLE "RoutineTag" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RoutineTag_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RoutineTagAssignment" (
    "routineId" TEXT NOT NULL,
    "tagId" TEXT NOT NULL,
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RoutineTagAssignment_pkey" PRIMARY KEY ("routineId","tagId")
);

-- CreateIndex
CREATE UNIQUE INDEX "MetadataGroup_slug_key" ON "MetadataGroup"("slug");

-- CreateIndex
CREATE INDEX "MetadataGroup_kind_label_idx" ON "MetadataGroup"("kind", "label");

-- CreateIndex
CREATE INDEX "MetadataGroup_appliesToRoutine_idx" ON "MetadataGroup"("appliesToRoutine");

-- CreateIndex
CREATE INDEX "MetadataGroup_appliesToExercise_idx" ON "MetadataGroup"("appliesToExercise");

-- CreateIndex
CREATE INDEX "MetadataGroupRelation_childGroupId_idx" ON "MetadataGroupRelation"("childGroupId");

-- CreateIndex
CREATE INDEX "RoutineMetadataGroup_groupId_idx" ON "RoutineMetadataGroup"("groupId");

-- CreateIndex
CREATE INDEX "ExerciseMetadataGroup_groupId_idx" ON "ExerciseMetadataGroup"("groupId");

-- CreateIndex
CREATE UNIQUE INDEX "RoutineTag_name_key" ON "RoutineTag"("name");

-- CreateIndex
CREATE INDEX "RoutineTagAssignment_tagId_idx" ON "RoutineTagAssignment"("tagId");

-- AddForeignKey
ALTER TABLE "MetadataGroupRelation" ADD CONSTRAINT "MetadataGroupRelation_parentGroupId_fkey" FOREIGN KEY ("parentGroupId") REFERENCES "MetadataGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MetadataGroupRelation" ADD CONSTRAINT "MetadataGroupRelation_childGroupId_fkey" FOREIGN KEY ("childGroupId") REFERENCES "MetadataGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoutineMetadataGroup" ADD CONSTRAINT "RoutineMetadataGroup_routineId_fkey" FOREIGN KEY ("routineId") REFERENCES "Routine"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoutineMetadataGroup" ADD CONSTRAINT "RoutineMetadataGroup_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "MetadataGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExerciseMetadataGroup" ADD CONSTRAINT "ExerciseMetadataGroup_exerciseId_fkey" FOREIGN KEY ("exerciseId") REFERENCES "Exercise"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExerciseMetadataGroup" ADD CONSTRAINT "ExerciseMetadataGroup_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "MetadataGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoutineTagAssignment" ADD CONSTRAINT "RoutineTagAssignment_routineId_fkey" FOREIGN KEY ("routineId") REFERENCES "Routine"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoutineTagAssignment" ADD CONSTRAINT "RoutineTagAssignment_tagId_fkey" FOREIGN KEY ("tagId") REFERENCES "RoutineTag"("id") ON DELETE CASCADE ON UPDATE CASCADE;


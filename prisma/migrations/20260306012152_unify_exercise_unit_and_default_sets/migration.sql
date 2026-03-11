/*
  Warnings:

  - You are about to drop the column `defaultMeasure` on the `Exercise` table. All the data in the column will be lost.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Exercise" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "unit" TEXT NOT NULL DEFAULT 'REPS',
    "supportsWeight" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_Exercise" ("createdAt", "id", "name", "supportsWeight", "updatedAt") SELECT "createdAt", "id", "name", "supportsWeight", "updatedAt" FROM "Exercise";
DROP TABLE "Exercise";
ALTER TABLE "new_Exercise" RENAME TO "Exercise";
CREATE UNIQUE INDEX "Exercise_name_key" ON "Exercise"("name");
CREATE TABLE "new_RoutineExercise" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "routineId" TEXT NOT NULL,
    "exerciseId" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "defaultSets" INTEGER NOT NULL DEFAULT 3,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "RoutineExercise_routineId_fkey" FOREIGN KEY ("routineId") REFERENCES "Routine" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "RoutineExercise_exerciseId_fkey" FOREIGN KEY ("exerciseId") REFERENCES "Exercise" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_RoutineExercise" ("createdAt", "exerciseId", "id", "routineId", "sortOrder", "updatedAt") SELECT "createdAt", "exerciseId", "id", "routineId", "sortOrder", "updatedAt" FROM "RoutineExercise";
DROP TABLE "RoutineExercise";
ALTER TABLE "new_RoutineExercise" RENAME TO "RoutineExercise";
CREATE INDEX "RoutineExercise_routineId_sortOrder_idx" ON "RoutineExercise"("routineId", "sortOrder");
CREATE UNIQUE INDEX "RoutineExercise_routineId_exerciseId_key" ON "RoutineExercise"("routineId", "exerciseId");
CREATE TABLE "new_SessionExercise" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "routineLogId" TEXT NOT NULL,
    "exerciseId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SessionExercise_routineLogId_fkey" FOREIGN KEY ("routineLogId") REFERENCES "RoutineLog" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "SessionExercise_exerciseId_fkey" FOREIGN KEY ("exerciseId") REFERENCES "Exercise" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_SessionExercise" ("createdAt", "exerciseId", "id", "routineLogId") SELECT "createdAt", "exerciseId", "id", "routineLogId" FROM "SessionExercise";
DROP TABLE "SessionExercise";
ALTER TABLE "new_SessionExercise" RENAME TO "SessionExercise";
CREATE INDEX "SessionExercise_routineLogId_idx" ON "SessionExercise"("routineLogId");
CREATE INDEX "SessionExercise_exerciseId_idx" ON "SessionExercise"("exerciseId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "Routine_isActive_idx" ON "Routine"("isActive");

-- CreateIndex
CREATE INDEX "Routine_isDeleted_idx" ON "Routine"("isDeleted");

-- CreateIndex
CREATE INDEX "Routine_category_idx" ON "Routine"("category");

-- CreateIndex
CREATE INDEX "SetEntry_sessionExerciseId_idx" ON "SetEntry"("sessionExerciseId");

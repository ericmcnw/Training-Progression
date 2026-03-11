PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;

CREATE TABLE "new_Routine" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL DEFAULT 'General',
    "subtype" TEXT,
    "domain" TEXT NOT NULL DEFAULT 'general',
    "kind" TEXT NOT NULL DEFAULT 'COMPLETION',
    "timesPerWeek" INTEGER,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "deletedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

INSERT INTO "new_Routine" (
    "id",
    "name",
    "category",
    "subtype",
    "domain",
    "kind",
    "timesPerWeek",
    "isActive",
    "isDeleted",
    "deletedAt",
    "createdAt",
    "updatedAt"
)
SELECT
    "id",
    "name",
    "category",
    CASE
        WHEN "kind" = 'CARDIO' THEN COALESCE(NULLIF(UPPER(REPLACE(REPLACE(TRIM(COALESCE("cardioType", '')), ' ', '_'), '-', '_')), ''), 'OTHER')
        ELSE NULL
    END,
    "domain",
    CASE
        WHEN "kind" = 'CHECK' THEN 'COMPLETION'
        ELSE "kind"
    END,
    "timesPerWeek",
    "isActive",
    "isDeleted",
    "deletedAt",
    "createdAt",
    "updatedAt"
FROM "Routine";

DROP TABLE "Routine";
ALTER TABLE "new_Routine" RENAME TO "Routine";

CREATE INDEX "Routine_isActive_idx" ON "Routine"("isActive");
CREATE INDEX "Routine_isDeleted_idx" ON "Routine"("isDeleted");
CREATE INDEX "Routine_category_idx" ON "Routine"("category");
CREATE INDEX "Routine_kind_subtype_idx" ON "Routine"("kind", "subtype");

ALTER TABLE "RoutineLog" ADD COLUMN "completionCount" INTEGER;
ALTER TABLE "RoutineLog" ADD COLUMN "location" TEXT;

CREATE TABLE "GuidedStep" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "routineId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "durationSec" INTEGER,
    "restSec" INTEGER,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "GuidedStep_routineId_fkey" FOREIGN KEY ("routineId") REFERENCES "Routine" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "GuidedStepLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "routineLogId" TEXT NOT NULL,
    "guidedStepId" TEXT,
    "title" TEXT NOT NULL,
    "durationSec" INTEGER,
    "restSec" INTEGER,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "GuidedStepLog_routineLogId_fkey" FOREIGN KEY ("routineLogId") REFERENCES "RoutineLog" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "GuidedStepLog_guidedStepId_fkey" FOREIGN KEY ("guidedStepId") REFERENCES "GuidedStep" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE TABLE "RoutineLogMetric" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "routineLogId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "value" REAL NOT NULL,
    "unit" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "RoutineLogMetric_routineLogId_fkey" FOREIGN KEY ("routineLogId") REFERENCES "RoutineLog" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "CardioRoutineDetails" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "routineId" TEXT NOT NULL,
    "defaultDistanceUnit" TEXT NOT NULL DEFAULT 'mi',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "CardioRoutineDetails_routineId_fkey" FOREIGN KEY ("routineId") REFERENCES "Routine" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "SessionRoutineDetails" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "routineId" TEXT NOT NULL,
    "supportsLocation" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "SessionRoutineDetails_routineId_fkey" FOREIGN KEY ("routineId") REFERENCES "Routine" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "GuidedStep_routineId_sortOrder_idx" ON "GuidedStep"("routineId", "sortOrder");
CREATE INDEX "GuidedStepLog_routineLogId_sortOrder_idx" ON "GuidedStepLog"("routineLogId", "sortOrder");
CREATE INDEX "GuidedStepLog_guidedStepId_idx" ON "GuidedStepLog"("guidedStepId");
CREATE INDEX "RoutineLogMetric_routineLogId_sortOrder_idx" ON "RoutineLogMetric"("routineLogId", "sortOrder");
CREATE UNIQUE INDEX "CardioRoutineDetails_routineId_key" ON "CardioRoutineDetails"("routineId");
CREATE UNIQUE INDEX "SessionRoutineDetails_routineId_key" ON "SessionRoutineDetails"("routineId");

INSERT INTO "CardioRoutineDetails" ("id", "routineId", "defaultDistanceUnit", "createdAt", "updatedAt")
SELECT
    lower(hex(randomblob(4))) || lower(hex(randomblob(2))) || '4' || substr(lower(hex(randomblob(2))), 2) || substr('89ab', abs(random()) % 4 + 1, 1) || substr(lower(hex(randomblob(2))), 2) || lower(hex(randomblob(6))),
    "id",
    'mi',
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
FROM "Routine"
WHERE "kind" = 'CARDIO';

PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

PRAGMA foreign_keys=OFF;

CREATE TABLE "new_SchedulePlan" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "cycleLengthDays" INTEGER NOT NULL DEFAULT 7,
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

INSERT INTO "new_SchedulePlan" ("id", "name", "cycleLengthDays", "isActive", "createdAt", "updatedAt")
SELECT "id", "name", ("cycleLengthWeeks" * 7), "isActive", "createdAt", "updatedAt"
FROM "SchedulePlan";

DROP TABLE "SchedulePlan";
ALTER TABLE "new_SchedulePlan" RENAME TO "SchedulePlan";

CREATE TABLE "new_ScheduleEntry" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "schedulePlanId" TEXT NOT NULL,
    "routineId" TEXT NOT NULL,
    "dayOffset" INTEGER NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ScheduleEntry_schedulePlanId_fkey" FOREIGN KEY ("schedulePlanId") REFERENCES "SchedulePlan" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ScheduleEntry_routineId_fkey" FOREIGN KEY ("routineId") REFERENCES "Routine" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

INSERT INTO "new_ScheduleEntry" ("id", "schedulePlanId", "routineId", "dayOffset", "sortOrder", "createdAt", "updatedAt")
SELECT "id", "schedulePlanId", "routineId", (("weekIndex" * 7) + "dayIndex"), "sortOrder", "createdAt", "updatedAt"
FROM "ScheduleEntry";

DROP TABLE "ScheduleEntry";
ALTER TABLE "new_ScheduleEntry" RENAME TO "ScheduleEntry";

CREATE TABLE "SchedulePlanActivation" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "schedulePlanId" TEXT NOT NULL,
    "isEnabled" BOOLEAN NOT NULL DEFAULT false,
    "startDate" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "SchedulePlanActivation_schedulePlanId_fkey" FOREIGN KEY ("schedulePlanId") REFERENCES "SchedulePlan" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "SchedulePlanActivation_schedulePlanId_key" ON "SchedulePlanActivation"("schedulePlanId");

CREATE TABLE "ScheduleManualEntry" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "routineId" TEXT NOT NULL,
    "scheduledDate" DATETIME NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ScheduleManualEntry_routineId_fkey" FOREIGN KEY ("routineId") REFERENCES "Routine" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "ScheduleEntry_schedulePlanId_dayOffset_sortOrder_idx" ON "ScheduleEntry"("schedulePlanId", "dayOffset", "sortOrder");
CREATE INDEX "ScheduleEntry_routineId_idx" ON "ScheduleEntry"("routineId");
CREATE INDEX "ScheduleManualEntry_scheduledDate_sortOrder_idx" ON "ScheduleManualEntry"("scheduledDate", "sortOrder");
CREATE INDEX "ScheduleManualEntry_routineId_idx" ON "ScheduleManualEntry"("routineId");

PRAGMA foreign_keys=ON;

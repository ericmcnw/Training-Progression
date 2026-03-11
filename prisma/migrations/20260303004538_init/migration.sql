-- CreateTable
CREATE TABLE "Run" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "performedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "distanceMi" REAL NOT NULL,
    "durationSec" INTEGER NOT NULL,
    "avgHr" INTEGER,
    "effort" TEXT,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "LiftSession" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "performedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "LiftSet" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sessionId" TEXT NOT NULL,
    "exercise" TEXT NOT NULL,
    "setIndex" INTEGER NOT NULL,
    "weightLb" REAL NOT NULL,
    "reps" INTEGER NOT NULL,
    CONSTRAINT "LiftSet_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "LiftSession" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Goal" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "type" TEXT NOT NULL,
    "targetValue" REAL NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

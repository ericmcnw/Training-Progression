-- CreateEnum
CREATE TYPE "Side" AS ENUM ('LEFT', 'RIGHT', 'BILATERAL', 'CENTRAL');

-- CreateEnum
CREATE TYPE "BodyView" AS ENUM ('FRONT', 'BACK', 'BOTH');

-- CreateEnum
CREATE TYPE "ActivitySource" AS ENUM ('EXERCISE', 'SPORT_TAG', 'MANUAL');

-- CreateEnum
CREATE TYPE "PainContext" AS ENUM ('AT_REST', 'DURING_ACTIVITY', 'AFTER_ACTIVITY', 'MORNING', 'GENERAL');

-- CreateEnum
CREATE TYPE "InjuryStatus" AS ENUM ('ACTIVE', 'RECOVERING', 'RESOLVED', 'FLARED');

-- CreateTable
CREATE TABLE "BodyZone" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "region" TEXT NOT NULL,
    "side" "Side" NOT NULL,
    "bodyView" "BodyView" NOT NULL,
    "metadataGroupSlug" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BodyZone_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ZoneActivity" (
    "id" TEXT NOT NULL,
    "zoneId" TEXT NOT NULL,
    "routineLogId" TEXT,
    "performedAt" TIMESTAMP(3) NOT NULL,
    "source" "ActivitySource" NOT NULL,
    "label" TEXT NOT NULL,
    "intensity" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ZoneActivity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PainLog" (
    "id" TEXT NOT NULL,
    "zoneId" TEXT NOT NULL,
    "level" INTEGER NOT NULL,
    "context" "PainContext" NOT NULL,
    "notes" TEXT,
    "loggedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "routineLogId" TEXT,

    CONSTRAINT "PainLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ActiveInjury" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "severity" INTEGER NOT NULL,
    "status" "InjuryStatus" NOT NULL DEFAULT 'ACTIVE',
    "startedAt" TIMESTAMP(3) NOT NULL,
    "resolvedAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ActiveInjury_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InjuryZone" (
    "id" TEXT NOT NULL,
    "injuryId" TEXT NOT NULL,
    "zoneId" TEXT NOT NULL,

    CONSTRAINT "InjuryZone_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "BodyZone_slug_key" ON "BodyZone"("slug");

-- CreateIndex
CREATE INDEX "ZoneActivity_zoneId_performedAt_idx" ON "ZoneActivity"("zoneId", "performedAt");

-- CreateIndex
CREATE INDEX "ZoneActivity_routineLogId_idx" ON "ZoneActivity"("routineLogId");

-- CreateIndex
CREATE INDEX "PainLog_zoneId_loggedAt_idx" ON "PainLog"("zoneId", "loggedAt");

-- CreateIndex
CREATE INDEX "PainLog_loggedAt_idx" ON "PainLog"("loggedAt");

-- CreateIndex
CREATE INDEX "ActiveInjury_status_idx" ON "ActiveInjury"("status");

-- CreateIndex
CREATE UNIQUE INDEX "InjuryZone_injuryId_zoneId_key" ON "InjuryZone"("injuryId", "zoneId");

-- AddForeignKey
ALTER TABLE "ZoneActivity" ADD CONSTRAINT "ZoneActivity_zoneId_fkey" FOREIGN KEY ("zoneId") REFERENCES "BodyZone"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ZoneActivity" ADD CONSTRAINT "ZoneActivity_routineLogId_fkey" FOREIGN KEY ("routineLogId") REFERENCES "RoutineLog"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PainLog" ADD CONSTRAINT "PainLog_zoneId_fkey" FOREIGN KEY ("zoneId") REFERENCES "BodyZone"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PainLog" ADD CONSTRAINT "PainLog_routineLogId_fkey" FOREIGN KEY ("routineLogId") REFERENCES "RoutineLog"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InjuryZone" ADD CONSTRAINT "InjuryZone_injuryId_fkey" FOREIGN KEY ("injuryId") REFERENCES "ActiveInjury"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InjuryZone" ADD CONSTRAINT "InjuryZone_zoneId_fkey" FOREIGN KEY ("zoneId") REFERENCES "BodyZone"("id") ON DELETE CASCADE ON UPDATE CASCADE;

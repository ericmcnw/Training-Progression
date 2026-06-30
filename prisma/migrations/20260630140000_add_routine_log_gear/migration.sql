-- RoutineLogGear: which gear was used on a log (for usage rollups on
-- snapshot-less logs like cardio + sport sessions).
CREATE TABLE "RoutineLogGear" (
    "routineLogId" TEXT NOT NULL,
    "gearId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RoutineLogGear_pkey" PRIMARY KEY ("routineLogId", "gearId")
);

CREATE INDEX "RoutineLogGear_gearId_idx" ON "RoutineLogGear"("gearId");

ALTER TABLE "RoutineLogGear" ADD CONSTRAINT "RoutineLogGear_routineLogId_fkey"
    FOREIGN KEY ("routineLogId") REFERENCES "RoutineLog"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "RoutineLogGear" ADD CONSTRAINT "RoutineLogGear_gearId_fkey"
    FOREIGN KEY ("gearId") REFERENCES "Gear"("id") ON DELETE CASCADE ON UPDATE CASCADE;

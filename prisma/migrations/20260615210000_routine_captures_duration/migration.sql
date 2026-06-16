-- Opt-in for COMPLETION routines that want to capture an optional duration
-- per session (cold plunge, sauna, massage, foam rolling, active recovery).
-- Additive boolean — every existing routine defaults to false.
ALTER TABLE "Routine" ADD COLUMN "capturesDuration" BOOLEAN NOT NULL DEFAULT false;

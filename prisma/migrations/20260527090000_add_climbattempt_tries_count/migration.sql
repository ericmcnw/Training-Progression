-- Add optional "tries" counter to ClimbAttempt. Used for SEND/REDPOINT
-- (how many tries to send) and PROJECT (how many tries so far). Nullable
-- because most existing rows pre-date this field and Flash/Onsight are
-- implicitly 1.

-- AlterTable
ALTER TABLE "ClimbAttempt" ADD COLUMN "triesCount" INTEGER;

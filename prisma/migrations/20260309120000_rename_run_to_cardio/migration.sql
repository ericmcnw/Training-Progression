-- Rename existing routine kind values from RUN to CARDIO.
-- SQLite stores Prisma enums as TEXT, so this is a data migration.
UPDATE "Routine"
SET "kind" = 'CARDIO'
WHERE "kind" = 'RUN';

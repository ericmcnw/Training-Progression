-- Exercise names were unique across every account, so one person's private
-- exercise blocked the name for everyone else. Uniqueness is now per owner:
-- once within the shared catalog, and once within each profile's private set.
DROP INDEX "Exercise_name_key";

CREATE UNIQUE INDEX "Exercise_catalog_name_key" ON "Exercise"("name") WHERE "profileKey" IS NULL;

CREATE UNIQUE INDEX "Exercise_profile_name_key" ON "Exercise"("profileKey", "name") WHERE "profileKey" IS NOT NULL;

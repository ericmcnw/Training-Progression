ALTER TABLE "AppProfile" ADD COLUMN "managedByKey" TEXT;

CREATE INDEX "AppProfile_managedByKey_idx" ON "AppProfile"("managedByKey");

-- The two accounts that exist besides the owner's are his clients.
UPDATE "AppProfile" SET "managedByKey" = 'default'
WHERE "key" IN ('user:5c6b0e56-dfe2-4e34-8bce-f8e66edbe9ba', 'test:onboarding');

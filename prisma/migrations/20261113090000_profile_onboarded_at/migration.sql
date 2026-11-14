ALTER TABLE "AppProfile" ADD COLUMN "onboardedAt" TIMESTAMP(3);

-- Every profile that exists today was set up by hand.
UPDATE "AppProfile" SET "onboardedAt" = "createdAt";

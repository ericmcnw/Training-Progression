-- Additive: lightweight profile identity. All nullable, no data touched.
ALTER TABLE "AppProfile" ADD COLUMN "displayName" TEXT;
ALTER TABLE "AppProfile" ADD COLUMN "avatarEmoji" TEXT;
ALTER TABLE "AppProfile" ADD COLUMN "avatarColor" TEXT;

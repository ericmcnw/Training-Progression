-- Photos + external link records for climbing. Attaches to a ClimbLocation
-- OR a ClimbProblem (XOR enforced in app code, not SQL — the constraint is
-- noisy in Prisma migrations and we trust the server actions).

-- CreateEnum
CREATE TYPE "ClimbMediaKind" AS ENUM ('PHOTO', 'LINK');

-- CreateTable
CREATE TABLE "ClimbMedia" (
    "id" TEXT NOT NULL,
    "kind" "ClimbMediaKind" NOT NULL,
    "url" TEXT NOT NULL,
    "thumbnailUrl" TEXT,
    "caption" TEXT,
    "width" INTEGER,
    "height" INTEGER,
    "sizeBytes" INTEGER,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "locationId" TEXT,
    "problemId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ClimbMedia_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ClimbMedia_locationId_sortOrder_idx" ON "ClimbMedia"("locationId", "sortOrder");

-- CreateIndex
CREATE INDEX "ClimbMedia_problemId_sortOrder_idx" ON "ClimbMedia"("problemId", "sortOrder");

-- AddForeignKey
ALTER TABLE "ClimbMedia" ADD CONSTRAINT "ClimbMedia_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "ClimbLocation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClimbMedia" ADD CONSTRAINT "ClimbMedia_problemId_fkey" FOREIGN KEY ("problemId") REFERENCES "ClimbProblem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Enable RLS on the new table. Without policies this means deny-all for the
-- Supabase `anon` role; Prisma uses the postgres superuser and bypasses RLS,
-- so server-side queries continue working. Required because the publishable
-- key in NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY exposes PostgREST to the
-- browser (see 20260520120000_enable_rls_on_public_tables for context).
ALTER TABLE "ClimbMedia" ENABLE ROW LEVEL SECURITY;

-- CreateTable
CREATE TABLE "CoachThread" (
    "id" TEXT NOT NULL,
    "title" TEXT,
    "summary" TEXT,
    "summarizedCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CoachThread_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CoachMessage" (
    "id" TEXT NOT NULL,
    "threadId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CoachMessage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CoachThread_updatedAt_idx" ON "CoachThread"("updatedAt");

-- CreateIndex
CREATE INDEX "CoachMessage_threadId_createdAt_idx" ON "CoachMessage"("threadId", "createdAt");

-- AddForeignKey
ALTER TABLE "CoachMessage" ADD CONSTRAINT "CoachMessage_threadId_fkey" FOREIGN KEY ("threadId") REFERENCES "CoachThread"("id") ON DELETE CASCADE ON UPDATE CASCADE;

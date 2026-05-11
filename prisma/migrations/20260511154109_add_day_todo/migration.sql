-- CreateTable
CREATE TABLE "DayTodo" (
    "id" TEXT NOT NULL,
    "ymd" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "done" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DayTodo_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DayTodo_ymd_done_idx" ON "DayTodo"("ymd", "done");

-- CreateIndex
CREATE INDEX "DayTodo_done_ymd_idx" ON "DayTodo"("done", "ymd");

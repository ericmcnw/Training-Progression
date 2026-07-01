-- GearList / GearListItem: reusable gear collections (loadouts + checklists).
-- The list is a template; a log's gear snapshot is the per-trip instance, so
-- applying a list copies its items into the picker and never mutates the list.
CREATE TABLE "GearList" (
    "id" TEXT NOT NULL,
    "profileKey" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "activitySlug" TEXT,
    "notes" TEXT,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GearList_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "GearList_profileKey_isDeleted_idx" ON "GearList"("profileKey", "isDeleted");

CREATE TABLE "GearListItem" (
    "id" TEXT NOT NULL,
    "listId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "gearId" TEXT,
    "weightGramsOverride" INTEGER,
    "consumable" BOOLEAN NOT NULL DEFAULT false,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "checked" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "GearListItem_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "GearListItem_listId_idx" ON "GearListItem"("listId");
CREATE INDEX "GearListItem_gearId_idx" ON "GearListItem"("gearId");

ALTER TABLE "GearListItem" ADD CONSTRAINT "GearListItem_listId_fkey"
    FOREIGN KEY ("listId") REFERENCES "GearList"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "GearListItem" ADD CONSTRAINT "GearListItem_gearId_fkey"
    FOREIGN KEY ("gearId") REFERENCES "Gear"("id") ON DELETE SET NULL ON UPDATE CASCADE;

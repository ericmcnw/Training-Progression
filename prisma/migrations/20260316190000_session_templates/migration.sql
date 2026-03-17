ALTER TYPE "GoalTargetType" ADD VALUE IF NOT EXISTS 'SESSION_TEMPLATE';
ALTER TYPE "GoalMetricType" ADD VALUE IF NOT EXISTS 'SESSION_METRIC';

CREATE TYPE "SessionMetricValueType" AS ENUM ('INTEGER', 'DECIMAL', 'TEXT', 'BOOLEAN');

CREATE TABLE "SessionTemplate" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "sessionSubtype" TEXT,
    "isSystem" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SessionTemplate_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SessionMetricDefinition" (
    "id" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "valueType" "SessionMetricValueType" NOT NULL,
    "unit" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isRequired" BOOLEAN NOT NULL DEFAULT false,
    "showInProgress" BOOLEAN NOT NULL DEFAULT false,
    "showInGoals" BOOLEAN NOT NULL DEFAULT false,
    "config" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SessionMetricDefinition_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SessionLogMetricValue" (
    "id" TEXT NOT NULL,
    "routineLogId" TEXT NOT NULL,
    "metricDefinitionId" TEXT NOT NULL,
    "numberValue" DOUBLE PRECISION,
    "textValue" TEXT,
    "booleanValue" BOOLEAN,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SessionLogMetricValue_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SessionTemplateMetadataGroup" (
    "templateId" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SessionTemplateMetadataGroup_pkey" PRIMARY KEY ("templateId","groupId")
);

ALTER TABLE "SessionRoutineDetails" ADD COLUMN "templateId" TEXT;

CREATE UNIQUE INDEX "SessionTemplate_key_key" ON "SessionTemplate"("key");
CREATE INDEX "SessionTemplate_sortOrder_name_idx" ON "SessionTemplate"("sortOrder", "name");
CREATE INDEX "SessionTemplate_sessionSubtype_idx" ON "SessionTemplate"("sessionSubtype");

CREATE UNIQUE INDEX "SessionMetricDefinition_templateId_key_key" ON "SessionMetricDefinition"("templateId", "key");
CREATE INDEX "SessionMetricDefinition_templateId_sortOrder_idx" ON "SessionMetricDefinition"("templateId", "sortOrder");

CREATE UNIQUE INDEX "SessionLogMetricValue_routineLogId_metricDefinitionId_key" ON "SessionLogMetricValue"("routineLogId", "metricDefinitionId");
CREATE INDEX "SessionLogMetricValue_metricDefinitionId_idx" ON "SessionLogMetricValue"("metricDefinitionId");
CREATE INDEX "SessionTemplateMetadataGroup_groupId_idx" ON "SessionTemplateMetadataGroup"("groupId");
CREATE INDEX "SessionRoutineDetails_templateId_idx" ON "SessionRoutineDetails"("templateId");

ALTER TABLE "SessionRoutineDetails"
    ADD CONSTRAINT "SessionRoutineDetails_templateId_fkey"
    FOREIGN KEY ("templateId") REFERENCES "SessionTemplate"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "SessionMetricDefinition"
    ADD CONSTRAINT "SessionMetricDefinition_templateId_fkey"
    FOREIGN KEY ("templateId") REFERENCES "SessionTemplate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "SessionLogMetricValue"
    ADD CONSTRAINT "SessionLogMetricValue_routineLogId_fkey"
    FOREIGN KEY ("routineLogId") REFERENCES "RoutineLog"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "SessionLogMetricValue"
    ADD CONSTRAINT "SessionLogMetricValue_metricDefinitionId_fkey"
    FOREIGN KEY ("metricDefinitionId") REFERENCES "SessionMetricDefinition"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "SessionTemplateMetadataGroup"
    ADD CONSTRAINT "SessionTemplateMetadataGroup_templateId_fkey"
    FOREIGN KEY ("templateId") REFERENCES "SessionTemplate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "SessionTemplateMetadataGroup"
    ADD CONSTRAINT "SessionTemplateMetadataGroup_groupId_fkey"
    FOREIGN KEY ("groupId") REFERENCES "MetadataGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;

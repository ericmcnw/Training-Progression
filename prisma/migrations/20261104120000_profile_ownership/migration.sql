-- DropIndex
DROP INDEX "RoutineTag_name_key";

-- DropIndex
DROP INDEX "UserActivityTypePreference_activityTypeId_key";

-- AlterTable
ALTER TABLE "ActiveInjury" ADD COLUMN     "profileKey" TEXT NOT NULL DEFAULT 'default';

-- AlterTable
ALTER TABLE "ActivitySpot" ADD COLUMN     "profileKey" TEXT NOT NULL DEFAULT 'default';

-- AlterTable
ALTER TABLE "AppProfile" ADD COLUMN     "authUserId" TEXT,
ADD COLUMN     "email" TEXT;

-- AlterTable
ALTER TABLE "ClimbLocation" ADD COLUMN     "profileKey" TEXT NOT NULL DEFAULT 'default';

-- AlterTable
ALTER TABLE "ClimbMedia" ADD COLUMN     "profileKey" TEXT NOT NULL DEFAULT 'default';

-- AlterTable
ALTER TABLE "ClimbProblem" ADD COLUMN     "profileKey" TEXT NOT NULL DEFAULT 'default';

-- AlterTable
ALTER TABLE "CoachThread" ADD COLUMN     "profileKey" TEXT NOT NULL DEFAULT 'default';

-- AlterTable
ALTER TABLE "DayTodo" ADD COLUMN     "profileKey" TEXT NOT NULL DEFAULT 'default';

-- AlterTable
ALTER TABLE "Exercise" ADD COLUMN     "profileKey" TEXT;

-- AlterTable
ALTER TABLE "FrequencyGoal" ADD COLUMN     "profileKey" TEXT NOT NULL DEFAULT 'default';

-- AlterTable
ALTER TABLE "Goal" ADD COLUMN     "profileKey" TEXT NOT NULL DEFAULT 'default';

-- AlterTable
ALTER TABLE "GoalMilestone" ADD COLUMN     "profileKey" TEXT NOT NULL DEFAULT 'default';

-- AlterTable
ALTER TABLE "PainLog" ADD COLUMN     "profileKey" TEXT NOT NULL DEFAULT 'default';

-- AlterTable
ALTER TABLE "ProgressionMilestone" ADD COLUMN     "profileKey" TEXT NOT NULL DEFAULT 'default';

-- AlterTable
ALTER TABLE "Rotation" ADD COLUMN     "profileKey" TEXT NOT NULL DEFAULT 'default';

-- AlterTable
ALTER TABLE "Routine" ADD COLUMN     "profileKey" TEXT NOT NULL DEFAULT 'default';

-- AlterTable
ALTER TABLE "RoutineLog" ADD COLUMN     "profileKey" TEXT NOT NULL DEFAULT 'default';

-- AlterTable
ALTER TABLE "RoutineTag" ADD COLUMN     "profileKey" TEXT NOT NULL DEFAULT 'default';

-- AlterTable
ALTER TABLE "ScheduleManualEntry" ADD COLUMN     "profileKey" TEXT NOT NULL DEFAULT 'default';

-- AlterTable
ALTER TABLE "SchedulePlan" ADD COLUMN     "profileKey" TEXT NOT NULL DEFAULT 'default';

-- AlterTable
ALTER TABLE "UserActivityTypePreference" ADD COLUMN     "profileKey" TEXT NOT NULL DEFAULT 'default';

-- AlterTable
ALTER TABLE "ZoneActivity" ADD COLUMN     "profileKey" TEXT NOT NULL DEFAULT 'default';

-- CreateIndex
CREATE INDEX "ActiveInjury_profileKey_idx" ON "ActiveInjury"("profileKey");

-- CreateIndex
CREATE INDEX "ActivitySpot_profileKey_idx" ON "ActivitySpot"("profileKey");

-- CreateIndex
CREATE UNIQUE INDEX "AppProfile_email_key" ON "AppProfile"("email");

-- CreateIndex
CREATE UNIQUE INDEX "AppProfile_authUserId_key" ON "AppProfile"("authUserId");

-- CreateIndex
CREATE INDEX "ClimbLocation_profileKey_idx" ON "ClimbLocation"("profileKey");

-- CreateIndex
CREATE INDEX "ClimbMedia_profileKey_idx" ON "ClimbMedia"("profileKey");

-- CreateIndex
CREATE INDEX "ClimbProblem_profileKey_idx" ON "ClimbProblem"("profileKey");

-- CreateIndex
CREATE INDEX "CoachThread_profileKey_idx" ON "CoachThread"("profileKey");

-- CreateIndex
CREATE INDEX "DayTodo_profileKey_idx" ON "DayTodo"("profileKey");

-- CreateIndex
CREATE INDEX "Exercise_profileKey_idx" ON "Exercise"("profileKey");

-- CreateIndex
CREATE INDEX "FrequencyGoal_profileKey_idx" ON "FrequencyGoal"("profileKey");

-- CreateIndex
CREATE INDEX "Goal_profileKey_idx" ON "Goal"("profileKey");

-- CreateIndex
CREATE INDEX "GoalMilestone_profileKey_idx" ON "GoalMilestone"("profileKey");

-- CreateIndex
CREATE INDEX "PainLog_profileKey_idx" ON "PainLog"("profileKey");

-- CreateIndex
CREATE INDEX "ProgressionMilestone_profileKey_idx" ON "ProgressionMilestone"("profileKey");

-- CreateIndex
CREATE INDEX "Rotation_profileKey_idx" ON "Rotation"("profileKey");

-- CreateIndex
CREATE INDEX "Routine_profileKey_idx" ON "Routine"("profileKey");

-- CreateIndex
CREATE INDEX "RoutineLog_profileKey_idx" ON "RoutineLog"("profileKey");

-- CreateIndex
CREATE INDEX "RoutineTag_profileKey_idx" ON "RoutineTag"("profileKey");

-- CreateIndex
CREATE UNIQUE INDEX "RoutineTag_profileKey_name_key" ON "RoutineTag"("profileKey", "name");

-- CreateIndex
CREATE INDEX "ScheduleManualEntry_profileKey_idx" ON "ScheduleManualEntry"("profileKey");

-- CreateIndex
CREATE INDEX "SchedulePlan_profileKey_idx" ON "SchedulePlan"("profileKey");

-- CreateIndex
CREATE INDEX "UserActivityTypePreference_activityTypeId_idx" ON "UserActivityTypePreference"("activityTypeId");

-- CreateIndex
CREATE INDEX "UserActivityTypePreference_profileKey_idx" ON "UserActivityTypePreference"("profileKey");

-- CreateIndex
CREATE UNIQUE INDEX "UserActivityTypePreference_profileKey_activityTypeId_key" ON "UserActivityTypePreference"("profileKey", "activityTypeId");

-- CreateIndex
CREATE INDEX "ZoneActivity_profileKey_idx" ON "ZoneActivity"("profileKey");


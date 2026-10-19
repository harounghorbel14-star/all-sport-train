-- AlterTable
ALTER TABLE "WorkoutPlan" ADD COLUMN "dailyKey" TEXT;

-- AlterTable
ALTER TABLE "WorkoutSession" ADD COLUMN "activeKey" TEXT;

-- Backfill: the newest live (active/paused) session per user holds the key. Older duplicates, if any,
-- keep NULL so the unique index can be created; they still end normally (complete/abandon).
UPDATE "WorkoutSession" SET "activeKey" = "userId"
WHERE "status" IN ('active', 'paused')
  AND "id" = (
    SELECT s2."id" FROM "WorkoutSession" s2
    WHERE s2."userId" = "WorkoutSession"."userId" AND s2."status" IN ('active', 'paused')
    ORDER BY s2."startedAt" DESC, s2."id" DESC LIMIT 1
  );

-- CreateIndex
CREATE UNIQUE INDEX "WorkoutPlan_dailyKey_key" ON "WorkoutPlan"("dailyKey");

-- CreateIndex
CREATE UNIQUE INDEX "WorkoutSession_activeKey_key" ON "WorkoutSession"("activeKey");


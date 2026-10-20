-- CreateTable
CREATE TABLE "Goal" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "exerciseSlug" TEXT,
    "metric" TEXT,
    "sportSlug" TEXT,
    "metricKey" TEXT,
    "lessonSlug" TEXT,
    "direction" TEXT NOT NULL DEFAULT 'higher',
    "baseline" REAL,
    "baselineSource" TEXT,
    "baselineDate" TEXT,
    "target" REAL NOT NULL,
    "periodWeeks" INTEGER,
    "targetDate" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "achievedAt" DATETIME,
    "note" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Goal_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "Goal_userId_status_idx" ON "Goal"("userId", "status");


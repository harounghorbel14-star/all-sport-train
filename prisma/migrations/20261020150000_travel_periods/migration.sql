-- CreateTable
CREATE TABLE "TravelPeriod" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "startDate" TEXT NOT NULL,
    "endDate" TEXT NOT NULL,
    "equipment" TEXT NOT NULL DEFAULT '[]',
    "location" TEXT NOT NULL DEFAULT 'mixed',
    "sessionMinutes" INTEGER,
    "note" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "adapted" TEXT NOT NULL DEFAULT '[]',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "TravelPeriod_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "TravelPeriod_userId_status_startDate_idx" ON "TravelPeriod"("userId", "status", "startDate");


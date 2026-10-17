-- AlterTable
ALTER TABLE "ContentSource" ADD COLUMN "accessedAt" DATETIME;
ALTER TABLE "ContentSource" ADD COLUMN "accessedBy" TEXT;
ALTER TABLE "ContentSource" ADD COLUMN "checkStatus" TEXT;
ALTER TABLE "ContentSource" ADD COLUMN "contentHash" TEXT;
ALTER TABLE "ContentSource" ADD COLUMN "edition" TEXT;
ALTER TABLE "ContentSource" ADD COLUMN "lastCheckedAt" DATETIME;

-- CreateTable
CREATE TABLE "KnowledgeClaim" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sportId" TEXT,
    "topic" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "level" TEXT NOT NULL DEFAULT 'all',
    "statement" TEXT NOT NULL,
    "sourceRefs" TEXT NOT NULL DEFAULT '[]',
    "confidence" TEXT NOT NULL DEFAULT 'low',
    "status" TEXT NOT NULL DEFAULT 'unverified',
    "evidence" TEXT NOT NULL DEFAULT 'snippet',
    "origin" TEXT NOT NULL DEFAULT 'research',
    "note" TEXT,
    "reviewedAt" DATETIME,
    "reviewedBy" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "KnowledgeClaim_sportId_fkey" FOREIGN KEY ("sportId") REFERENCES "Sport" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ResearchTask" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sportId" TEXT,
    "kind" TEXT NOT NULL,
    "topic" TEXT NOT NULL,
    "detail" TEXT,
    "status" TEXT NOT NULL DEFAULT 'queued',
    "priority" INTEGER NOT NULL DEFAULT 2,
    "result" TEXT,
    "lastRunAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ResearchTask_sportId_fkey" FOREIGN KEY ("sportId") REFERENCES "Sport" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "RulesetVersion" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "rulesetId" TEXT NOT NULL,
    "snapshot" TEXT NOT NULL,
    "reason" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "RulesetVersion_rulesetId_fkey" FOREIGN KEY ("rulesetId") REFERENCES "Ruleset" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Ruleset" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sportId" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "governingBody" TEXT NOT NULL,
    "scope" TEXT NOT NULL,
    "editionNote" TEXT NOT NULL,
    "points" TEXT NOT NULL,
    "verification" TEXT NOT NULL DEFAULT 'general',
    "sources" TEXT NOT NULL DEFAULT '[]',
    "contentStatus" TEXT NOT NULL DEFAULT 'published',
    "reviewedAt" DATETIME,
    "reviewFlag" TEXT,
    "flaggedAt" DATETIME,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Ruleset_sportId_fkey" FOREIGN KEY ("sportId") REFERENCES "Sport" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Ruleset" ("contentStatus", "editionNote", "governingBody", "id", "name", "points", "reviewedAt", "scope", "slug", "sources", "sportId", "updatedAt", "verification") SELECT "contentStatus", "editionNote", "governingBody", "id", "name", "points", "reviewedAt", "scope", "slug", "sources", "sportId", "updatedAt", "verification" FROM "Ruleset";
DROP TABLE "Ruleset";
ALTER TABLE "new_Ruleset" RENAME TO "Ruleset";
CREATE UNIQUE INDEX "Ruleset_sportId_slug_key" ON "Ruleset"("sportId", "slug");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "KnowledgeClaim_sportId_status_idx" ON "KnowledgeClaim"("sportId", "status");

-- CreateIndex
CREATE INDEX "KnowledgeClaim_status_category_idx" ON "KnowledgeClaim"("status", "category");

-- CreateIndex
CREATE INDEX "ResearchTask_status_priority_idx" ON "ResearchTask"("status", "priority");

-- CreateIndex
CREATE INDEX "ResearchTask_sportId_status_idx" ON "ResearchTask"("sportId", "status");

-- CreateIndex
CREATE INDEX "RulesetVersion_rulesetId_createdAt_idx" ON "RulesetVersion"("rulesetId", "createdAt");

-- Seeded rules summaries were written from general knowledge and have not been checked against
-- the current rulebooks, so none may claim "checked against source" until a reviewer verifies it.
UPDATE "Ruleset" SET "verification" = 'general' WHERE "verification" = 'summary';

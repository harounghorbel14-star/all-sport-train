-- CreateTable
CREATE TABLE "SportCategory" (
    "slug" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0
);

-- CreateTable
CREATE TABLE "Sport" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "categorySlug" TEXT NOT NULL,
    "parentSlug" TEXT,
    "summary" TEXT NOT NULL,
    "aliases" TEXT NOT NULL DEFAULT '[]',
    "availability" TEXT NOT NULL DEFAULT 'basic',
    "contentStatus" TEXT NOT NULL DEFAULT 'published',
    "metLight" REAL NOT NULL,
    "metModerate" REAL NOT NULL,
    "metVigorous" REAL NOT NULL,
    "distanceUnit" TEXT,
    "workoutBased" BOOLEAN NOT NULL DEFAULT false,
    "profile" TEXT NOT NULL DEFAULT '{}',
    "isCustom" BOOLEAN NOT NULL DEFAULT false,
    "reviewedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "SportMetric" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sportId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "unit" TEXT,
    "kind" TEXT NOT NULL,
    "scope" TEXT NOT NULL,
    "direction" TEXT NOT NULL DEFAULT 'higher',
    "options" TEXT NOT NULL DEFAULT '[]',
    "min" REAL,
    "max" REAL,
    "minAttempts" INTEGER,
    "description" TEXT,
    "measurement" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "SportMetric_sportId_fkey" FOREIGN KEY ("sportId") REFERENCES "Sport" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ContentSource" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "publisher" TEXT NOT NULL,
    "url" TEXT,
    "kind" TEXT NOT NULL,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "Ruleset" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sportId" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "governingBody" TEXT NOT NULL,
    "scope" TEXT NOT NULL,
    "editionNote" TEXT NOT NULL,
    "points" TEXT NOT NULL,
    "verification" TEXT NOT NULL DEFAULT 'summary',
    "sources" TEXT NOT NULL DEFAULT '[]',
    "contentStatus" TEXT NOT NULL DEFAULT 'published',
    "reviewedAt" DATETIME,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Ruleset_sportId_fkey" FOREIGN KEY ("sportId") REFERENCES "Sport" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Lesson" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sportId" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "level" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "summary" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "prerequisites" TEXT NOT NULL DEFAULT '[]',
    "drillSlugs" TEXT NOT NULL DEFAULT '[]',
    "requiresSupervision" BOOLEAN NOT NULL DEFAULT false,
    "sources" TEXT NOT NULL DEFAULT '[]',
    "contentStatus" TEXT NOT NULL DEFAULT 'published',
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Lesson_sportId_fkey" FOREIGN KEY ("sportId") REFERENCES "Sport" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Drill" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sportId" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "purpose" TEXT NOT NULL,
    "level" TEXT NOT NULL,
    "focus" TEXT NOT NULL,
    "durationMin" INTEGER NOT NULL,
    "setting" TEXT NOT NULL,
    "minPlayers" INTEGER NOT NULL DEFAULT 1,
    "equipment" TEXT NOT NULL DEFAULT '[]',
    "contact" TEXT NOT NULL DEFAULT 'none',
    "requiresSupervision" BOOLEAN NOT NULL DEFAULT false,
    "metricKey" TEXT,
    "content" TEXT NOT NULL,
    "contentStatus" TEXT NOT NULL DEFAULT 'published',
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Drill_sportId_fkey" FOREIGN KEY ("sportId") REFERENCES "Sport" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "UserSport" (
    "userId" TEXT NOT NULL,
    "sportId" TEXT NOT NULL,
    "level" TEXT NOT NULL DEFAULT 'beginner',
    "goals" TEXT NOT NULL DEFAULT '[]',
    "position" TEXT,
    "supervised" BOOLEAN NOT NULL DEFAULT false,
    "startedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY ("userId", "sportId"),
    CONSTRAINT "UserSport_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "UserSport_sportId_fkey" FOREIGN KEY ("sportId") REFERENCES "Sport" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "LessonProgress" (
    "userId" TEXT NOT NULL,
    "lessonId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "completedAt" DATETIME,
    "updatedAt" DATETIME NOT NULL,

    PRIMARY KEY ("userId", "lessonId"),
    CONSTRAINT "LessonProgress_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "LessonProgress_lessonId_fkey" FOREIGN KEY ("lessonId") REFERENCES "Lesson" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PracticePlan" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "sportId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "focus" TEXT NOT NULL,
    "minutes" INTEGER NOT NULL,
    "content" TEXT NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'engine',
    "status" TEXT NOT NULL DEFAULT 'planned',
    "activityId" TEXT,
    "rpe" INTEGER,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" DATETIME,
    CONSTRAINT "PracticePlan_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "PracticePlan_sportId_fkey" FOREIGN KEY ("sportId") REFERENCES "Sport" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SportMetricEntry" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "sportId" TEXT NOT NULL,
    "metricKey" TEXT NOT NULL,
    "value" REAL NOT NULL,
    "made" INTEGER,
    "attempts" INTEGER,
    "dateKey" TEXT NOT NULL,
    "context" TEXT NOT NULL DEFAULT 'practice',
    "practicePlanId" TEXT,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SportMetricEntry_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "SportMetricEntry_sportId_fkey" FOREIGN KEY ("sportId") REFERENCES "Sport" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "Sport_slug_key" ON "Sport"("slug");

-- CreateIndex
CREATE INDEX "Sport_categorySlug_idx" ON "Sport"("categorySlug");

-- CreateIndex
CREATE INDEX "Sport_parentSlug_idx" ON "Sport"("parentSlug");

-- CreateIndex
CREATE UNIQUE INDEX "SportMetric_sportId_key_key" ON "SportMetric"("sportId", "key");

-- CreateIndex
CREATE UNIQUE INDEX "ContentSource_slug_key" ON "ContentSource"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "Ruleset_sportId_slug_key" ON "Ruleset"("sportId", "slug");

-- CreateIndex
CREATE UNIQUE INDEX "Lesson_sportId_slug_key" ON "Lesson"("sportId", "slug");

-- CreateIndex
CREATE UNIQUE INDEX "Drill_sportId_slug_key" ON "Drill"("sportId", "slug");

-- CreateIndex
CREATE INDEX "PracticePlan_userId_sportId_createdAt_idx" ON "PracticePlan"("userId", "sportId", "createdAt");

-- CreateIndex
CREATE INDEX "SportMetricEntry_userId_sportId_metricKey_dateKey_idx" ON "SportMetricEntry"("userId", "sportId", "metricKey", "dateKey");

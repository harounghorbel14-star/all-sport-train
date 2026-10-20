-- CreateTable
CREATE TABLE "LessonQuiz" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "lessonId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "contentStatus" TEXT NOT NULL DEFAULT 'published',
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "LessonQuiz_lessonId_fkey" FOREIGN KEY ("lessonId") REFERENCES "Lesson" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "QuizAttempt" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "quizId" TEXT NOT NULL,
    "quizVersion" INTEGER NOT NULL,
    "questions" TEXT NOT NULL,
    "answers" TEXT,
    "correct" INTEGER,
    "total" INTEGER NOT NULL,
    "passed" BOOLEAN,
    "status" TEXT NOT NULL DEFAULT 'open',
    "openKey" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "submittedAt" DATETIME,
    CONSTRAINT "QuizAttempt_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "QuizAttempt_quizId_fkey" FOREIGN KEY ("quizId") REFERENCES "LessonQuiz" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "LessonQuiz_lessonId_key" ON "LessonQuiz"("lessonId");

-- CreateIndex
CREATE UNIQUE INDEX "QuizAttempt_openKey_key" ON "QuizAttempt"("openKey");

-- CreateIndex
CREATE INDEX "QuizAttempt_userId_quizId_idx" ON "QuizAttempt"("userId", "quizId");


-- CreateTable
CREATE TABLE "QuestionLike" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "audienceQuestionId" TEXT NOT NULL,
    "audienceSessionId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "QuestionLike_audienceQuestionId_fkey" FOREIGN KEY ("audienceQuestionId") REFERENCES "AudienceQuestion" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "QuestionLike_audienceSessionId_fkey" FOREIGN KEY ("audienceSessionId") REFERENCES "AudienceSession" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "QuestionLike_audienceQuestionId_audienceSessionId_key" ON "QuestionLike"("audienceQuestionId", "audienceSessionId");

-- CreateIndex
CREATE INDEX "QuestionLike_audienceQuestionId_idx" ON "QuestionLike"("audienceQuestionId");

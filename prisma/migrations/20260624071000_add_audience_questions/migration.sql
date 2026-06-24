-- CreateTable
CREATE TABLE "AudienceQuestion" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "activityId" TEXT NOT NULL,
    "audienceSessionId" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "isPinned" BOOLEAN NOT NULL DEFAULT false,
    "isAnswered" BOOLEAN NOT NULL DEFAULT false,
    "isHidden" BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT "AudienceQuestion_activityId_fkey" FOREIGN KEY ("activityId") REFERENCES "Activity" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "AudienceQuestion_audienceSessionId_fkey" FOREIGN KEY ("audienceSessionId") REFERENCES "AudienceSession" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "AudienceQuestion_activityId_isHidden_isAnswered_createdAt_idx" ON "AudienceQuestion"("activityId", "isHidden", "isAnswered", "createdAt");

ALTER TABLE "GroupMember" ADD COLUMN "displayName" TEXT;

CREATE TABLE "SessionMutation" (
  "id" TEXT NOT NULL,
  "sessionId" TEXT NOT NULL,
  "mutationId" TEXT NOT NULL,
  "revision" INTEGER NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SessionMutation_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "SessionMutation_sessionId_fkey"
    FOREIGN KEY ("sessionId") REFERENCES "Session"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "SessionMutation_sessionId_mutationId_key"
  ON "SessionMutation"("sessionId", "mutationId");

CREATE INDEX "SessionMutation_sessionId_createdAt_idx"
  ON "SessionMutation"("sessionId", "createdAt");

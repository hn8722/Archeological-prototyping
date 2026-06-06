CREATE TABLE "WorkshopParticipant" (
  "id" TEXT NOT NULL,
  "sessionId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "tokenHash" TEXT NOT NULL,
  "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lastSeenAt" TIMESTAMP(3),

  CONSTRAINT "WorkshopParticipant_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "WorkshopParticipant_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "Session"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "WorkshopParticipant_tokenHash_key" ON "WorkshopParticipant"("tokenHash");
CREATE INDEX "WorkshopParticipant_sessionId_idx" ON "WorkshopParticipant"("sessionId");
CREATE INDEX "WorkshopParticipant_joinedAt_idx" ON "WorkshopParticipant"("joinedAt");

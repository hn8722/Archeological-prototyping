CREATE TABLE "EditLock" (
  "id" TEXT NOT NULL,
  "sessionId" TEXT NOT NULL,
  "generation" INTEGER NOT NULL,
  "kind" TEXT NOT NULL,
  "entryId" TEXT NOT NULL,
  "entryIndex" INTEGER NOT NULL,
  "ownerId" TEXT NOT NULL,
  "ownerLabel" TEXT,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "EditLock_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "EditLock_sessionId_generation_kind_entryId_entryIndex_key"
  ON "EditLock"("sessionId", "generation", "kind", "entryId", "entryIndex");

CREATE INDEX "EditLock_ownerId_idx" ON "EditLock"("ownerId");
CREATE INDEX "EditLock_expiresAt_idx" ON "EditLock"("expiresAt");

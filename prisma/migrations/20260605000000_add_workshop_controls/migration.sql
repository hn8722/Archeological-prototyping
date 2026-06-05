ALTER TABLE "Session"
ADD COLUMN "workshopCode" TEXT,
ADD COLUMN "workshopStatus" TEXT NOT NULL DEFAULT 'draft',
ADD COLUMN "workshopAllowReadAfterClose" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN "workshopAllowAi" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN "workshopClosedAt" TIMESTAMP(3);

CREATE UNIQUE INDEX "Session_workshopCode_key" ON "Session"("workshopCode");
CREATE INDEX "Session_workshopCode_idx" ON "Session"("workshopCode");
CREATE INDEX "Session_workshopStatus_idx" ON "Session"("workshopStatus");

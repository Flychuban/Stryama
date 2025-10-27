-- AlterTable
ALTER TABLE "public"."AIGeneration" ADD COLUMN     "sessionId" TEXT,
ADD COLUMN     "totalCost" DOUBLE PRECISION;

-- CreateIndex
CREATE INDEX "AIGeneration_sessionId_idx" ON "public"."AIGeneration"("sessionId");

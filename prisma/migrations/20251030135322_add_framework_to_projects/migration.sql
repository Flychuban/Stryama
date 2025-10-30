-- CreateEnum
CREATE TYPE "public"."Framework" AS ENUM ('REACT', 'NEXTJS', 'VUE', 'VANILLA');

-- AlterTable
ALTER TABLE "public"."Project" ADD COLUMN     "framework" "public"."Framework" NOT NULL DEFAULT 'REACT';

-- AlterTable
ALTER TABLE "public"."Sandbox" ADD COLUMN     "expiresAt" TIMESTAMP(3),
ADD COLUMN     "lastActivity" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "metadata" JSONB,
ADD COLUMN     "previewUrl" TEXT,
ADD COLUMN     "templateId" TEXT,
ALTER COLUMN "projectId" DROP NOT NULL;

-- CreateIndex
CREATE INDEX "Sandbox_status_idx" ON "public"."Sandbox"("status");

-- CreateIndex
CREATE INDEX "Sandbox_expiresAt_idx" ON "public"."Sandbox"("expiresAt");

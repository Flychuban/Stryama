-- CreateEnum
CREATE TYPE "public"."UserPlan" AS ENUM ('FREE', 'BUILDER', 'PRO', 'UNLIMITED');

-- AlterTable
ALTER TABLE "public"."AIGeneration" ADD COLUMN     "model" TEXT;

-- CreateTable
CREATE TABLE "public"."UserUsage" (
    "id" TEXT NOT NULL,
    "clerkUserId" TEXT NOT NULL,
    "plan" "public"."UserPlan" NOT NULL DEFAULT 'FREE',
    "currentPeriodStart" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "currentPeriodEnd" TIMESTAMP(3) NOT NULL,
    "generationsThisMonth" INTEGER NOT NULL DEFAULT 0,
    "lastGenerationAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserUsage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "UserUsage_clerkUserId_key" ON "public"."UserUsage"("clerkUserId");

-- CreateIndex
CREATE INDEX "UserUsage_clerkUserId_idx" ON "public"."UserUsage"("clerkUserId");

-- CreateIndex
CREATE INDEX "UserUsage_currentPeriodEnd_idx" ON "public"."UserUsage"("currentPeriodEnd");

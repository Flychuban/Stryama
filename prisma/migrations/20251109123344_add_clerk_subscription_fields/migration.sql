-- CreateEnum
CREATE TYPE "public"."SubscriptionStatus" AS ENUM ('ACTIVE', 'PAST_DUE', 'CANCELED', 'INCOMPLETE', 'TRIALING', 'UNPAID');

-- AlterTable
ALTER TABLE "public"."UserUsage" ADD COLUMN     "billingCycle" TEXT,
ADD COLUMN     "cancelAtPeriodEnd" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "stripeCustomerId" TEXT,
ADD COLUMN     "stripeSubscriptionId" TEXT,
ADD COLUMN     "subscriptionStatus" "public"."SubscriptionStatus";

-- CreateIndex
CREATE INDEX "UserUsage_stripeSubscriptionId_idx" ON "public"."UserUsage"("stripeSubscriptionId");

-- CreateIndex
CREATE INDEX "UserUsage_subscriptionStatus_idx" ON "public"."UserUsage"("subscriptionStatus");

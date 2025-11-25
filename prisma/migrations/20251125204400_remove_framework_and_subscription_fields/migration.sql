-- DropIndex
DROP INDEX IF EXISTS "UserUsage_stripeSubscriptionId_idx";

-- DropIndex
DROP INDEX IF EXISTS "UserUsage_subscriptionStatus_idx";

-- AlterTable
ALTER TABLE "Project" DROP COLUMN IF EXISTS "framework";

-- AlterTable
ALTER TABLE "UserUsage"
  DROP COLUMN IF EXISTS "billingCycle",
  DROP COLUMN IF EXISTS "cancelAtPeriodEnd",
  DROP COLUMN IF EXISTS "stripeCustomerId",
  DROP COLUMN IF EXISTS "stripeSubscriptionId",
  DROP COLUMN IF EXISTS "subscriptionStatus";

-- AlterTable
ALTER TABLE "AIGeneration"
  ADD COLUMN IF NOT EXISTS "sessionData" TEXT;

-- DropEnum
DROP TYPE IF EXISTS "Framework";

-- DropEnum
DROP TYPE IF EXISTS "SubscriptionStatus";

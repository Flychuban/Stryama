-- Step 1: Migrate existing UNLIMITED users to PRO
UPDATE "public"."UserUsage"
SET "plan" = 'PRO'
WHERE "plan" = 'UNLIMITED';

-- Step 2: Drop the default constraint
ALTER TABLE "public"."UserUsage"
  ALTER COLUMN "plan" DROP DEFAULT;

-- Step 3: Rename old enum type
ALTER TYPE "public"."UserPlan" RENAME TO "UserPlan_old";

-- Step 4: Create new enum type without UNLIMITED
CREATE TYPE "public"."UserPlan" AS ENUM ('FREE', 'BUILDER', 'PRO');

-- Step 5: Convert column to new type
ALTER TABLE "public"."UserUsage"
  ALTER COLUMN "plan" TYPE "public"."UserPlan"
  USING "plan"::text::"public"."UserPlan";

-- Step 6: Re-add the default constraint
ALTER TABLE "public"."UserUsage"
  ALTER COLUMN "plan" SET DEFAULT 'FREE'::"public"."UserPlan";

-- Step 7: Drop old enum type
DROP TYPE "public"."UserPlan_old";

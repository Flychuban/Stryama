/*
  Warnings:

  - You are about to drop the column `fileId` on the `AIGeneration` table. All the data in the column will be lost.
  - You are about to drop the column `model` on the `AIGeneration` table. All the data in the column will be lost.
  - You are about to drop the column `userId` on the `AIGeneration` table. All the data in the column will be lost.
  - You are about to drop the column `name` on the `File` table. All the data in the column will be lost.
  - You are about to drop the column `userId` on the `Project` table. All the data in the column will be lost.
  - You are about to drop the `User` table. If the table is not empty, all the data it contains will be lost.
  - A unique constraint covering the columns `[projectId,path]` on the table `File` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `clerkUserId` to the `AIGeneration` table without a default value. This is not possible if the table is not empty.
  - Added the required column `clerkUserId` to the `Project` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "public"."SandboxStatus" AS ENUM ('ACTIVE', 'STOPPED', 'ERROR');

-- DropForeignKey
ALTER TABLE "public"."AIGeneration" DROP CONSTRAINT "AIGeneration_fileId_fkey";

-- DropForeignKey
ALTER TABLE "public"."AIGeneration" DROP CONSTRAINT "AIGeneration_userId_fkey";

-- DropForeignKey
ALTER TABLE "public"."Project" DROP CONSTRAINT "Project_userId_fkey";

-- DropIndex
DROP INDEX "public"."AIGeneration_fileId_idx";

-- DropIndex
DROP INDEX "public"."AIGeneration_userId_idx";

-- DropIndex
DROP INDEX "public"."Project_userId_idx";

-- AlterTable
ALTER TABLE "public"."AIGeneration" DROP COLUMN "fileId",
DROP COLUMN "model",
DROP COLUMN "userId",
ADD COLUMN     "clerkUserId" TEXT NOT NULL,
ADD COLUMN     "duration" INTEGER,
ADD COLUMN     "projectId" TEXT,
ADD COLUMN     "tokens" INTEGER;

-- AlterTable
ALTER TABLE "public"."File" DROP COLUMN "name",
ADD COLUMN     "language" TEXT;

-- AlterTable
ALTER TABLE "public"."Project" DROP COLUMN "userId",
ADD COLUMN     "clerkUserId" TEXT NOT NULL,
ADD COLUMN     "fileStructure" JSONB;

-- DropTable
DROP TABLE "public"."User";

-- CreateTable
CREATE TABLE "public"."Sandbox" (
    "id" TEXT NOT NULL,
    "e2bId" TEXT NOT NULL,
    "status" "public"."SandboxStatus" NOT NULL DEFAULT 'ACTIVE',
    "projectId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Sandbox_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Sandbox_e2bId_key" ON "public"."Sandbox"("e2bId");

-- CreateIndex
CREATE INDEX "Sandbox_projectId_idx" ON "public"."Sandbox"("projectId");

-- CreateIndex
CREATE INDEX "AIGeneration_clerkUserId_idx" ON "public"."AIGeneration"("clerkUserId");

-- CreateIndex
CREATE INDEX "AIGeneration_projectId_idx" ON "public"."AIGeneration"("projectId");

-- CreateIndex
CREATE UNIQUE INDEX "File_projectId_path_key" ON "public"."File"("projectId", "path");

-- CreateIndex
CREATE INDEX "Project_clerkUserId_idx" ON "public"."Project"("clerkUserId");

-- AddForeignKey
ALTER TABLE "public"."AIGeneration" ADD CONSTRAINT "AIGeneration_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "public"."Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Sandbox" ADD CONSTRAINT "Sandbox_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "public"."Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

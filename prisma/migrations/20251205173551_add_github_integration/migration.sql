-- CreateEnum
CREATE TYPE "public"."ExportStatus" AS ENUM ('PENDING', 'IN_PROGRESS', 'COMPLETED', 'FAILED');

-- CreateTable
CREATE TABLE "public"."GitHubConnection" (
    "id" TEXT NOT NULL,
    "clerkUserId" TEXT NOT NULL,
    "githubUsername" TEXT NOT NULL,
    "githubUserId" TEXT NOT NULL,
    "connectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSyncAt" TIMESTAMP(3),
    "defaultBranch" TEXT NOT NULL DEFAULT 'main',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GitHubConnection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."GitHubExport" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "connectionId" TEXT NOT NULL,
    "repoOwner" TEXT NOT NULL,
    "repoName" TEXT NOT NULL,
    "repoFullName" TEXT NOT NULL,
    "repoUrl" TEXT NOT NULL,
    "branch" TEXT NOT NULL DEFAULT 'main',
    "commitSha" TEXT,
    "commitMessage" TEXT NOT NULL,
    "filesExported" INTEGER NOT NULL DEFAULT 0,
    "status" "public"."ExportStatus" NOT NULL DEFAULT 'PENDING',
    "errorMessage" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GitHubExport_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "GitHubConnection_clerkUserId_key" ON "public"."GitHubConnection"("clerkUserId");

-- CreateIndex
CREATE INDEX "GitHubConnection_clerkUserId_idx" ON "public"."GitHubConnection"("clerkUserId");

-- CreateIndex
CREATE INDEX "GitHubConnection_githubUserId_idx" ON "public"."GitHubConnection"("githubUserId");

-- CreateIndex
CREATE INDEX "GitHubExport_projectId_idx" ON "public"."GitHubExport"("projectId");

-- CreateIndex
CREATE INDEX "GitHubExport_connectionId_idx" ON "public"."GitHubExport"("connectionId");

-- CreateIndex
CREATE INDEX "GitHubExport_status_idx" ON "public"."GitHubExport"("status");

-- CreateIndex
CREATE INDEX "GitHubExport_createdAt_idx" ON "public"."GitHubExport"("createdAt" DESC);

-- AddForeignKey
ALTER TABLE "public"."GitHubExport" ADD CONSTRAINT "GitHubExport_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "public"."Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."GitHubExport" ADD CONSTRAINT "GitHubExport_connectionId_fkey" FOREIGN KEY ("connectionId") REFERENCES "public"."GitHubConnection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

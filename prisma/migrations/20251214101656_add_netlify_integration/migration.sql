-- CreateEnum
CREATE TYPE "public"."DeploymentStatus" AS ENUM ('PENDING', 'BUILDING', 'DEPLOYING', 'COMPLETED', 'FAILED');

-- CreateTable
CREATE TABLE "public"."NetlifyConnection" (
    "id" TEXT NOT NULL,
    "clerkUserId" TEXT NOT NULL,
    "netlifyEmail" TEXT NOT NULL,
    "netlifyUserId" TEXT NOT NULL,
    "netlifyFullName" TEXT,
    "accessToken" TEXT NOT NULL,
    "connectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastDeployAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NetlifyConnection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."NetlifyDeployment" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "connectionId" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "siteName" TEXT NOT NULL,
    "siteUrl" TEXT NOT NULL,
    "deployUrl" TEXT,
    "deployId" TEXT,
    "buildSize" INTEGER,
    "filesDeployed" INTEGER NOT NULL DEFAULT 0,
    "buildTime" INTEGER,
    "status" "public"."DeploymentStatus" NOT NULL DEFAULT 'PENDING',
    "errorMessage" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NetlifyDeployment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "NetlifyConnection_clerkUserId_key" ON "public"."NetlifyConnection"("clerkUserId");

-- CreateIndex
CREATE INDEX "NetlifyConnection_clerkUserId_idx" ON "public"."NetlifyConnection"("clerkUserId");

-- CreateIndex
CREATE INDEX "NetlifyConnection_netlifyUserId_idx" ON "public"."NetlifyConnection"("netlifyUserId");

-- CreateIndex
CREATE INDEX "NetlifyDeployment_projectId_idx" ON "public"."NetlifyDeployment"("projectId");

-- CreateIndex
CREATE INDEX "NetlifyDeployment_connectionId_idx" ON "public"."NetlifyDeployment"("connectionId");

-- CreateIndex
CREATE INDEX "NetlifyDeployment_status_idx" ON "public"."NetlifyDeployment"("status");

-- AddForeignKey
ALTER TABLE "public"."NetlifyDeployment" ADD CONSTRAINT "NetlifyDeployment_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "public"."Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."NetlifyDeployment" ADD CONSTRAINT "NetlifyDeployment_connectionId_fkey" FOREIGN KEY ("connectionId") REFERENCES "public"."NetlifyConnection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

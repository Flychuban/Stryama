/*
  Warnings:

  - Added the required column `accessToken` to the `GitHubConnection` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "public"."GitHubConnection" ADD COLUMN     "accessToken" TEXT NOT NULL;

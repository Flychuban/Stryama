-- CreateTable
CREATE TABLE "public"."OAuthState" (
    "id" TEXT NOT NULL,
    "nonce" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "returnUrl" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OAuthState_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "OAuthState_nonce_key" ON "public"."OAuthState"("nonce");

-- CreateIndex
CREATE INDEX "OAuthState_nonce_idx" ON "public"."OAuthState"("nonce");

-- CreateIndex
CREATE INDEX "OAuthState_expiresAt_idx" ON "public"."OAuthState"("expiresAt");

-- CreateIndex
CREATE INDEX "OAuthState_userId_idx" ON "public"."OAuthState"("userId");

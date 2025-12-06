# GitHub OAuth Setup Guide

## Overview

The GitHub integration uses a **custom OAuth flow** to avoid Clerk's step-up authentication requirements. This provides a seamless user experience while maintaining security.

## Flow Architecture

```
User clicks "Connect GitHub"
  ↓
Redirects to /api/github/connect (server endpoint)
  ↓
Server generates GitHub OAuth URL
  ↓
Redirects to GitHub.com for authorization
  ↓
User authorizes Stryama
  ↓
GitHub redirects to /api/github/callback
  ↓
Server exchanges code for access token
  ↓
Server saves connection + token to database
  ↓
Redirects to /github/callback page
  ↓
Page shows success message and triggers analytics
  ↓
Redirects user back to original page
```

## Setup Instructions

### 1. Create GitHub OAuth App

1. Go to **[GitHub Settings → Developer Settings → OAuth Apps](https://github.com/settings/developers)**
2. Click **"New OAuth App"**
3. Fill in the following:
   - **Application name**: `Stryama` (or your app name)
   - **Homepage URL**: Your production URL (e.g., `https://stryama.app`)
   - **Application description**: (Optional) "AI-powered full-stack application generator"
   - **Authorization callback URL**: `https://stryama.app/api/github/callback`

4. Click **"Register application"**
5. **Copy the Client ID** → Save it for the next step
6. Click **"Generate a new client secret"**
7. **Copy the Client Secret immediately** (you won't be able to see it again)

### 2. Add Callback URL for Development

1. In your GitHub OAuth App settings, scroll to **"Authorization callback URL"**
2. Click **"Add a new callback URL"** (if available) OR edit the existing one
3. Add: `http://localhost:3000/api/github/callback`
4. Click **"Update application"**

**Important:** GitHub allows multiple callback URLs. Make sure BOTH production and development URLs are added:

- `https://stryama.app/api/github/callback` (Production)
- `http://localhost:3000/api/github/callback` (Development)

### 3. Configure Environment Variables

Add these to your `.env` file:

```env
# GitHub OAuth credentials
GITHUB_CLIENT_ID="your_github_client_id_here"
GITHUB_CLIENT_SECRET="your_github_client_secret_here"

# Make sure NEXT_PUBLIC_APP_URL is set correctly
NEXT_PUBLIC_APP_URL=http://localhost:3000  # Development
# NEXT_PUBLIC_APP_URL=https://stryama.app  # Production
```

**Security Note:**

- ✅ Never commit `.env` to git (it's in `.gitignore`)
- ✅ Use different OAuth apps for development and production (recommended)
- ✅ Rotate secrets if they're ever exposed

### 4. Test the Integration

#### Development Testing

1. Start your development server:

   ```bash
   pnpm dev
   ```

2. Navigate to the editor: `http://localhost:3000/editor`

3. Click the **GitHub export button** (or open the export dialog)

4. Click **"Connect GitHub"**

5. You should be redirected to GitHub → Authorize → Redirected back with success message

#### Verification Checklist

- [ ] Clicking "Connect GitHub" redirects to GitHub.com
- [ ] GitHub asks for authorization with correct scopes: `public_repo`, `read:user`, `user:email`
- [ ] After authorizing, redirected to `/github/callback` page
- [ ] Success toast appears: "GitHub connected successfully!"
- [ ] Redirected back to the editor
- [ ] GitHub connection shows as connected in the UI
- [ ] Can export projects to GitHub

## Troubleshooting

### Error: "GitHub OAuth not configured"

**Cause:** Environment variables not set correctly.

**Fix:**

1. Check `.env` file has `GITHUB_CLIENT_ID` and `GITHUB_CLIENT_SECRET`
2. Restart dev server after adding env variables
3. Verify no typos in variable names

### Error: "Invalid callback URL"

**Cause:** Callback URL mismatch between GitHub OAuth App and your application.

**Fix:**

1. Go to GitHub OAuth App settings
2. Verify callback URLs include:
   - `http://localhost:3000/api/github/callback` (dev)
   - `https://stryama.app/api/github/callback` (prod)
3. Make sure `NEXT_PUBLIC_APP_URL` matches your environment

### Error: "Token exchange failed"

**Cause:** Invalid Client Secret or Client ID.

**Fix:**

1. Regenerate Client Secret in GitHub OAuth App settings
2. Update `.env` with new secret
3. Restart dev server

### User gets "Access Denied" error

**Cause:** User denied authorization on GitHub.

**Expected behavior:** User is redirected back with error message.

**Fix:** User can try connecting again.

## Production Deployment

### Vercel / Netlify / Similar Platforms

1. Add environment variables in your platform's dashboard:
   - `GITHUB_CLIENT_ID`
   - `GITHUB_CLIENT_SECRET`
   - `NEXT_PUBLIC_APP_URL=https://stryama.app`

2. Ensure your GitHub OAuth App has the production callback URL:
   - `https://stryama.app/api/github/callback`

3. Deploy and test the flow in production

### Security Best Practices

1. **Use separate OAuth Apps for environments:**
   - Development OAuth App with `http://localhost:3000` callback
   - Production OAuth App with `https://stryama.app` callback

2. **Encrypt access tokens at rest:** (Future Enhancement)
   - Currently tokens are stored as plain text in the database
   - Consider using encryption libraries like `@47ng/cloak` or database-level encryption

3. **Implement token refresh:** (Future Enhancement)
   - GitHub OAuth tokens don't expire by default
   - Monitor for token invalidation and prompt re-authentication

4. **Rate limiting:**
   - GitHub API: 5,000 requests/hour for authenticated users
   - Monitor usage with Sentry

## Database Schema

The `GitHubConnection` table stores:

```prisma
model GitHubConnection {
  id                String   @id @default(cuid())
  clerkUserId       String   @unique

  githubUsername    String
  githubUserId      String
  accessToken       String   @db.Text  // Stored for API access

  connectedAt       DateTime @default(now())
  lastSyncAt        DateTime?
  defaultBranch     String   @default("main")

  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt

  exports           GitHubExport[]
}
```

## API Routes

### `/api/github/connect` (GET)

Initiates GitHub OAuth flow.

**Query Parameters:**

- `return_url` (optional): URL to return to after connection

**Response:** Redirects to GitHub OAuth

### `/api/github/callback` (GET)

Handles GitHub OAuth callback.

**Query Parameters:**

- `code`: Authorization code from GitHub
- `state`: Encrypted state containing userId and returnUrl

**Response:** Saves connection and redirects to `/github/callback`

## Why Custom OAuth Flow?

**Problem with Clerk's OAuth:**

- `signIn.authenticateWithRedirect()` → "You're already signed in" error (for linking accounts)
- `user.createExternalAccount()` → Requires step-up authentication (403 error)

**Our Solution:**

- Custom OAuth flow using GitHub's API directly
- Bypasses Clerk's authentication requirements
- Stores tokens in our database
- Provides seamless UX: 1-click connection

## Support

If you encounter issues:

1. Check the troubleshooting section above
2. Review Sentry logs for detailed error messages
3. Verify all environment variables are set correctly
4. Test in a fresh incognito window to avoid cached credentials

## Future Enhancements

- [ ] Token encryption at rest
- [ ] Token refresh flow
- [ ] Support for GitHub Enterprise
- [ ] Organization repository access
- [ ] Private repository support
- [ ] Multiple GitHub account connections per user

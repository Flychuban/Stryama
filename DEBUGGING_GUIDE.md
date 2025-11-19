# 🔍 Debugging Guide: Beta Tester Not Working

## Issue

User `kaloyan.ch.anastasov.2021@elsys-bg.org` is showing as FREE plan instead of BUILDER plan after deployment.

## ✅ Verified Working Parts

1. **Code is correct** ✅
   - Authorization logic is properly implemented
   - Email is in BETA_TESTERS constant: `'kaloyan.ch.anastasov.2021@elsys-bg.org': 'BUILDER'`
   - Case-insensitive matching is implemented
   - Type safety is correct

2. **Code is deployed** ✅
   - Git status clean
   - Latest commit: `63e3657 Add beta tester allowlist`
   - Changes are pushed to origin/main

3. **Data flow is correct** ✅
   - Profile page → `api.subscription.getDetails.useQuery()`
   - Subscription router → `getUserPlanFromClerk()`
   - getUserPlanFromClerk() → checks BETA_TESTERS

## 🔍 Possible Causes

### Cause 1: Vercel Build Cache (MOST LIKELY)

**Problem:** Vercel didn't rebuild the serverless functions with new code.

**Why:** Sometimes Vercel caches builds and doesn't detect changes in certain files.

**Solution:**

1. Go to Vercel Dashboard
2. Deployments → Find latest deployment
3. Click "Redeploy" with "Use existing Build Cache" UNCHECKED
4. Wait for new deployment to complete

**OR** trigger a new commit:

```bash
# Force a new build
git commit --allow-empty -m "Force rebuild for beta tester fix"
git push
```

---

### Cause 2: Clerk Session Cache (CLIENT-SIDE)

**Problem:** User's browser has cached Clerk session data.

**Solution:**

1. **User must log out completely**
2. **Clear browser cookies** for your domain
3. **Log back in**
4. Check profile page again

**Quick test:**

- Open incognito/private browser window
- Log in as the beta tester
- Check if plan shows as BUILDER

---

### Cause 3: Email Mismatch in Clerk

**Problem:** The email stored in Clerk sessionClaims is different from expected.

**Possible issues:**

- Email has extra spaces
- Email uses different casing (shouldn't matter but worth checking)
- Email is stored differently in Clerk

**Solution:**
Check exact email in Clerk Dashboard:

1. Go to Clerk Dashboard → Users
2. Find the user
3. Check the EXACT email (including any spaces or special chars)
4. Verify it matches EXACTLY: `kaloyan.ch.anastasov.2021@elsys-bg.org`

---

### Cause 4: Clerk Session Not Updated

**Problem:** `sessionClaims.email` is null or undefined for some reason.

**Why:** Clerk might not be populating the email in session claims.

**Solution:**
Temporarily add production logging to see what's happening.

---

## 🔧 IMMEDIATE FIXES TO TRY

### Fix 1: Force Redeploy (DO THIS FIRST)

#### Option A: Via Vercel Dashboard

1. Go to https://vercel.com/dashboard
2. Select your project
3. Click "Deployments"
4. Find latest deployment
5. Click "..." menu → "Redeploy"
6. **UNCHECK** "Use existing Build Cache"
7. Click "Redeploy"
8. Wait ~2-3 minutes for deployment

#### Option B: Via Git (FASTER)

```bash
cd /Users/flychuban/Desktop/Stryama

# Empty commit to force rebuild
git commit --allow-empty -m "Force rebuild: beta tester fix"
git push

# Wait 2-3 minutes for Vercel to deploy
```

---

### Fix 2: User Must Log Out & Back In

**Have the beta tester do this:**

1. Click their profile picture → Sign out
2. Close browser completely
3. Open browser again
4. Go to your site
5. Sign in again
6. Visit /profile page

---

### Fix 3: Add Temporary Production Debug Logging

**If Fixes 1 & 2 don't work**, add this to see what's happening:

```typescript
// src/lib/clerk/authorization.ts line 58
export async function getUserPlanFromClerk(): Promise<UserPlan> {
  const { userId, sessionClaims, has } = await auth();

  // TEMPORARY DEBUG LOGGING (REMOVE AFTER DEBUGGING)
  console.log('[DEBUG] getUserPlanFromClerk called');
  console.log('[DEBUG] userId:', userId);
  console.log('[DEBUG] sessionClaims?.email:', sessionClaims?.email);
  console.log('[DEBUG] BETA_TESTERS keys:', Object.keys(BETA_TESTERS));

  // ... rest of function
```

Then:

1. Deploy changes
2. Have user visit profile
3. Check Vercel logs: Dashboard → Deployments → Latest → Runtime Logs
4. Look for DEBUG messages

---

## 🧪 Test Cases

### Test 1: Verify Function Works Locally

```bash
# In your project
pnpm dev

# Log in as beta tester in browser
# Visit http://localhost:3000/profile
# Check terminal for [Auth] Beta tester detected message
```

If you see the message in terminal → Code works, issue is deployment/caching.

---

### Test 2: Check Production Logs

1. Vercel Dashboard → Your project
2. Deployments → Latest deployment
3. Click "View Function Logs"
4. Have beta tester visit /profile
5. Look for any error messages or relevant logs

---

### Test 3: Verify Email Format in Clerk

1. Clerk Dashboard → Users
2. Search for: kaloyan.ch.anastasov.2021@elsys-bg.org
3. Click user
4. Check email field exactly
5. Copy-paste it to compare with your code

---

## 📊 Diagnostic Checklist

**Run through this checklist:**

- [ ] Code has `'kaloyan.ch.anastasov.2021@elsys-bg.org': 'BUILDER'` in BETA_TESTERS
- [ ] Changes are committed and pushed to git
- [ ] Vercel shows successful deployment after the commit
- [ ] Vercel deployment timestamp is AFTER the git commit time
- [ ] User has logged out and back in
- [ ] User tried in incognito browser
- [ ] Email in Clerk Dashboard matches exactly
- [ ] No TypeScript errors (`pnpm typecheck`)
- [ ] No build errors in Vercel logs

---

## 🎯 MOST LIKELY FIX

**99% sure it's one of these:**

1. **Vercel cached old build** → Force redeploy without cache
2. **User's browser has cached session** → Log out, clear cookies, log back in
3. **Need to wait for deployment** → Check Vercel deployment completed successfully

**Try in this order:**

1. Force Vercel redeploy (Option B via git is fastest)
2. Have user log out & log back in (in incognito window first)
3. If still not working, add debug logging and check Vercel logs

---

## 🔬 Advanced Debugging

### Check if Serverless Function Updated

1. Make a unique change to getUserPlanFromClerk:

```typescript
export async function getUserPlanFromClerk(): Promise<UserPlan> {
  // Add unique timestamp
  console.log(
    '[REBUILD CHECK] Function executed at:',
    new Date().toISOString()
  );

  const { userId, sessionClaims, has } = await auth();
  // ... rest
}
```

2. Deploy
3. Visit profile
4. Check logs for the timestamp
5. If you don't see it → Function wasn't rebuilt

---

## ✅ Expected Outcome After Fix

When it works, user should see:

- Profile page: "Current Plan: **BUILDER**"
- AI Generations: "1 / **100**" (not 1 / 15)
- Active Projects: Shows "1 / **5**" (not 1 / 1)

---

## 📝 Notes

- Vercel caching is a common issue with serverless functions
- Sometimes takes 2-3 minutes for changes to propagate
- User MUST log out and back in after deployment
- Incognito window bypasses all browser caching

---

**Next Step:** Try "Fix 1: Force Redeploy" first, then have user log out/in.

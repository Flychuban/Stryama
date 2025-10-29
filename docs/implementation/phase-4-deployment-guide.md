# Phase 4 Deployment Guide

## Prerequisites

- Phase 1, 2, and 3 already deployed
- E2B API key configured
- Vercel deployment (or cron service alternative)

## Step 1: Generate CRON_SECRET

```bash
# Generate a secure random secret (32+ characters)
openssl rand -base64 32
```

Save this value - you'll need it for the next step.

## Step 2: Add Environment Variables

### Development (.env.local)

```env
CRON_SECRET=<your-generated-secret>
```

### Production (Vercel)

```bash
# Add via CLI
vercel env add CRON_SECRET
# Enter the secret when prompted
# Select: Production, Preview, Development (all environments)
```

Or via Vercel Dashboard:

1. Go to Project Settings → Environment Variables
2. Add `CRON_SECRET`
3. Value: Your generated secret
4. Environments: Production, Preview, Development

## Step 3: Verify Build

```bash
# Install dependencies (if needed)
pnpm install

# Type check
pnpm tsc --noEmit

# Build locally to catch errors
pnpm build
```

Expected output: No TypeScript errors, successful build.

## Step 4: Deploy

```bash
# Commit changes
git add .
git commit -m "feat: Phase 4 - Sandbox Lifecycle & Session Management

- Add sandbox pooling for 90% faster startup
- Implement automatic cleanup scheduler
- Add session persistence with pause/resume
- Configure cron job for cleanup (every 5 min)
- Add pool monitoring endpoints"

# Push to main (or your deployment branch)
git push origin main
```

Vercel will automatically deploy.

## Step 5: Verify Deployment

### 5.1 Check Vercel Cron Jobs

1. Go to Vercel Dashboard → Your Project
2. Click "Cron Jobs" tab
3. Verify entry:
   - **Path:** `/api/cron/cleanup`
   - **Schedule:** `*/5 * * * *` (every 5 minutes)
   - **Status:** Active

### 5.2 Test Cron Endpoint Manually

```bash
# Test cleanup endpoint (replace with your URL and secret)
curl -X GET \
  -H "Authorization: Bearer YOUR_CRON_SECRET" \
  https://your-app.vercel.app/api/cron/cleanup
```

Expected response:

```json
{
  "success": true,
  "stats": {
    "timestamp": "2025-10-29T...",
    "sandboxesDestroyed": 0,
    "sandboxesPaused": 0,
    "poolSandboxesRemoved": 0,
    "errors": 0,
    "durationMs": 123
  }
}
```

### 5.3 Verify Pool Status

Use your application or test via API:

```typescript
// In your app or via tRPC playground
const poolStatus = await api.sandbox.getPoolStatus.query();
console.log(poolStatus);
```

Expected output:

```json
{
  "totalPooled": 2,
  "available": 2,
  "assigned": 0,
  "metrics": {
    "poolHitRate": 0,
    "avgResumeTime": 0,
    "totalAssignments": 0,
    "totalCreations": 0
  }
}
```

## Step 6: Monitor Initial Performance

### First 24 Hours

Monitor these metrics:

1. **Pool Health**
   - Check that pool maintains 2-3 sandboxes
   - Verify pool refills after assignment

2. **Cleanup Execution**
   - Check Vercel logs every 5 minutes
   - Verify cleanup runs without errors

3. **Sandbox Creation Time**
   - First request: ~20s (pool creation)
   - Subsequent requests: ~2-5s (pool assignment)

### Check Logs

```bash
# View deployment logs
vercel logs YOUR_DEPLOYMENT_URL

# Filter for cleanup logs
vercel logs YOUR_DEPLOYMENT_URL | grep "Cleanup Scheduler"

# Filter for pool logs
vercel logs YOUR_DEPLOYMENT_URL | grep "Sandbox Pool"
```

## Step 7: Tune Configuration (After 48 Hours)

Based on actual usage, you may want to adjust:

### Pool Size

Edit `/src/lib/integrations/e2b/config.ts`:

```typescript
export const POOL_CONFIG = {
  minSize: 3, // Increase if pool hit rate < 70%
  maxSize: 5, // Increase if high concurrent usage
  // ...
};
```

### Cleanup Interval

Edit `vercel.json`:

```json
{
  "crons": [
    {
      "path": "/api/cron/cleanup",
      "schedule": "*/10 * * * *" // Every 10 min (less aggressive)
    }
  ]
}
```

### Inactivity Timeout

Edit `/src/lib/integrations/e2b/config.ts`:

```typescript
export const LIFECYCLE_CONFIG = {
  inactivityTimeout: 15 * 60 * 1000, // 15 min (was 10)
  // ...
};
```

## Common Issues & Solutions

### Issue 1: Cron Job Not Running

**Symptoms:** No cleanup logs, pool not refilling

**Solutions:**

1. Check `CRON_SECRET` is set in Vercel environment
2. Verify cron job is active in Vercel dashboard
3. Check deployment logs for errors
4. Test endpoint manually with curl

### Issue 2: Pool Not Maintaining Size

**Symptoms:** `totalPooled` stays at 0 or drops below minimum

**Solutions:**

1. Check E2B API key is valid and has quota
2. Check logs for pool creation errors
3. Verify `FEATURE_FLAGS.enablePooling = true`
4. Manually trigger pool refill by creating a sandbox

### Issue 3: High Pool Miss Rate

**Symptoms:** `poolHitRate` < 50%

**Solutions:**

1. Increase `POOL_CONFIG.minSize` to 3-4
2. Check cleanup isn't too aggressive (increase interval)
3. Monitor concurrent user count
4. Consider per-user pools (future enhancement)

### Issue 4: Sandboxes Not Resuming

**Symptoms:** Always creating new sandboxes, never resuming

**Solutions:**

1. Verify E2B persistence API is available (check E2B dashboard)
2. Check sandbox age (must be < 30 days)
3. Verify `FEATURE_FLAGS.usePersistence = true`
4. Check logs for E2B API errors

### Issue 5: Cleanup Too Aggressive

**Symptoms:** Sandboxes being destroyed while still in use

**Solutions:**

1. Increase `LIFECYCLE_CONFIG.inactivityTimeout`
2. Verify `lastActivity` is being updated on user actions
3. Check cleanup logs for unexpected patterns
4. Adjust cleanup schedule to less frequent

## Rollback Plan

If Phase 4 causes issues:

### Quick Rollback (Disable Features)

Edit `/src/lib/integrations/e2b/config.ts`:

```typescript
export const FEATURE_FLAGS = {
  usePersistence: false, // Disable pause/resume
  useAutoPause: false, // Disable auto-pause
  enablePooling: false, // Disable pooling
};
```

Deploy: Behavior reverts to Phase 3 (create new every time)

### Full Rollback (Previous Version)

```bash
# Revert to previous commit
git revert HEAD

# Or checkout specific commit
git checkout <commit-hash-before-phase-4>

# Deploy
git push origin main
```

## Success Criteria

Phase 4 is successful when:

- ✅ Pool maintains 2-3 paused sandboxes
- ✅ Pool hit rate > 70%
- ✅ Average resume time < 3s
- ✅ Cleanup runs every 5 minutes without errors
- ✅ No user-reported performance degradation
- ✅ Inactive sandboxes are paused within 10 minutes
- ✅ Zero orphaned resources after 24 hours

## Next Steps

After successful deployment:

1. **Week 1:** Monitor and tune configuration
2. **Week 2:** Implement Phase 4.3 (monitoring dashboard)
3. **Week 3:** Collect user feedback on performance
4. **Week 4:** Plan Phase 5 (advanced optimizations)

## Support

If you encounter issues:

1. Check logs: `vercel logs`
2. Check pool status: `sandbox.getPoolStatus`
3. Review error messages in console
4. Check E2B dashboard for API issues
5. Refer to [phase-4-implementation-summary.md](./phase-4-implementation-summary.md)

---

**Deployment Checklist:**

- [ ] CRON_SECRET generated
- [ ] Environment variables set (dev + prod)
- [ ] Code committed and pushed
- [ ] Vercel deployment successful
- [ ] Cron job active in Vercel
- [ ] Manual cron test passed
- [ ] Pool status verified
- [ ] Logs monitored for 24h
- [ ] Configuration tuned based on metrics

Good luck with your deployment! 🚀

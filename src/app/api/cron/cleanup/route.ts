/**
 * Cron Cleanup API Route - Phase 4: Sandbox Lifecycle & Session Management
 *
 * This endpoint is called by a cron job (every 5 minutes) to perform
 * automatic cleanup of sandboxes.
 *
 * Triggered by:
 * - Vercel Cron (if deployed on Vercel)
 * - External cron service (e.g., cron-job.org)
 *
 * Security: Requires CRON_SECRET in Authorization header
 */

import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { db } from '~/server/db';
import { cleanupScheduler } from '~/lib/integrations/e2b/services/cleanup-scheduler';
import { env } from '~/env';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  try {
    // Verify authorization
    const authHeader = request.headers.get('authorization');
    const expectedAuth = `Bearer ${env.CRON_SECRET}`;

    if (!env.CRON_SECRET) {
      console.error('[Cron Cleanup] CRON_SECRET not configured');
      return NextResponse.json(
        { error: 'Cron secret not configured' },
        { status: 500 }
      );
    }

    if (authHeader !== expectedAuth) {
      console.warn('[Cron Cleanup] Unauthorized access attempt');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log('[Cron Cleanup] Starting cleanup job...');

    // Run cleanup
    const stats = await cleanupScheduler.runCleanup(db);

    console.log('[Cron Cleanup] Cleanup job completed:', stats);

    return NextResponse.json({
      success: true,
      stats,
    });
  } catch (error) {
    console.error('[Cron Cleanup] Cleanup job failed:', error);

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

// Also support POST for flexibility with different cron services
export async function POST(request: NextRequest) {
  return GET(request);
}

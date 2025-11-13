/**
 * Claude Session Cache
 *
 * Manages Claude Agent SDK session file persistence in Vercel's serverless environment.
 *
 * The Claude SDK stores conversation state in ~/.claude/ filesystem. In Vercel:
 * - HOME is set to /tmp (for write access)
 * - /tmp is wiped between serverless function invocations
 * - This causes "No conversation found" errors on subsequent prompts
 *
 * Solution: Cache session files in Vercel KV (Redis) between invocations.
 */

import { kv } from '@vercel/kv';
import { readFile, writeFile, mkdir } from 'fs/promises';
import { dirname, join } from 'path';

/**
 * Get the session file path for a given project and session ID
 */
function getSessionFilePath(projectId: string, sessionId: string): string {
  // Claude stores sessions at: ~/.claude/projects/{project-slug}/{session-id}.jsonl
  // With HOME=/tmp, this becomes: /tmp/.claude/projects/{slug}/{sessionId}.jsonl
  //
  // Note: The project slug is typically a sanitized version of the project path
  // For simplicity, we use the projectId as the slug
  return `/tmp/.claude/projects/${projectId}/${sessionId}.jsonl`;
}

/**
 * Get the KV cache key for a session
 */
function getSessionCacheKey(sessionId: string): string {
  return `claude:session:${sessionId}`;
}

/**
 * Save a Claude session file to Vercel KV cache
 *
 * Call this AFTER a Claude generation completes to persist the session state.
 *
 * @param sessionId - The Claude session ID returned from the SDK
 * @param projectId - The project ID (used to construct session file path)
 * @returns true if saved successfully, false otherwise
 */
export async function saveSessionToKV(
  sessionId: string,
  projectId: string
): Promise<boolean> {
  try {
    const sessionPath = getSessionFilePath(projectId, sessionId);

    // Read the session file created by Claude SDK
    const sessionData = await readFile(sessionPath, 'utf-8');

    // Store in Vercel KV with 24 hour expiration
    // Sessions older than 24h can be considered stale
    const cacheKey = getSessionCacheKey(sessionId);
    await kv.set(cacheKey, sessionData, { ex: 86400 }); // 24 hours in seconds

    console.log(
      `[Session Cache] ✅ Saved session ${sessionId} to KV (${sessionData.length} bytes)`
    );
    return true;
  } catch (error) {
    console.error(
      `[Session Cache] ❌ Failed to save session ${sessionId} to KV:`,
      error
    );
    // Don't throw - session save failure shouldn't break the response
    return false;
  }
}

/**
 * Restore a Claude session file from Vercel KV cache
 *
 * Call this BEFORE a Claude generation to restore previous session state.
 *
 * @param sessionId - The Claude session ID to restore
 * @param projectId - The project ID (used to construct session file path)
 * @returns true if restored successfully, false if session not found or error
 */
export async function restoreSessionFromKV(
  sessionId: string,
  projectId: string
): Promise<boolean> {
  try {
    const cacheKey = getSessionCacheKey(sessionId);

    // Retrieve session data from KV
    const sessionData = await kv.get<string>(cacheKey);

    if (!sessionData) {
      console.log(
        `[Session Cache] ⚠️ Session ${sessionId} not found in KV cache`
      );
      return false;
    }

    // Write session file to the expected location
    const sessionPath = getSessionFilePath(projectId, sessionId);

    // Ensure directory exists
    await mkdir(dirname(sessionPath), { recursive: true });

    // Write the session file
    await writeFile(sessionPath, sessionData, 'utf-8');

    console.log(
      `[Session Cache] ✅ Restored session ${sessionId} from KV (${sessionData.length} bytes)`
    );
    return true;
  } catch (error) {
    console.error(
      `[Session Cache] ❌ Failed to restore session ${sessionId} from KV:`,
      error
    );
    // Don't throw - if we can't restore, Claude will start a new session
    return false;
  }
}

/**
 * Clear a session from the cache
 *
 * Useful for cleanup or when a session becomes invalid.
 *
 * @param sessionId - The Claude session ID to clear
 * @returns true if cleared successfully
 */
export async function clearSessionFromKV(sessionId: string): Promise<boolean> {
  try {
    const cacheKey = getSessionCacheKey(sessionId);
    await kv.del(cacheKey);

    console.log(`[Session Cache] 🗑️ Cleared session ${sessionId} from KV`);
    return true;
  } catch (error) {
    console.error(
      `[Session Cache] ❌ Failed to clear session ${sessionId}:`,
      error
    );
    return false;
  }
}

/**
 * Check if a session exists in the cache
 *
 * @param sessionId - The Claude session ID to check
 * @returns true if session exists in cache
 */
export async function hasSessionInKV(sessionId: string): Promise<boolean> {
  try {
    const cacheKey = getSessionCacheKey(sessionId);
    const exists = await kv.exists(cacheKey);
    return exists === 1;
  } catch (error) {
    console.error(
      `[Session Cache] ❌ Failed to check session ${sessionId}:`,
      error
    );
    return false;
  }
}

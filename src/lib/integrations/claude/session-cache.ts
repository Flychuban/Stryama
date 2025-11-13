/**
 * Claude Session Cache
 *
 * Manages Claude Agent SDK session file persistence in serverless environments.
 *
 * The Claude SDK stores conversation state in ~/.claude/ filesystem. In Vercel:
 * - HOME is set to /tmp (for write access)
 * - /tmp is wiped between serverless function invocations
 * - This causes "No conversation found" errors on subsequent prompts
 *
 * Solution: Store session files in Postgres database between invocations.
 */

import { readFile, writeFile, mkdir } from 'fs/promises';
import { dirname } from 'path';
import type { PrismaClient } from '@prisma/client';

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
 * Save a Claude session file to the database
 *
 * Call this AFTER a Claude generation completes to persist the session state.
 *
 * @param db - Prisma database client
 * @param sessionId - The Claude session ID returned from the SDK
 * @param projectId - The project ID (used to construct session file path)
 * @returns true if saved successfully, false otherwise
 */
export async function saveSessionToDB(
  db: PrismaClient,
  sessionId: string,
  projectId: string
): Promise<boolean> {
  try {
    const sessionPath = getSessionFilePath(projectId, sessionId);

    // Read the session file created by Claude SDK
    const sessionData = await readFile(sessionPath, 'utf-8');

    // Find the AIGeneration record with this sessionId
    const generation = await db.aIGeneration.findFirst({
      where: { sessionId },
      orderBy: { createdAt: 'desc' },
    });

    if (!generation) {
      console.warn(
        `[Session Cache] ⚠️ No AIGeneration record found for session ${sessionId}`
      );
      return false;
    }

    // Update the AIGeneration record with session data
    await db.aIGeneration.update({
      where: { id: generation.id },
      data: { sessionData },
    });

    console.log(
      `[Session Cache] ✅ Saved session ${sessionId} to database (${sessionData.length} bytes)`
    );
    return true;
  } catch (error) {
    console.error(
      `[Session Cache] ❌ Failed to save session ${sessionId} to database:`,
      error
    );
    // Don't throw - session save failure shouldn't break the response
    return false;
  }
}

/**
 * Restore a Claude session file from the database
 *
 * Call this BEFORE a Claude generation to restore previous session state.
 *
 * @param db - Prisma database client
 * @param sessionId - The Claude session ID to restore
 * @param projectId - The project ID (used to construct session file path)
 * @returns true if restored successfully, false if session not found or error
 */
export async function restoreSessionFromDB(
  db: PrismaClient,
  sessionId: string,
  projectId: string
): Promise<boolean> {
  try {
    // Retrieve session data from database
    const generation = await db.aIGeneration.findFirst({
      where: {
        sessionId,
        sessionData: { not: null },
      },
      orderBy: { createdAt: 'desc' },
      select: { sessionData: true },
    });

    if (!generation?.sessionData) {
      console.log(
        `[Session Cache] ⚠️ Session ${sessionId} not found in database`
      );
      return false;
    }

    // Write session file to the expected location
    const sessionPath = getSessionFilePath(projectId, sessionId);

    // Ensure directory exists
    await mkdir(dirname(sessionPath), { recursive: true });

    // Write the session file
    await writeFile(sessionPath, generation.sessionData, 'utf-8');

    console.log(
      `[Session Cache] ✅ Restored session ${sessionId} from database (${generation.sessionData.length} bytes)`
    );
    return true;
  } catch (error) {
    console.error(
      `[Session Cache] ❌ Failed to restore session ${sessionId} from database:`,
      error
    );
    // Don't throw - if we can't restore, Claude will start a new session
    return false;
  }
}

/**
 * Clear session data from the database
 *
 * Useful for cleanup or when a session becomes invalid.
 *
 * @param db - Prisma database client
 * @param sessionId - The Claude session ID to clear
 * @returns true if cleared successfully
 */
export async function clearSessionFromDB(
  db: PrismaClient,
  sessionId: string
): Promise<boolean> {
  try {
    await db.aIGeneration.updateMany({
      where: { sessionId },
      data: { sessionData: null },
    });

    console.log(
      `[Session Cache] 🗑️ Cleared session ${sessionId} from database`
    );
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
 * Check if a session exists in the database
 *
 * @param db - Prisma database client
 * @param sessionId - The Claude session ID to check
 * @returns true if session exists with data
 */
export async function hasSessionInDB(
  db: PrismaClient,
  sessionId: string
): Promise<boolean> {
  try {
    const count = await db.aIGeneration.count({
      where: {
        sessionId,
        sessionData: { not: null },
      },
    });
    return count > 0;
  } catch (error) {
    console.error(
      `[Session Cache] ❌ Failed to check session ${sessionId}:`,
      error
    );
    return false;
  }
}

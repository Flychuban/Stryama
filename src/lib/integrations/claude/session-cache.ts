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

import { readFile, writeFile, mkdir, readdir } from 'fs/promises';
import { dirname, join } from 'path';
import type { PrismaClient } from '@prisma/client';

/**
 * Find the session file by searching the Claude projects directory
 * Claude stores sessions at: ~/.claude/projects/{cwd-based-slug}/{session-id}.jsonl
 * The slug is derived from the working directory, not our projectId
 */
async function findSessionFilePath(sessionId: string): Promise<string | null> {
  const claudeProjectsDir = '/tmp/.claude/projects';

  try {
    // List all subdirectories in /tmp/.claude/projects/
    const dirs = await readdir(claudeProjectsDir);

    // Search each directory for the session file
    for (const dir of dirs) {
      const sessionPath = join(claudeProjectsDir, dir, `${sessionId}.jsonl`);
      try {
        await readFile(sessionPath);
        return sessionPath; // Found it!
      } catch {
        continue; // File doesn't exist in this directory
      }
    }

    return null; // Session file not found
  } catch (error) {
    console.error('[Session Cache] Error searching for session file:', error);
    return null;
  }
}

/**
 * Get the expected session file path for restoration
 * We need to determine the correct subdirectory where Claude expects the file
 */
async function getOrCreateSessionPath(sessionId: string): Promise<string> {
  // Try to find existing session file first
  const existingPath = await findSessionFilePath(sessionId);
  if (existingPath) {
    return existingPath;
  }

  // If not found, Claude will create it in a new directory based on CWD
  // We need to use a consistent directory for restoration
  // Use a generic 'default' slug
  const defaultPath = `/tmp/.claude/projects/-default-/${sessionId}.jsonl`;
  return defaultPath;
}

/**
 * Save a Claude session file to the database
 *
 * Call this AFTER a Claude generation completes to persist the session state.
 *
 * @param db - Prisma database client
 * @param sessionId - The Claude session ID returned from the SDK
 * @param projectId - The project ID (used to find the AIGeneration record)
 * @returns true if saved successfully, false otherwise
 */
export async function saveSessionToDB(
  db: PrismaClient,
  sessionId: string,
  projectId: string
): Promise<boolean> {
  try {
    // Find the session file by searching for it
    const sessionPath = await findSessionFilePath(sessionId);

    if (!sessionPath) {
      console.warn(
        `[Session Cache] ⚠️ Session file not found for ${sessionId}`
      );
      return false;
    }

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

    // Get the path where Claude expects the session file
    const sessionPath = await getOrCreateSessionPath(sessionId);

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

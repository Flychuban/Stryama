/**
 * Claude Session Cache
 *
 * Manages Claude Agent SDK session file persistence in ephemeral environments.
 *
 * The Claude SDK stores conversation state in ~/.claude/ filesystem. In serverless/container environments:
 * - HOME is set to /tmp (for write access)
 * - /tmp is wiped between invocations
 * - This causes "No conversation found" errors on subsequent prompts
 *
 * Solution: Store session files in Postgres database between invocations.
 */

import { readFile, writeFile, mkdir, readdir, stat } from 'fs/promises';
import { dirname, join } from 'path';
import type { PrismaClient } from '@prisma/client';

const CLAUDE_PROJECTS_DIR = '/tmp/.claude/projects';
const MAX_SESSION_FILE_SIZE = 10 * 1024 * 1024; // 10MB limit

/**
 * Get the project directory name based on current working directory.
 * This matches the Claude SDK's internal algorithm for project isolation.
 *
 * Examples:
 * - /var/task → -var-task (AWS Lambda/Serverless)
 * - /Users/name/Desktop/Project → -Users-name-Desktop-Project (local)
 */
function getProjectDirName(): string {
  return process.cwd().replace(/\//g, '-');
}

/**
 * Find the session file by searching the Claude projects directory
 */
async function findSessionFilePath(sessionId: string): Promise<string | null> {
  try {
    // Check if directory exists first
    try {
      await readdir(CLAUDE_PROJECTS_DIR);
    } catch {
      return null; // Directory doesn't exist yet
    }

    // Search each subdirectory for the session file
    const dirs = await readdir(CLAUDE_PROJECTS_DIR);
    for (const dir of dirs) {
      const sessionPath = join(CLAUDE_PROJECTS_DIR, dir, `${sessionId}.jsonl`);
      try {
        const stats = await stat(sessionPath);
        if (stats.size > MAX_SESSION_FILE_SIZE) {
          console.warn(
            `[Session Cache] Session file too large: ${stats.size} bytes`
          );
          continue;
        }
        return sessionPath;
      } catch {
        continue;
      }
    }

    return null;
  } catch (error) {
    console.error('[Session Cache] Error searching for session:', error);
    return null;
  }
}

/**
 * Get the expected session file path for restoration
 */
async function getOrCreateSessionPath(sessionId: string): Promise<string> {
  const existingPath = await findSessionFilePath(sessionId);
  if (existingPath) {
    return existingPath;
  }
  // Use project-specific directory (matches Claude SDK behavior)
  const projectDir = getProjectDirName();
  return join(CLAUDE_PROJECTS_DIR, projectDir, `${sessionId}.jsonl`);
}

/**
 * Save a Claude session file to the database
 */
export async function saveSessionToDB(
  db: PrismaClient,
  sessionId: string
): Promise<boolean> {
  try {
    const sessionPath = await findSessionFilePath(sessionId);
    if (!sessionPath) {
      return false; // Session file not found (normal for some cases)
    }

    // Check file size before reading
    const stats = await stat(sessionPath);
    if (stats.size > MAX_SESSION_FILE_SIZE) {
      console.error(
        `[Session Cache] Session file too large: ${stats.size} bytes`
      );
      return false;
    }

    const sessionData = await readFile(sessionPath, 'utf-8');

    // Find and update the AIGeneration record
    const generation = await db.aIGeneration.findFirst({
      where: { sessionId },
      orderBy: { createdAt: 'desc' },
    });

    if (!generation) {
      return false; // No record to update
    }

    await db.aIGeneration.update({
      where: { id: generation.id },
      data: { sessionData },
    });

    console.log(
      `[Session Cache] ✅ Saved session ${sessionId} (${sessionData.length} bytes)`
    );
    return true;
  } catch (error) {
    console.error(
      `[Session Cache] Failed to save session ${sessionId}:`,
      error
    );
    return false;
  }
}

/**
 * Restore a Claude session file from the database
 */
export async function restoreSessionFromDB(
  db: PrismaClient,
  sessionId: string
): Promise<boolean> {
  try {
    const generation = await db.aIGeneration.findFirst({
      where: {
        sessionId,
        sessionData: { not: null },
      },
      orderBy: { createdAt: 'desc' },
      select: { sessionData: true },
    });

    if (!generation?.sessionData) {
      return false; // No session to restore
    }

    // Verify size
    if (generation.sessionData.length > MAX_SESSION_FILE_SIZE) {
      console.error(
        `[Session Cache] Session data too large: ${generation.sessionData.length} bytes`
      );
      return false;
    }

    const sessionPath = await getOrCreateSessionPath(sessionId);
    await mkdir(dirname(sessionPath), { recursive: true });
    await writeFile(sessionPath, generation.sessionData, 'utf-8');

    console.log(
      `[Session Cache] ✅ Restored session ${sessionId} (${generation.sessionData.length} bytes)`
    );
    return true;
  } catch (error) {
    console.error(
      `[Session Cache] Failed to restore session ${sessionId}:`,
      error
    );
    return false;
  }
}

/**
 * Clear session data from the database
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
    return true;
  } catch (error) {
    console.error(
      `[Session Cache] Failed to clear session ${sessionId}:`,
      error
    );
    return false;
  }
}

/**
 * Check if a session exists in the database
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
      `[Session Cache] Failed to check session ${sessionId}:`,
      error
    );
    return false;
  }
}

/**
 * Verify that a session file exists on the filesystem
 * This is critical in serverless environments where files may not persist
 */
export async function verifySessionFileExists(
  sessionId: string
): Promise<{ exists: boolean; path: string | null; processId: number }> {
  const processId = process.pid;

  try {
    const sessionPath = await findSessionFilePath(sessionId);

    if (!sessionPath) {
      console.log(
        `[Session Cache] ❌ Session file NOT found for ${sessionId} (process ${processId})`
      );
      return { exists: false, path: null, processId };
    }

    // Verify the file is actually readable
    try {
      const stats = await stat(sessionPath);
      console.log(
        `[Session Cache] ✅ Session file verified: ${sessionPath} (${stats.size} bytes, process ${processId})`
      );
      return { exists: true, path: sessionPath, processId };
    } catch (error) {
      console.error(
        `[Session Cache] ❌ Session file found but not readable: ${sessionPath} (process ${processId})`,
        error
      );
      return { exists: false, path: sessionPath, processId };
    }
  } catch (error) {
    console.error(
      `[Session Cache] Error verifying session ${sessionId} (process ${processId}):`,
      error
    );
    return { exists: false, path: null, processId };
  }
}

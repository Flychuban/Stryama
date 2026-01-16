/**
 * E2B Custom MCP Tools for Claude Agent SDK
 *
 * These tools allow Claude to interact directly with E2B sandboxes,
 * writing files and executing commands without touching the local filesystem.
 */

import { tool, createSdkMcpServer } from '@anthropic-ai/claude-agent-sdk';
import { z } from 'zod';
import type { Sandbox } from '@e2b/code-interpreter';
import { sandboxManager } from '~/lib/integrations/e2b';
import type { PrismaClient } from '@prisma/client';
import { logger } from '~/lib/utils/logger';

/**
 * Get a sandbox instance from the sandbox manager's cache
 */
async function getSandbox(
  sandboxId: string,
  db: PrismaClient
): Promise<Sandbox> {
  // Use the sandbox manager's cache (single source of truth)
  const cachedInstance = sandboxManager.getCachedInstance(sandboxId);
  if (cachedInstance) {
    logger.debug(`[E2B Tools] Using cached sandbox instance: ${sandboxId}`);

    // Validate cached instance is still alive
    try {
      await cachedInstance.getInfo();
      logger.debug(`[E2B Tools] ✅ Cached sandbox is valid`);
      return cachedInstance;
    } catch (error) {
      logger.error(`[E2B Tools] ❌ Cached sandbox is dead:`, error);
      // Fall through to resume
    }
  }

  // Resume the sandbox (will connect if it's active but not cached)
  logger.debug(`[E2B Tools] Resuming sandbox: ${sandboxId}`);
  const result = await sandboxManager.resumeSandbox(db, sandboxId);

  if (!result.success || !result.data) {
    // If sandbox is dead (404), mark as STOPPED to prevent repeated attempts
    if (
      result.error?.includes('404') ||
      result.error?.includes("doesn't exist")
    ) {
      logger.error(
        `[E2B Tools] ❌ Sandbox ${sandboxId} is dead (404), marking as STOPPED`
      );
      try {
        await db.sandbox.update({
          where: { id: sandboxId },
          data: { status: 'STOPPED' },
        });
      } catch (dbError) {
        logger.error(`[E2B Tools] Failed to update sandbox status:`, dbError);
      }
    }
    throw new Error(
      `Failed to resume sandbox ${sandboxId}: ${result.error ?? 'Unknown error'}`
    );
  }

  // Sandbox is now cached by the manager
  logger.debug(`[E2B Tools] Successfully resumed sandbox: ${sandboxId}`);
  return result.data;
}

/**
 * Create all E2B custom tools for Claude Agent SDK
 */
export function createE2BTools(db: PrismaClient) {
  /**
   * E2B_Write: Write a file to the E2B sandbox filesystem
   */
  const E2B_Write = tool(
    'E2B_Write',
    'Write a file to the E2B sandbox filesystem. Use this instead of the Write tool to ensure files are created in the sandbox environment.',
    {
      sandbox_id: z.string().describe('The ID of the E2B sandbox'),
      file_path: z
        .string()
        .describe(
          'The path where to write the file (e.g., "src/App.tsx", "package.json")'
        ),
      content: z.string().describe('The complete content to write to the file'),
    },
    async (args) => {
      try {
        logger.debug(
          `[E2B Tool] Writing file: ${args.file_path} to sandbox ${args.sandbox_id}`
        );

        const sandbox = await getSandbox(args.sandbox_id, db);

        // Write file to /project/ directory in sandbox
        const fullPath = args.file_path.startsWith('/')
          ? args.file_path
          : `/project/${args.file_path}`;

        await sandbox.files.write(fullPath, args.content);

        logger.debug(`[E2B Tool] ✅ Successfully wrote: ${fullPath}`);

        return {
          content: [
            {
              type: 'text' as const,
              text: `Successfully wrote file to sandbox: ${args.file_path}\nLocation: ${fullPath}`,
            },
          ],
        };
      } catch (error) {
        logger.error(`[E2B Tool] ❌ Error writing file:`, error);
        return {
          content: [
            {
              type: 'text' as const,
              text: `Error writing file: ${error instanceof Error ? error.message : 'Unknown error'}`,
            },
          ],
          isError: true,
        };
      }
    }
  );

  /**
   * E2B_Read: Read a file from the E2B sandbox filesystem
   */
  const E2B_Read = tool(
    'E2B_Read',
    'Read a file from the E2B sandbox filesystem. Use this to check if files exist or read their contents.',
    {
      sandbox_id: z.string().describe('The ID of the E2B sandbox'),
      file_path: z.string().describe('The path of the file to read'),
    },
    async (args) => {
      try {
        logger.debug(
          `[E2B Tool] Reading file: ${args.file_path} from sandbox ${args.sandbox_id}`
        );

        const sandbox = await getSandbox(args.sandbox_id, db);

        const fullPath = args.file_path.startsWith('/')
          ? args.file_path
          : `/project/${args.file_path}`;

        const content = await sandbox.files.read(fullPath);

        logger.debug(
          `[E2B Tool] ✅ Successfully read: ${fullPath} (${content.length} bytes)`
        );

        return {
          content: [
            {
              type: 'text' as const,
              text: `File: ${args.file_path}\n\n${content}`,
            },
          ],
        };
      } catch (error) {
        logger.error(`[E2B Tool] ❌ Error reading file:`, error);
        return {
          content: [
            {
              type: 'text' as const,
              text: `Error reading file: ${error instanceof Error ? error.message : 'Unknown error'}`,
            },
          ],
          isError: true,
        };
      }
    }
  );

  /**
   * E2B_Bash: Execute a bash command in the E2B sandbox
   */
  const E2B_Bash = tool(
    'E2B_Bash',
    'Execute a bash command in the E2B sandbox. Use this for npm install, npm run dev, and other shell commands. Dev servers (npm run dev, npm start) run in background automatically.',
    {
      sandbox_id: z.string().describe('The ID of the E2B sandbox'),
      command: z
        .string()
        .describe(
          'The bash command to execute (e.g., "npm install", "npm run dev")'
        ),
      cwd: z
        .string()
        .optional()
        .describe('Working directory for the command (defaults to /project)'),
    },
    async (args) => {
      try {
        logger.debug(
          `[E2B Tool] Executing command in sandbox ${args.sandbox_id}: ${args.command}`
        );

        const sandbox = await getSandbox(args.sandbox_id, db);

        const workingDir = args.cwd ?? '/project';

        // Detect if this is a dev server command (should run in background)
        const isDevServer =
          args.command.includes('npm run dev') ||
          args.command.includes('npm start') ||
          args.command.includes('vite') ||
          args.command.includes('next dev');

        // Execute command in sandbox
        const process = await sandbox.commands.run(args.command, {
          cwd: workingDir,
          background: isDevServer, // Dev servers run in background
          timeoutMs: isDevServer ? 5000 : 300000, // 5s for dev server start, 5min for other commands
        });

        if (isDevServer) {
          const pid = 'pid' in process ? process.pid : 'unknown';
          logger.debug(
            `[E2B Tool] ✅ Dev server started in background with PID: ${pid}`
          );

          // Store dev server PID in sandbox metadata for preview manager coordination
          if (typeof pid === 'number') {
            try {
              await db.sandbox.update({
                where: { id: args.sandbox_id },
                data: {
                  metadata: {
                    devServerPid: pid,
                    devServerStartedAt: new Date().toISOString(),
                    devServerPort: 5173, // Default Vite port
                    devServerCommand: args.command,
                  },
                },
              });
              logger.debug(
                `[E2B Tool] ✅ Stored dev server metadata in database (PID: ${pid})`
              );
            } catch (dbError) {
              logger.error(
                `[E2B Tool] ⚠️ Failed to store dev server metadata:`,
                dbError
              );
              // Don't fail the operation if metadata storage fails
            }
          }

          return {
            content: [
              {
                type: 'text' as const,
                text: `Dev server started successfully in background.\nCommand: ${args.command}\nPID: ${pid}\nThe server is now running and ready to serve your application.`,
              },
            ],
          };
        }

        const output = [
          `Command: ${args.command}`,
          `Working Directory: ${workingDir}`,
          `Exit Code: ${process.exitCode}`,
          process.stdout ? `\nSTDOUT:\n${process.stdout}` : '',
          process.stderr ? `\nSTDERR:\n${process.stderr}` : '',
        ]
          .filter(Boolean)
          .join('\n');

        logger.debug(
          `[E2B Tool] ✅ Command completed with exit code: ${process.exitCode}`
        );

        return {
          content: [
            {
              type: 'text' as const,
              text: output,
            },
          ],
          isError: process.exitCode !== 0,
        };
      } catch (error) {
        logger.error(`[E2B Tool] ❌ Error executing command:`, error);
        return {
          content: [
            {
              type: 'text' as const,
              text: `Error executing command: ${error instanceof Error ? error.message : 'Unknown error'}`,
            },
          ],
          isError: true,
        };
      }
    }
  );

  /**
   * E2B_List: List files in a directory in the E2B sandbox
   */
  const E2B_List = tool(
    'E2B_List',
    'List files and directories in the E2B sandbox. Useful for checking what files exist.',
    {
      sandbox_id: z.string().describe('The ID of the E2B sandbox'),
      directory: z
        .string()
        .default('/project')
        .describe('The directory to list (defaults to /project)'),
    },
    async (args) => {
      try {
        logger.debug(
          `[E2B Tool] Listing directory: ${args.directory} in sandbox ${args.sandbox_id}`
        );

        const sandbox = await getSandbox(args.sandbox_id, db);

        // Use ls command to list files
        const process = await sandbox.commands.run(`ls -la ${args.directory}`);

        logger.debug(`[E2B Tool] ✅ Listed directory: ${args.directory}`);

        return {
          content: [
            {
              type: 'text' as const,
              text: `Directory listing for ${args.directory}:\n\n${process.stdout}`,
            },
          ],
        };
      } catch (error) {
        logger.error(`[E2B Tool] ❌ Error listing directory:`, error);
        return {
          content: [
            {
              type: 'text' as const,
              text: `Error listing directory: ${error instanceof Error ? error.message : 'Unknown error'}`,
            },
          ],
          isError: true,
        };
      }
    }
  );

  /**
   * E2B_GetPreviewURL: Get the preview URL for a running app in the E2B sandbox
   */
  const E2B_GetPreviewURL = tool(
    'E2B_GetPreviewURL',
    'Get the preview URL for a running application in the E2B sandbox. Use this after starting a dev server.',
    {
      sandbox_id: z.string().describe('The ID of the E2B sandbox'),
      port: z
        .number()
        .default(3000)
        .describe('The port the app is running on (default: 3000)'),
    },
    async (args) => {
      try {
        logger.debug(
          `[E2B Tool] Getting preview URL for sandbox ${args.sandbox_id} on port ${args.port}`
        );

        const sandbox = await getSandbox(args.sandbox_id, db);

        // CRITICAL: Validate E2B sandbox is accessible before generating URL
        logger.debug(`[E2B Tool] Validating sandbox is accessible...`);
        try {
          const sandboxInfo = await sandbox.getInfo();
          logger.debug(
            `[E2B Tool] ✅ Sandbox validated - E2B ID: ${sandboxInfo.sandboxId}`
          );
        } catch (validationError) {
          logger.error(
            `[E2B Tool] ❌ Sandbox validation failed:`,
            validationError
          );
          return {
            content: [
              {
                type: 'text' as const,
                text: `Error: E2B sandbox is not accessible. The sandbox may have expired or been destroyed.\n\nDetails: ${validationError instanceof Error ? validationError.message : 'Unknown error'}\n\nPlease inform the user that the sandbox is no longer available and they should try regenerating the code.`,
              },
            ],
            isError: true,
          };
        }

        // Get the public URL for the sandbox
        const url = sandbox.getHost(args.port);

        logger.debug(`[E2B Tool] ✅ Preview URL: ${url}`);

        return {
          content: [
            {
              type: 'text' as const,
              text: `Preview URL: https://${url}\n\nThe application is accessible at this URL. Share this with the user.`,
            },
          ],
        };
      } catch (error) {
        logger.error(`[E2B Tool] ❌ Error getting preview URL:`, error);
        return {
          content: [
            {
              type: 'text' as const,
              text: `Error getting preview URL: ${error instanceof Error ? error.message : 'Unknown error'}`,
            },
          ],
          isError: true,
        };
      }
    }
  );

  /**
   * Create and return the MCP server with all E2B tools
   */
  return createSdkMcpServer({
    name: 'e2b-sandbox',
    version: '1.0.0',
    tools: [E2B_Write, E2B_Read, E2B_Bash, E2B_List, E2B_GetPreviewURL],
  });
}

/**
 * Clear the sandbox cache (delegated to sandbox manager)
 */
export function clearSandboxCache(_sandboxId?: string) {
  // Cache management is now handled by SandboxManager
  // This function is kept for backwards compatibility
  logger.debug(`[E2B Tools] Cache clearing delegated to SandboxManager`);
}

/* eslint-disable @typescript-eslint/unbound-method */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/no-explicit-any */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { saveGeneratedFilesToDatabase, type GeneratedFile } from './file-saver';
import { prismaMock, resetDb } from '~/__tests__/helpers/db';
import { mockSandbox } from '~/__tests__/mocks/e2b';

// Mock the sandbox manager
vi.mock('../services/sandbox-manager', () => ({
  sandboxManager: {
    readAllFiles: vi.fn(),
  },
}));

// Mock file filtering utilities
vi.mock('~/lib/utils/file-filtering', () => ({
  filterApplicationFiles: vi.fn((files: GeneratedFile[]) => ({
    filesToSave: files.filter(
      (f: GeneratedFile) =>
        !['package.json', 'vite.config.ts', 'tsconfig.json'].includes(f.path)
    ),
    filtered: files.filter((f: GeneratedFile) =>
      ['package.json', 'vite.config.ts', 'tsconfig.json'].includes(f.path)
    ),
  })),
  logFilteringResults: vi.fn(),
}));

describe('saveGeneratedFilesToDatabase', () => {
  const testProjectId = 'project_test123';
  const logPrefix = '[Test]';

  beforeEach(() => {
    resetDb();
    vi.clearAllMocks();
  });

  describe('direct mode (files from Claude response)', () => {
    it('should save files directly from response', async () => {
      // Arrange
      const responseFiles: GeneratedFile[] = [
        {
          path: 'src/App.tsx',
          content: 'import React from "react";',
          language: 'typescript',
        },
        {
          path: 'src/index.css',
          content: 'body { margin: 0; }',
          language: 'css',
        },
      ];

      prismaMock.file.upsert.mockResolvedValue({
        id: 'file_1',
        path: 'src/App.tsx',
        content: 'import React from "react";',
        language: 'typescript',
        projectId: testProjectId,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      // Act
      await saveGeneratedFilesToDatabase(
        prismaMock,
        testProjectId,
        undefined,
        responseFiles,
        logPrefix
      );

      // Assert
      expect(prismaMock.file.upsert).toHaveBeenCalledTimes(2);
      expect(prismaMock.file.upsert).toHaveBeenCalledWith({
        where: {
          projectId_path: {
            projectId: testProjectId,
            path: 'src/App.tsx',
          },
        },
        create: {
          path: 'src/App.tsx',
          content: 'import React from "react";',
          language: 'typescript',
          projectId: testProjectId,
        },
        update: {
          content: 'import React from "react";',
          language: 'typescript',
          updatedAt: expect.any(Date),
        },
      });
    });

    it('should handle empty file list gracefully', async () => {
      // Arrange
      const responseFiles: GeneratedFile[] = [];

      // Act
      await saveGeneratedFilesToDatabase(
        prismaMock,
        testProjectId,
        undefined,
        responseFiles,
        logPrefix
      );

      // Assert
      expect(prismaMock.file.upsert).not.toHaveBeenCalled();
    });

    it('should save files with various languages', async () => {
      // Arrange
      const responseFiles: GeneratedFile[] = [
        { path: 'App.tsx', content: 'tsx content', language: 'typescript' },
        { path: 'styles.css', content: 'css content', language: 'css' },
        { path: 'index.html', content: 'html content', language: 'html' },
        { path: 'config.json', content: '{}', language: 'json' },
      ];

      prismaMock.file.upsert.mockResolvedValue({} as any);

      // Act
      await saveGeneratedFilesToDatabase(
        prismaMock,
        testProjectId,
        undefined,
        responseFiles,
        logPrefix
      );

      // Assert
      expect(prismaMock.file.upsert).toHaveBeenCalledTimes(4);

      // Verify each language is preserved
      const calls = prismaMock.file.upsert.mock.calls;
      expect(calls[0]![0].create.language).toBe('typescript');
      expect(calls[1]![0].create.language).toBe('css');
      expect(calls[2]![0].create.language).toBe('html');
      expect(calls[3]![0].create.language).toBe('json');
    });
  });

  describe('E2B mode (files from sandbox)', () => {
    it('should read and save files from sandbox when response is empty', async () => {
      // Arrange
      const { sandboxManager } = await import('../services/sandbox-manager');

      const sandboxFiles: GeneratedFile[] = [
        {
          path: 'src/App.tsx',
          content: 'sandbox content',
          language: 'typescript',
        },
        {
          path: 'src/main.tsx',
          content: 'main content',
          language: 'typescript',
        },
        { path: 'package.json', content: '{}', language: 'json' }, // Will be filtered
      ];

      vi.mocked(sandboxManager.readAllFiles).mockResolvedValue({
        success: true,
        data: sandboxFiles,
        error: null,
      });

      prismaMock.file.upsert.mockResolvedValue({} as any);

      // Act
      await saveGeneratedFilesToDatabase(
        prismaMock,
        testProjectId,
        mockSandbox as any,
        [], // Empty response files
        logPrefix
      );

      // Assert
      expect(sandboxManager.readAllFiles).toHaveBeenCalledWith(mockSandbox);

      // Should save 2 files (package.json filtered out)
      expect(prismaMock.file.upsert).toHaveBeenCalledTimes(2);
    });

    it('should filter out infrastructure files from sandbox', async () => {
      // Arrange
      const { sandboxManager } = await import('../services/sandbox-manager');

      const sandboxFiles: GeneratedFile[] = [
        { path: 'src/App.tsx', content: 'app content', language: 'typescript' },
        { path: 'package.json', content: '{}', language: 'json' }, // Infrastructure
        { path: 'vite.config.ts', content: 'config', language: 'typescript' }, // Infrastructure
        { path: 'tsconfig.json', content: '{}', language: 'json' }, // Infrastructure
      ];

      vi.mocked(sandboxManager.readAllFiles).mockResolvedValue({
        success: true,
        data: sandboxFiles,
        error: null,
      });

      prismaMock.file.upsert.mockResolvedValue({} as any);

      // Act
      await saveGeneratedFilesToDatabase(
        prismaMock,
        testProjectId,
        mockSandbox as any,
        [],
        logPrefix
      );

      // Assert - Only application file should be saved
      expect(prismaMock.file.upsert).toHaveBeenCalledTimes(1);
      expect(prismaMock.file.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            projectId_path: {
              projectId: testProjectId,
              path: 'src/App.tsx',
            },
          },
        })
      );
    });

    it('should handle sandbox read failure gracefully', async () => {
      // Arrange
      const { sandboxManager } = await import('../services/sandbox-manager');

      vi.mocked(sandboxManager.readAllFiles).mockResolvedValue({
        success: false,
        data: null,
        error: 'Failed to read sandbox files',
      });

      // Act
      await saveGeneratedFilesToDatabase(
        prismaMock,
        testProjectId,
        mockSandbox as any,
        [],
        logPrefix
      );

      // Assert - Should not attempt to save any files
      expect(prismaMock.file.upsert).not.toHaveBeenCalled();
    });

    it('should prefer response files over sandbox files when both exist', async () => {
      // Arrange
      const { sandboxManager } = await import('../services/sandbox-manager');

      const responseFiles: GeneratedFile[] = [
        {
          path: 'src/App.tsx',
          content: 'response content',
          language: 'typescript',
        },
      ];

      // Sandbox should not be read if response has files
      vi.mocked(sandboxManager.readAllFiles).mockResolvedValue({
        success: true,
        data: [
          {
            path: 'src/App.tsx',
            content: 'sandbox content',
            language: 'typescript',
          },
        ],
        error: null,
      });

      prismaMock.file.upsert.mockResolvedValue({} as any);

      // Act
      await saveGeneratedFilesToDatabase(
        prismaMock,
        testProjectId,
        mockSandbox as any,
        responseFiles,
        logPrefix
      );

      // Assert - Should NOT read from sandbox
      expect(sandboxManager.readAllFiles).not.toHaveBeenCalled();

      // Should save response files
      expect(prismaMock.file.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({
            content: 'response content',
          }),
        })
      );
    });
  });

  describe('upsert behavior', () => {
    it('should create new file if it does not exist', async () => {
      // Arrange
      const responseFiles: GeneratedFile[] = [
        {
          path: 'new-file.tsx',
          content: 'new content',
          language: 'typescript',
        },
      ];

      prismaMock.file.upsert.mockResolvedValue({
        id: 'file_new',
        path: 'new-file.tsx',
        content: 'new content',
        language: 'typescript',
        projectId: testProjectId,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      // Act
      await saveGeneratedFilesToDatabase(
        prismaMock,
        testProjectId,
        undefined,
        responseFiles,
        logPrefix
      );

      // Assert
      expect(prismaMock.file.upsert).toHaveBeenCalledWith({
        where: {
          projectId_path: {
            projectId: testProjectId,
            path: 'new-file.tsx',
          },
        },
        create: {
          path: 'new-file.tsx',
          content: 'new content',
          language: 'typescript',
          projectId: testProjectId,
        },
        update: {
          content: 'new content',
          language: 'typescript',
          updatedAt: expect.any(Date),
        },
      });
    });

    it('should update existing file with new content', async () => {
      // Arrange
      const responseFiles: GeneratedFile[] = [
        {
          path: 'existing-file.tsx',
          content: 'updated content',
          language: 'typescript',
        },
      ];

      prismaMock.file.upsert.mockResolvedValue({
        id: 'file_existing',
        path: 'existing-file.tsx',
        content: 'updated content',
        language: 'typescript',
        projectId: testProjectId,
        createdAt: new Date('2025-01-01'),
        updatedAt: new Date(), // Updated timestamp
      });

      // Act
      await saveGeneratedFilesToDatabase(
        prismaMock,
        testProjectId,
        undefined,
        responseFiles,
        logPrefix
      );

      // Assert - Verify update block is populated correctly
      expect(prismaMock.file.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          update: {
            content: 'updated content',
            language: 'typescript',
            updatedAt: expect.any(Date),
          },
        })
      );
    });

    it('should handle concurrent upserts for multiple files', async () => {
      // Arrange
      const responseFiles: GeneratedFile[] = [
        { path: 'file1.tsx', content: 'content1', language: 'typescript' },
        { path: 'file2.tsx', content: 'content2', language: 'typescript' },
        { path: 'file3.css', content: 'content3', language: 'css' },
      ];

      prismaMock.file.upsert.mockResolvedValue({} as any);

      // Act
      await saveGeneratedFilesToDatabase(
        prismaMock,
        testProjectId,
        undefined,
        responseFiles,
        logPrefix
      );

      // Assert - All files should be saved concurrently (Promise.all)
      expect(prismaMock.file.upsert).toHaveBeenCalledTimes(3);
    });
  });

  describe('edge cases', () => {
    it('should handle files with special characters in path', async () => {
      // Arrange
      const responseFiles: GeneratedFile[] = [
        {
          path: 'src/components/Button@v2.tsx',
          content: 'button',
          language: 'typescript',
        },
        { path: 'styles/theme-dark.css', content: 'theme', language: 'css' },
      ];

      prismaMock.file.upsert.mockResolvedValue({} as any);

      // Act
      await saveGeneratedFilesToDatabase(
        prismaMock,
        testProjectId,
        undefined,
        responseFiles,
        logPrefix
      );

      // Assert
      expect(prismaMock.file.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            projectId_path: {
              projectId: testProjectId,
              path: 'src/components/Button@v2.tsx',
            },
          },
        })
      );
    });

    it('should handle very large file content', async () => {
      // Arrange
      const largeContent = 'a'.repeat(100000); // 100KB file
      const responseFiles: GeneratedFile[] = [
        {
          path: 'large-file.tsx',
          content: largeContent,
          language: 'typescript',
        },
      ];

      prismaMock.file.upsert.mockResolvedValue({} as any);

      // Act
      await saveGeneratedFilesToDatabase(
        prismaMock,
        testProjectId,
        undefined,
        responseFiles,
        logPrefix
      );

      // Assert
      expect(prismaMock.file.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({
            content: largeContent,
          }),
        })
      );
    });

    it('should handle empty file content', async () => {
      // Arrange
      const responseFiles: GeneratedFile[] = [
        { path: 'empty.tsx', content: '', language: 'typescript' },
      ];

      prismaMock.file.upsert.mockResolvedValue({} as any);

      // Act
      await saveGeneratedFilesToDatabase(
        prismaMock,
        testProjectId,
        undefined,
        responseFiles,
        logPrefix
      );

      // Assert
      expect(prismaMock.file.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({
            content: '',
          }),
        })
      );
    });

    it('should handle database error during upsert', async () => {
      // Arrange
      const responseFiles: GeneratedFile[] = [
        { path: 'file.tsx', content: 'content', language: 'typescript' },
      ];

      prismaMock.file.upsert.mockRejectedValue(
        new Error('Database connection failed')
      );

      // Act & Assert - Should propagate error
      await expect(
        saveGeneratedFilesToDatabase(
          prismaMock,
          testProjectId,
          undefined,
          responseFiles,
          logPrefix
        )
      ).rejects.toThrow('Database connection failed');
    });

    it('should save files with nested directory paths', async () => {
      // Arrange
      const responseFiles: GeneratedFile[] = [
        {
          path: 'src/components/ui/buttons/PrimaryButton.tsx',
          content: 'button component',
          language: 'typescript',
        },
      ];

      prismaMock.file.upsert.mockResolvedValue({} as any);

      // Act
      await saveGeneratedFilesToDatabase(
        prismaMock,
        testProjectId,
        undefined,
        responseFiles,
        logPrefix
      );

      // Assert
      expect(prismaMock.file.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            projectId_path: {
              projectId: testProjectId,
              path: 'src/components/ui/buttons/PrimaryButton.tsx',
            },
          },
        })
      );
    });
  });

  describe('logging behavior', () => {
    it('should call filtering utilities when reading from sandbox', async () => {
      // Arrange
      const { sandboxManager } = await import('../services/sandbox-manager');
      const { filterApplicationFiles, logFilteringResults } = await import(
        '~/lib/utils/file-filtering'
      );

      const sandboxFiles: GeneratedFile[] = [
        { path: 'src/App.tsx', content: 'app', language: 'typescript' },
      ];

      vi.mocked(sandboxManager.readAllFiles).mockResolvedValue({
        success: true,
        data: sandboxFiles,
        error: null,
      });

      prismaMock.file.upsert.mockResolvedValue({} as any);

      // Act
      await saveGeneratedFilesToDatabase(
        prismaMock,
        testProjectId,
        mockSandbox as any,
        [],
        logPrefix
      );

      // Assert
      expect(filterApplicationFiles).toHaveBeenCalledWith(sandboxFiles);
      expect(logFilteringResults).toHaveBeenCalled();
    });
  });
});

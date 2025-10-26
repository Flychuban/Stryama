import type { GeneratedFile, ProjectFile } from '../types';

export enum ConflictType {
  OVERWRITE = 'overwrite',
  COMPATIBLE = 'compatible',
  NO_CONFLICT = 'no_conflict',
}

export type FileConflict = {
  readonly file: GeneratedFile;
  readonly existingFile?: ProjectFile;
  readonly conflictType: ConflictType;
  readonly recommendation: string;
};

export class ConflictDetector {
  static detectConflicts(
    generatedFiles: readonly GeneratedFile[],
    existingFiles: readonly ProjectFile[]
  ): FileConflict[] {
    const conflicts: FileConflict[] = [];

    for (const genFile of generatedFiles) {
      const existingFile = existingFiles.find((f) => f.path === genFile.path);

      if (!existingFile) {
        conflicts.push({
          file: genFile,
          conflictType: ConflictType.NO_CONFLICT,
          recommendation: 'Safe to create new file',
        });
        continue;
      }

      const compatibility = this.analyzeCompatibility(genFile, existingFile);

      conflicts.push({
        file: genFile,
        existingFile,
        conflictType: compatibility.type,
        recommendation: compatibility.recommendation,
      });
    }

    return conflicts;
  }

  private static analyzeCompatibility(
    generated: GeneratedFile,
    existing: ProjectFile
  ): { type: ConflictType; recommendation: string } {
    if (generated.content.trim() === existing.content.trim()) {
      return {
        type: ConflictType.COMPATIBLE,
        recommendation: 'No changes needed',
      };
    }

    const isAdditive = generated.content.includes(existing.content.trim());
    if (isAdditive) {
      return {
        type: ConflictType.COMPATIBLE,
        recommendation: 'Additive changes detected - safe to apply',
      };
    }

    const similarity = this.calculateSimilarity(
      generated.content,
      existing.content
    );

    if (similarity > 0.8) {
      return {
        type: ConflictType.COMPATIBLE,
        recommendation: 'Minor changes detected - review before applying',
      };
    }

    return {
      type: ConflictType.OVERWRITE,
      recommendation:
        'Significant changes detected - confirm before overwriting',
    };
  }

  private static calculateSimilarity(str1: string, str2: string): number {
    const set1 = new Set(str1.split(/\s+/));
    const set2 = new Set(str2.split(/\s+/));

    const intersection = new Set([...set1].filter((x) => set2.has(x)));
    const union = new Set([...set1, ...set2]);

    return intersection.size / union.size;
  }

  static hasCriticalConflicts(conflicts: readonly FileConflict[]): boolean {
    return conflicts.some((c) => c.conflictType === ConflictType.OVERWRITE);
  }

  static getSafeFiles(conflicts: readonly FileConflict[]): GeneratedFile[] {
    return conflicts
      .filter((c) => c.conflictType !== ConflictType.OVERWRITE)
      .map((c) => c.file);
  }
}

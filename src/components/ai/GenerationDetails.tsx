'use client';

/**
 * Generation Details Component
 *
 * Displays detailed information about a single AI code generation.
 * Shows the full prompt, generated files with code, and metadata.
 */

import React, { useState } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { api } from '~/trpc/react';
import { Card, CardContent, CardHeader, CardTitle } from '~/components/ui/card';
import { Badge } from '~/components/ui/badge';
import { Button } from '~/components/ui/button';
import { ScrollArea } from '~/components/ui/scroll-area';
import { Skeleton } from '~/components/ui/skeleton';
import { Separator } from '~/components/ui/separator';
import { CodeParser } from '~/lib/integrations/claude/parser';

type GenerationDetailsProps = {
  readonly generationId: string;
};

export function GenerationDetails({
  generationId,
}: GenerationDetailsProps): React.JSX.Element {
  const {
    data: generation,
    isLoading,
    error,
  } = api.ai.getById.useQuery({
    id: generationId,
  });

  const [copiedFile, setCopiedFile] = useState<string | null>(null);

  const handleCopyCode = async (
    content: string,
    filePath: string
  ): Promise<void> => {
    try {
      await navigator.clipboard.writeText(content);
      setCopiedFile(filePath);
      setTimeout(() => setCopiedFile(null), 2000);
    } catch (err) {
      console.error('Failed to copy code:', err);
    }
  };

  if (isLoading) {
    return (
      <Card className="border-border">
        <CardHeader>
          <CardTitle>Generation Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-4 w-3/4" />
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="border-border">
        <CardHeader>
          <CardTitle>Generation Details</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-destructive">
            Failed to load generation: {error.message}
          </p>
        </CardContent>
      </Card>
    );
  }

  if (!generation) {
    return (
      <Card className="border-border">
        <CardHeader>
          <CardTitle>Generation Details</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">Generation not found</p>
        </CardContent>
      </Card>
    );
  }

  const files = CodeParser.parseClaudeResponse(generation.response);

  return (
    <Card className="border-border">
      <CardHeader>
        <div className="space-y-4">
          <CardTitle>Generation Details</CardTitle>

          {/* Metadata */}
          <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            <span>
              {formatDistanceToNow(new Date(generation.createdAt), {
                addSuffix: true,
              })}
            </span>

            {generation.tokens && (
              <>
                <span>•</span>
                <span>{generation.tokens} tokens</span>
              </>
            )}

            {generation.duration && (
              <>
                <span>•</span>
                <span>{(generation.duration / 1000).toFixed(1)}s</span>
              </>
            )}

            {generation.project && (
              <>
                <span>•</span>
                <Badge variant="outline">{generation.project.name}</Badge>
              </>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent>
        <ScrollArea className="h-[700px] pr-4">
          <div className="space-y-6">
            {/* Prompt Section */}
            <div className="space-y-2">
              <h3 className="text-sm font-semibold">Prompt</h3>
              <div className="rounded-md border border-border bg-muted p-4">
                <p className="whitespace-pre-wrap text-sm">
                  {generation.prompt}
                </p>
              </div>
            </div>

            <Separator />

            {/* Generated Files Section */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold">
                Generated Files ({files.length})
              </h3>

              {files.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No code files were generated
                </p>
              ) : (
                <div className="space-y-4">
                  {files.map((file, index) => (
                    <div
                      key={index}
                      className="space-y-2 rounded-lg border border-border p-4"
                    >
                      {/* File Header */}
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-sm font-medium">
                            {file.path}
                          </span>
                          <Badge variant="secondary" className="text-xs">
                            {file.language}
                          </Badge>
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() =>
                            void handleCopyCode(file.content, file.path)
                          }
                        >
                          {copiedFile === file.path ? 'Copied!' : 'Copy'}
                        </Button>
                      </div>

                      {/* Code Content */}
                      <div className="rounded-md bg-muted p-4">
                        <pre className="overflow-x-auto">
                          <code className="text-xs">{file.content}</code>
                        </pre>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <Separator />

            {/* Full Response Section */}
            <div className="space-y-2">
              <h3 className="text-sm font-semibold">Full Response</h3>
              <div className="rounded-md border border-border bg-muted p-4">
                <p className="whitespace-pre-wrap text-xs">
                  {generation.response}
                </p>
              </div>
            </div>
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}

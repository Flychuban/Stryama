'use client';

/**
 * Generation History Component
 *
 * Displays a list of AI code generations for the authenticated user.
 * Supports filtering by project and shows metadata like tokens and duration.
 */

import React from 'react';
import { formatDistanceToNow } from 'date-fns';
import { api } from '~/trpc/react';
import { Card, CardContent, CardHeader, CardTitle } from '~/components/ui/card';
import { Badge } from '~/components/ui/badge';
import { Button } from '~/components/ui/button';
import { ScrollArea } from '~/components/ui/scroll-area';
import { Skeleton } from '~/components/ui/skeleton';

type GenerationHistoryProps = {
  readonly projectId?: string;
  readonly onSelectGeneration?: (generationId: string) => void;
};

export function GenerationHistory({
  projectId,
  onSelectGeneration,
}: GenerationHistoryProps): React.JSX.Element {
  const {
    data: history,
    isLoading,
    error,
    refetch,
  } = api.ai.getHistory.useQuery({
    projectId,
    limit: 20,
  });

  if (isLoading) {
    return (
      <Card className="border-border">
        <CardHeader>
          <CardTitle>Generation History</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {[...Array<undefined>(3)].map((_, i) => (
            <div key={i} className="space-y-2">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-4 w-1/2" />
            </div>
          ))}
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="border-border">
        <CardHeader>
          <CardTitle>Generation History</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <p className="text-sm text-destructive">
              Failed to load generation history: {error.message}
            </p>
            <Button onClick={() => void refetch()} variant="outline" size="sm">
              Retry
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Empty state
  if (!history || history.length === 0) {
    return (
      <Card className="border-border">
        <CardHeader>
          <CardTitle>Generation History</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            No generations yet. Start by creating your first AI-generated code!
          </p>
        </CardContent>
      </Card>
    );
  }

  // Success state with data
  return (
    <Card className="border-border">
      <CardHeader>
        <CardTitle>Generation History</CardTitle>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[600px] pr-4">
          <div className="space-y-4">
            {history.map((generation) => {
              const truncatedPrompt =
                generation.prompt.length > 100
                  ? `${generation.prompt.slice(0, 100)}...`
                  : generation.prompt;

              return (
                <div
                  key={generation.id}
                  className="rounded-lg border border-border p-4 transition-colors hover:cursor-pointer hover:bg-accent"
                  onClick={() => onSelectGeneration?.(generation.id)}
                >
                  <div className="space-y-2">
                    {/* Prompt */}
                    <p className="text-sm font-medium">{truncatedPrompt}</p>

                    {/* Metadata */}
                    <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
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
                          <span>
                            {(generation.duration / 1000).toFixed(1)}s
                          </span>
                        </>
                      )}

                      {generation.project && (
                        <>
                          <span>•</span>
                          <Badge variant="outline" className="text-xs">
                            {generation.project.name}
                          </Badge>
                        </>
                      )}
                    </div>

                    {/* Status Badge */}
                    <div>
                      <Badge variant="default" className="text-xs">
                        Success
                      </Badge>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}

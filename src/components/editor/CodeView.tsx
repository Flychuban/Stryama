'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { FileCode, Copy, Check } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';

type CodeViewProps = {
  code: string;
  filename?: string;
};

const CodeView = ({ code, filename = 'component.tsx' }: CodeViewProps) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    void navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="flex h-full flex-col overflow-hidden rounded-2xl border border-border/50 bg-gradient-to-br from-background to-muted/20 shadow-xl">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border/50 bg-muted/40 px-5 py-3.5 backdrop-blur-sm">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-primary/20 bg-gradient-to-br from-primary/20 to-accent/10">
            <FileCode className="h-4 w-4 text-primary" />
          </div>
          <span className="font-mono text-sm font-medium text-foreground">
            {filename}
          </span>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleCopy}
          className="h-9 rounded-lg px-4 transition-all duration-200 hover:bg-background/60"
        >
          {copied ? (
            <>
              <Check className="mr-2 h-4 w-4 text-accent" />
              <span className="text-accent">Copied</span>
            </>
          ) : (
            <>
              <Copy className="mr-2 h-4 w-4" />
              Copy
            </>
          )}
        </Button>
      </div>

      {/* Code Content */}
      <ScrollArea className="flex-1 bg-background/40">
        <pre className="p-6 font-mono text-sm leading-relaxed">
          <code className="text-foreground/90">{code}</code>
        </pre>
      </ScrollArea>
    </div>
  );
};

export default CodeView;

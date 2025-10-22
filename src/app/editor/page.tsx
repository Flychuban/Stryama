'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ArrowUp, Code2, Eye } from 'lucide-react';
import { AppHeader } from '@/components/shared/app-header';
import { Card } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

export default function Editor() {
  const [prompt, setPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);

  const handleGenerate = () => {
    if (!prompt.trim()) return;
    setIsGenerating(true);
    setTimeout(() => {
      setIsGenerating(false);
    }, 2000);
  };

  return (
    <div className="bg-background min-h-screen">
      <AppHeader />

      {/* Animated Background */}
      <div className="fixed inset-0 -z-10">
        <div className="gradient-mesh animate-gradient-shift absolute inset-0 opacity-40" />
      </div>

      {/* Main Content */}
      <main className="mx-auto max-w-[1800px] px-6 pt-24 pb-12">
        <div className="grid h-[calc(100vh-8rem)] grid-cols-1 gap-6 lg:grid-cols-2">
          {/* Left Panel - Prompt */}
          <div className="flex flex-col gap-4">
            <Card className="bg-card/50 border-border/50 flex-1 p-6 backdrop-blur-sm">
              <div className="mb-4 flex items-center gap-3">
                <div className="bg-primary/10 rounded-lg p-2">
                  <Code2 className="text-primary h-5 w-5" />
                </div>
                <h2 className="text-xl font-semibold">Start Building</h2>
              </div>

              <p className="text-muted-foreground mb-6 text-sm">
                Describe what you want to build and I&apos;ll help you create it
                step by step
              </p>

              <div className="space-y-4">
                <div className="group relative">
                  <div className="from-primary to-accent absolute -inset-1 rounded-2xl bg-gradient-to-r opacity-20 blur transition-opacity group-hover:opacity-30" />
                  <div className="bg-background/80 border-border/50 relative rounded-2xl border p-2 shadow-xl backdrop-blur-xl">
                    <div className="flex items-end gap-2">
                      <Textarea
                        value={prompt}
                        onChange={(e) => setPrompt(e.target.value)}
                        placeholder="Describe what you want to build..."
                        className="placeholder:text-muted-foreground/60 min-h-[400px] resize-none border-0 bg-transparent text-base focus-visible:ring-0 focus-visible:ring-offset-0"
                        disabled={isGenerating}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && !e.shiftKey) {
                            e.preventDefault();
                            handleGenerate();
                          }
                        }}
                      />
                      <Button
                        onClick={handleGenerate}
                        disabled={isGenerating || !prompt.trim()}
                        size="icon"
                        className="mb-2 h-12 w-12 flex-shrink-0 rounded-full shadow-lg transition-all hover:scale-105 hover:shadow-xl"
                      >
                        <ArrowUp className="h-5 w-5" />
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            </Card>
          </div>

          {/* Right Panel - Preview */}
          <div className="flex flex-col gap-4">
            <Card className="bg-card/50 border-border/50 flex-1 p-6 backdrop-blur-sm">
              <div className="mb-4 flex items-center gap-3">
                <div className="bg-accent/10 rounded-lg p-2">
                  <Eye className="text-accent h-5 w-5" />
                </div>
                <h2 className="text-xl font-semibold">
                  Preview will appear here
                </h2>
              </div>

              <Tabs defaultValue="preview" className="w-full">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="preview">Preview</TabsTrigger>
                  <TabsTrigger value="code">Code</TabsTrigger>
                </TabsList>
                <TabsContent value="preview" className="mt-4">
                  <div className="bg-background/50 border-border/50 flex min-h-[400px] items-center justify-center rounded-lg border">
                    <div className="space-y-3 text-center">
                      <div className="bg-muted/50 inline-flex rounded-2xl p-4">
                        <Eye className="text-muted-foreground h-8 w-8" />
                      </div>
                      <p className="text-muted-foreground max-w-sm text-sm">
                        Start a conversation to generate your application
                      </p>
                    </div>
                  </div>
                </TabsContent>
                <TabsContent value="code" className="mt-4">
                  <div className="min-h-[400px] rounded-lg bg-[#1e1e1e] p-4 font-mono text-sm text-gray-300">
                    <p>{`// Your generated code will appear here...`}</p>
                  </div>
                </TabsContent>
              </Tabs>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
}

'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Code2 } from 'lucide-react';
import { AppHeader } from '@/components/shared/app-header';
import Link from 'next/link';

// Mock project data
const mockProjects = [
  {
    id: '1',
    name: 'E-commerce Dashboard',
    framework: 'React',
    lastModified: '2 hours ago',
  },
  {
    id: '2',
    name: 'Portfolio Website',
    framework: 'Next.js',
    lastModified: '1 day ago',
  },
  {
    id: '3',
    name: 'Task Management App',
    framework: 'React',
    lastModified: '3 days ago',
  },
];

export default function Dashboard() {
  const [projects] = useState(mockProjects);

  return (
    <div className="bg-background min-h-screen">
      <AppHeader />

      {/* Animated Background */}
      <div className="fixed inset-0 -z-10">
        <div className="gradient-mesh animate-gradient-shift absolute inset-0 opacity-40" />
        <div className="bg-primary/20 animate-float absolute top-0 right-0 h-[500px] w-[500px] rounded-full blur-[120px]" />
        <div
          className="bg-accent/20 absolute bottom-0 left-0 h-[400px] w-[400px] rounded-full blur-[100px]"
          style={{ animationDelay: '2s' }}
        />
      </div>

      {/* Page Header */}
      <header className="bg-background/60 border-border/40 sticky top-16 z-30 border-b backdrop-blur-xl">
        <div className="mx-auto flex h-24 max-w-7xl items-center justify-between px-6">
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <h1 className="from-primary via-accent to-primary bg-gradient-to-r bg-clip-text text-4xl font-bold text-transparent">
                My Projects
              </h1>
              {projects.length > 0 && (
                <span className="bg-primary/10 border-primary/20 text-primary rounded-full border px-3 py-1 text-sm font-medium">
                  {projects.length}
                </span>
              )}
            </div>
            <p className="text-muted-foreground text-sm">
              Build amazing applications without writing code
            </p>
          </div>
          <Button
            size="lg"
            className="hover:shadow-primary/20 group relative overflow-hidden shadow-lg transition-all hover:shadow-xl"
            asChild
          >
            <Link href="/editor">
              <div className="from-primary to-accent absolute inset-0 bg-gradient-to-r opacity-0 transition-opacity group-hover:opacity-100" />
              <Plus className="relative z-10 mr-2 h-5 w-5" />
              <span className="relative z-10">New Project</span>
            </Link>
          </Button>
        </div>
      </header>

      {/* Main Content */}
      <main className="mx-auto max-w-7xl px-6 py-12">
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          {projects.map((project) => (
            <Card
              key={project.id}
              className="group hover:shadow-primary/10 border-border/50 hover:border-primary/50 bg-card/50 relative h-[200px] w-full cursor-pointer overflow-hidden backdrop-blur-sm transition-all duration-300 hover:-translate-y-2 hover:shadow-2xl"
            >
              {/* Glow effect on hover */}
              <div className="from-primary/5 to-accent/5 absolute inset-0 bg-gradient-to-br via-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />

              {/* Thumbnail */}
              <div className="from-primary/10 via-accent/5 to-primary/10 border-border/50 group-hover:border-primary/30 relative h-[120px] overflow-hidden border-b bg-gradient-to-br transition-colors">
                <div className="relative flex h-full items-center justify-center">
                  <div className="from-primary/20 to-accent/20 absolute inset-0 bg-gradient-to-br opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
                  <Code2 className="text-primary/30 group-hover:text-primary/50 relative z-10 h-12 w-12 transition-colors" />
                </div>
              </div>

              {/* Metadata */}
              <CardContent className="relative z-10 p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <h3 className="group-hover:from-primary group-hover:to-accent truncate text-base font-semibold transition-all group-hover:bg-gradient-to-r group-hover:bg-clip-text group-hover:text-transparent">
                      {project.name}
                    </h3>
                    <p className="text-muted-foreground mt-1 text-xs">
                      {project.lastModified}
                    </p>
                  </div>
                  <Badge
                    variant="secondary"
                    className="bg-primary/10 text-primary border-primary/20 flex-shrink-0 text-xs"
                  >
                    {project.framework}
                  </Badge>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </main>
    </div>
  );
}

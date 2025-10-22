import {
  MessageSquare,
  Eye,
  RefreshCw,
  Download,
  ArrowRight,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import React from 'react';

type Feature = {
  icon: React.ReactNode;
  title: string;
  description: string;
  highlight: string;
};

const features: Feature[] = [
  {
    icon: <MessageSquare className="h-7 w-7" />,
    title: 'Conversational Interface',
    description:
      'Interact with Stryama like ChatGPT. Describe, refine, and iterate in natural language.',
    highlight: 'ChatGPT-style',
  },
  {
    icon: <Eye className="h-7 w-7" />,
    title: 'Live Preview',
    description:
      'See your application come to life in real-time with instant visual feedback.',
    highlight: 'Real-time',
  },
  {
    icon: <RefreshCw className="h-7 w-7" />,
    title: 'Iterative Refinement',
    description:
      'Make changes on the fly. Add features, adjust design, or fix issues conversationally.',
    highlight: 'Instant updates',
  },
  {
    icon: <Download className="h-7 w-7" />,
    title: 'Export Anywhere',
    description:
      'Download your code and deploy to any platform. You own everything we generate.',
    highlight: 'Full ownership',
  },
];

export function Features() {
  return (
    <section className="relative overflow-hidden px-4 py-32">
      {/* Background decoration */}
      <div className="absolute right-0 top-0 -z-10 h-1/3 w-1/3 rounded-full bg-gradient-to-br from-primary/5 to-transparent blur-3xl" />
      <div className="absolute bottom-0 left-0 -z-10 h-1/3 w-1/3 rounded-full bg-gradient-to-tr from-accent/5 to-transparent blur-3xl" />

      <div className="mx-auto max-w-7xl">
        <div className="mb-20 text-center">
          <h2 className="mb-6 text-4xl font-bold tracking-tight md:text-5xl lg:text-6xl">
            Everything you need to ship fast
          </h2>
          <p className="mx-auto max-w-2xl text-xl leading-relaxed text-muted-foreground">
            Powerful features that accelerate your development workflow
          </p>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          {features.map((feature, index) => (
            <div
              key={index}
              className="group relative rounded-2xl border border-border bg-card p-8 transition-all hover:border-primary/30 hover:shadow-lg"
            >
              <div className="flex gap-6">
                <div className="flex-shrink-0">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-primary/10 to-accent/10 text-primary transition-transform group-hover:scale-110">
                    {feature.icon}
                  </div>
                </div>
                <div className="flex-1 space-y-3">
                  <div className="flex items-center gap-3">
                    <h3 className="text-xl font-semibold">{feature.title}</h3>
                    <span className="rounded-full bg-primary/10 px-2 py-1 text-xs font-medium text-primary">
                      {feature.highlight}
                    </span>
                  </div>
                  <p className="leading-relaxed text-muted-foreground">
                    {feature.description}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* CTA in features section */}
        <div className="mt-16 text-center">
          <Button size="lg" className="group px-8 py-6 text-lg" asChild>
            <Link href="/dashboard">
              Start Building Now
              <ArrowRight className="ml-2 h-5 w-5 transition-transform group-hover:translate-x-1" />
            </Link>
          </Button>
        </div>
      </div>
    </section>
  );
}

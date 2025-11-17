import { Button } from '@/components/ui/button';
import { ArrowRight, Sparkles } from 'lucide-react';
import Link from 'next/link';

export function CTA() {
  return (
    <section className="relative overflow-hidden px-4 py-20 md:py-32">
      {/* Gradient background */}
      <div className="absolute inset-0 -z-10 bg-gradient-to-br from-primary/10 via-background to-accent/10" />
      <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_30%_50%,rgba(99,102,241,0.1),transparent_50%)]" />
      <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_70%_50%,rgba(16,185,129,0.1),transparent_50%)]" />

      <div className="mx-auto max-w-5xl space-y-8 text-center md:space-y-10">
        {/* Badge */}
        <div className="flex justify-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-4 py-2 text-primary">
            <Sparkles className="h-4 w-4" />
            <span className="text-sm font-medium">Ready to build?</span>
          </div>
        </div>

        {/* Headline */}
        <h2 className="text-4xl font-bold tracking-tight md:text-6xl lg:text-7xl">
          Start creating
          <br />
          <span className="bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
            something amazing
          </span>
        </h2>

        <p className="mx-auto max-w-2xl text-lg leading-relaxed text-muted-foreground md:text-xl lg:text-2xl">
          Join thousands of creators building faster with Stryama. Your first
          project is just a conversation away.
        </p>

        {/* CTAs */}
        <div className="flex flex-col items-center justify-center gap-4 pt-6 sm:flex-row">
          <Button
            size="lg"
            className="group px-10 py-6 text-lg shadow-xl transition-all hover:shadow-2xl"
            asChild
          >
            <Link href="/dashboard">
              Get Started Free
              <ArrowRight className="ml-2 h-5 w-5 transition-transform group-hover:translate-x-1" />
            </Link>
          </Button>
        </div>

        <div className="flex flex-col items-center justify-center gap-4 pt-4 text-sm text-muted-foreground sm:flex-row sm:gap-8">
          <div className="flex items-center gap-2">
            <svg
              className="h-4 w-4 text-accent"
              fill="currentColor"
              viewBox="0 0 20 20"
            >
              <path
                fillRule="evenodd"
                d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                clipRule="evenodd"
              />
            </svg>
            <span>No credit card required</span>
          </div>
          <div className="flex items-center gap-2">
            <svg
              className="h-4 w-4 text-accent"
              fill="currentColor"
              viewBox="0 0 20 20"
            >
              <path
                fillRule="evenodd"
                d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                clipRule="evenodd"
              />
            </svg>
            <span>Free to start</span>
          </div>
          <div className="flex items-center gap-2">
            <svg
              className="h-4 w-4 text-accent"
              fill="currentColor"
              viewBox="0 0 20 20"
            >
              <path
                fillRule="evenodd"
                d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                clipRule="evenodd"
              />
            </svg>
            <span>Cancel anytime</span>
          </div>
        </div>
      </div>
    </section>
  );
}

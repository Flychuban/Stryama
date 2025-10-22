'use client';

import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { Logo } from '@/components/shared/logo';

export function Header() {
  return (
    <header className="bg-background/60 border-border/40 fixed top-0 right-0 left-0 z-50 border-b backdrop-blur-xl">
      <div className="mx-auto flex h-20 max-w-7xl items-center justify-between px-6">
        {/* Logo */}
        <Link href="/">
          <Logo size={36} showText={true} />
        </Link>

        {/* Navigation */}
        <nav className="hidden items-center gap-8 md:flex">
          <a
            href="#features"
            className="text-muted-foreground hover:text-foreground text-sm font-medium transition-colors"
          >
            Features
          </a>
          <a
            href="#how-it-works"
            className="text-muted-foreground hover:text-foreground text-sm font-medium transition-colors"
          >
            How It Works
          </a>
          <a
            href="#pricing"
            className="text-muted-foreground hover:text-foreground text-sm font-medium transition-colors"
          >
            Pricing
          </a>
        </nav>

        {/* CTA Buttons */}
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            className="hidden sm:inline-flex"
            asChild
          >
            <Link href="/dashboard">Dashboard</Link>
          </Button>
          <Button
            size="sm"
            className="shadow-lg transition-shadow hover:shadow-xl"
            asChild
          >
            <Link href="/dashboard">Get Started</Link>
          </Button>
        </div>
      </div>
    </header>
  );
}

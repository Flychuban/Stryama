import { HydrateClient } from '~/trpc/server';
import { Header } from '@/components/landing/header';
import { Hero } from '@/components/landing/hero';
import { HowItWorks } from '@/components/landing/how-it-works';
import { FeatureGrid } from '@/components/landing/feature-grid';
import { Pricing } from '@/components/landing/pricing';

export default async function Home() {
  return (
    <HydrateClient>
      <div className="min-h-screen">
        <Header />
        <main className="pt-20">
          <Hero />
          <HowItWorks />
          <FeatureGrid />
          <Pricing />
        </main>
        <footer className="border-border/40 border-t px-4 py-12">
          <div className="mx-auto max-w-7xl">
            <div className="flex flex-col items-center justify-between gap-6 md:flex-row">
              <p className="text-muted-foreground text-sm">
                © 2025 Stryama. Built for creators who think differently.
              </p>
              <div className="flex gap-6">
                <a
                  href="#"
                  className="text-muted-foreground hover:text-foreground text-sm transition-colors"
                >
                  Privacy
                </a>
                <a
                  href="#"
                  className="text-muted-foreground hover:text-foreground text-sm transition-colors"
                >
                  Terms
                </a>
                <a
                  href="#"
                  className="text-muted-foreground hover:text-foreground text-sm transition-colors"
                >
                  Docs
                </a>
              </div>
            </div>
          </div>
        </footer>
      </div>
    </HydrateClient>
  );
}

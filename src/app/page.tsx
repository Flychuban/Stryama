import { Header } from '@/components/landing/Header';
import { Hero } from '@/components/landing/Hero';
import { HowItWorks } from '@/components/landing/HowItWorks';
import { FeatureGrid } from '@/components/landing/FeatureGrid';
import { Pricing } from '@/components/landing/Pricing';

export default function Home() {
  return (
    <div className="min-h-screen">
      <Header />
      <main className="pt-20">
        <Hero />
        <HowItWorks />
        <FeatureGrid />
        <Pricing />
      </main>
    </div>
  );
}

import { Check, Sparkles, Zap, Rocket, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import Link from 'next/link';

type PricingTier = {
  name: string;
  price: number;
  period: string;
  description: string;
  features: string[];
  highlight?: boolean;
  badge?: string;
  icon: typeof Sparkles;
  cta: string;
};

const tiers: PricingTier[] = [
  {
    name: 'Starter',
    price: 0,
    period: 'forever',
    description: 'Perfect for trying out the platform',
    icon: Sparkles,
    features: [
      '15 AI generations per month',
      '1 active project',
      'Fast AI model (Haiku)',
      'E2B sandbox (10min timeout)',
      'Community support',
      'GitHub export',
    ],
    cta: 'Start Free',
  },
  {
    name: 'Builder',
    price: 19,
    period: 'month',
    description: 'Best for indie developers and learners',
    icon: Rocket,
    badge: 'Most Popular',
    highlight: true,
    features: [
      '100 AI generations per month',
      '5 active projects',
      'Smart AI (Haiku + Sonnet)',
      'E2B sandbox (30min timeout)',
      'Email support (48hr)',
      'GitHub export',
    ],
    cta: 'Start Building',
  },
  {
    name: 'Pro',
    price: 49,
    period: 'month',
    description: 'For professional developers',
    icon: Zap,
    features: [
      '350 AI generations per month',
      '20 active projects',
      'Smart AI with priority routing',
      'E2B sandbox (2hr timeout)',
      'Priority support + chat',
      'Custom domains (coming soon)',
      'API access (coming soon)',
    ],
    cta: 'Go Pro',
  },
];

export function Pricing() {
  return (
    <section id="pricing" className="relative overflow-hidden px-4 py-32">
      {/* Background Effects */}
      <div className="absolute inset-0 -z-10">
        <div className="absolute left-1/4 top-1/4 h-96 w-96 rounded-full bg-primary/10 blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 h-96 w-96 rounded-full bg-accent/10 blur-3xl" />
      </div>

      <div className="mx-auto max-w-7xl">
        {/* Header */}
        <div className="mx-auto mb-20 max-w-3xl text-center">
          <Badge
            variant="secondary"
            className="mb-6 px-4 py-1.5 text-sm font-medium"
          >
            Pricing Plans
          </Badge>
          <h2 className="mb-6 bg-gradient-to-r from-foreground via-foreground to-foreground/70 bg-clip-text text-5xl font-bold text-transparent md:text-6xl">
            Choose Your Plan
          </h2>
          <p className="text-xl text-muted-foreground">
            Start free, upgrade as you grow. All plans include core features.
          </p>
        </div>

        {/* Pricing Cards */}
        <div className="mb-16 grid gap-8 md:grid-cols-3">
          {tiers.map((tier, index) => {
            const Icon = tier.icon;
            return (
              <div
                key={index}
                className={`group relative ${
                  tier.highlight ? 'md:-mt-8 md:scale-105' : ''
                }`}
              >
                {tier.badge && (
                  <div className="absolute -top-5 left-1/2 z-10 -translate-x-1/2">
                    <Badge className="border-0 bg-gradient-to-r from-primary to-accent px-4 py-1.5 text-white shadow-lg">
                      {tier.badge}
                    </Badge>
                  </div>
                )}

                <div
                  className={`relative h-full rounded-2xl p-8 transition-all duration-300 ${
                    tier.highlight
                      ? 'border-2 border-primary/50 bg-gradient-to-b from-card to-card/50 shadow-2xl shadow-primary/20'
                      : 'border border-border/50 bg-card/50 backdrop-blur-sm hover:border-primary/30 hover:shadow-xl'
                  }`}
                >
                  {/* Icon */}
                  <div
                    className={`mb-6 inline-flex rounded-xl p-3 ${
                      tier.highlight
                        ? 'bg-gradient-to-br from-primary to-accent'
                        : 'bg-primary/10'
                    }`}
                  >
                    <Icon
                      className={`h-6 w-6 ${
                        tier.highlight ? 'text-white' : 'text-primary'
                      }`}
                    />
                  </div>

                  {/* Plan Name */}
                  <h3 className="mb-2 text-2xl font-bold">{tier.name}</h3>

                  {/* Price */}
                  <div className="mb-4">
                    <div className="flex items-baseline gap-2">
                      <span className="bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-5xl font-bold text-transparent">
                        ${tier.price}
                      </span>
                      <span className="text-muted-foreground">
                        /{tier.period}
                      </span>
                    </div>
                  </div>

                  {/* Description */}
                  <p className="mb-8 min-h-[48px] text-muted-foreground">
                    {tier.description}
                  </p>

                  {/* CTA Button */}
                  <Button
                    className={`group/btn mb-8 w-full ${
                      tier.highlight
                        ? 'bg-gradient-to-r from-primary to-accent text-white hover:shadow-lg hover:shadow-primary/25'
                        : 'bg-primary/10 text-primary hover:bg-primary hover:text-white'
                    }`}
                    size="lg"
                    asChild
                  >
                    <Link
                      href={
                        tier.price === 0
                          ? '/sign-up'
                          : `/checkout?plan=${tier.name.toLowerCase()}`
                      }
                    >
                      {tier.cta}
                      <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover/btn:translate-x-1" />
                    </Link>
                  </Button>

                  {/* Features */}
                  <div className="space-y-4">
                    {tier.features.map((feature, featureIndex) => (
                      <div
                        key={featureIndex}
                        className="flex items-start gap-3"
                      >
                        <div
                          className={`mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full ${
                            tier.highlight
                              ? 'bg-primary/20 text-primary'
                              : 'bg-accent/20 text-accent'
                          }`}
                        >
                          <Check className="h-3 w-3" />
                        </div>
                        <span className="text-sm">{feature}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Trust Signals */}
        <div className="text-center">
          <div className="flex flex-wrap items-center justify-center gap-8 opacity-60">
            <div className="text-xs font-medium">🔒 Secure Payments</div>
            <div className="text-xs font-medium">💳 Cancel Anytime</div>
            <div className="text-xs font-medium">⚡ Instant Access</div>
          </div>
        </div>
      </div>
    </section>
  );
}

'use client';

import { Sparkles, Rocket, Zap } from 'lucide-react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '~/components/ui/card';

const plans = [
  {
    name: 'Starter',
    tagline: 'Perfect for trying out Stryama',
    description: 'Get started with AI-powered development for free',
    icon: Sparkles,
    iconColor: 'text-purple-500',
    iconBg: 'bg-purple-500/10',
    features: [
      '15 AI generations/month',
      '1 active project',
      'Fast AI model (Haiku)',
    ],
  },
  {
    name: 'Builder',
    tagline: 'Best for indie developers',
    description: 'Everything you need to build real projects',
    icon: Rocket,
    iconColor: 'text-primary',
    iconBg: 'bg-primary/10',
    popular: true,
    features: [
      '100 AI generations/month',
      '5 active projects',
      'Smart AI (Haiku + Sonnet)',
    ],
  },
  {
    name: 'Pro',
    tagline: 'For professional developers',
    description: 'Maximum power and priority support',
    icon: Zap,
    iconColor: 'text-accent',
    iconBg: 'bg-accent/10',
    features: [
      '350 AI generations/month',
      '20 active projects',
      'Priority routing',
    ],
  },
];

export function PlanHighlights() {
  return (
    <div className="grid gap-6 md:grid-cols-3">
      {plans.map((plan) => (
        <Card
          key={plan.name}
          className={`relative border-border/50 shadow-lg transition-all hover:shadow-xl ${
            plan.popular ? 'scale-105 border-primary/50 shadow-primary/20' : ''
          }`}
        >
          {plan.popular && (
            <div className="absolute -top-3 left-1/2 -translate-x-1/2">
              <div className="rounded-full bg-gradient-to-r from-primary to-accent px-4 py-1 text-xs font-semibold text-white shadow-lg">
                Most Popular
              </div>
            </div>
          )}

          <CardHeader className="space-y-3">
            <div
              className={`inline-flex h-12 w-12 items-center justify-center rounded-xl ${plan.iconBg}`}
            >
              <plan.icon className={`h-6 w-6 ${plan.iconColor}`} />
            </div>

            <div>
              <CardTitle className="text-xl">{plan.name}</CardTitle>
              <CardDescription className="mt-1">{plan.tagline}</CardDescription>
            </div>
          </CardHeader>

          <CardContent>
            <p className="mb-4 text-sm text-muted-foreground">
              {plan.description}
            </p>

            <ul className="space-y-2">
              {plan.features.map((feature, idx) => (
                <li key={idx} className="flex items-start gap-2 text-sm">
                  <div className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10">
                    <div className="h-1.5 w-1.5 rounded-full bg-primary" />
                  </div>
                  <span>{feature}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

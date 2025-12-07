'use client';

import { Check, X } from 'lucide-react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '~/components/ui/card';

interface Feature {
  name: string;
  starter: string | boolean;
  builder: string | boolean;
  pro: string | boolean;
  category?: string;
}

const features: Feature[] = [
  { category: 'AI Generations', name: '', starter: '', builder: '', pro: '' },
  {
    name: 'AI generations per month',
    starter: '15',
    builder: '100',
    pro: '350',
  },
  {
    name: 'AI model',
    starter: 'Haiku only',
    builder: 'Haiku + Sonnet',
    pro: 'Smart AI with priority routing',
  },

  { category: 'Projects', name: '', starter: '', builder: '', pro: '' },
  { name: 'Active projects', starter: '1', builder: '5', pro: '20' },

  { category: 'Features', name: '', starter: '', builder: '', pro: '' },
  {
    name: 'E2B sandbox',
    starter: '10min timeout',
    builder: '30min timeout',
    pro: '2hr timeout',
  },
  { name: 'GitHub export', starter: true, builder: true, pro: true },
  {
    name: 'Custom domains',
    starter: false,
    builder: false,
    pro: 'Coming soon',
  },
  { name: 'API access', starter: false, builder: false, pro: 'Coming soon' },

  { category: 'Support', name: '', starter: '', builder: '', pro: '' },
  {
    name: 'Support level',
    starter: 'Community',
    builder: 'Email (48hr)',
    pro: 'Priority + chat',
  },
  { name: 'Documentation', starter: true, builder: true, pro: true },
];

function FeatureCell({ value }: { value: string | boolean }) {
  if (typeof value === 'boolean') {
    return (
      <div className="flex justify-center">
        {value ? (
          <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10">
            <Check className="h-4 w-4 text-primary" />
          </div>
        ) : (
          <div className="flex h-6 w-6 items-center justify-center rounded-full bg-muted">
            <X className="h-4 w-4 text-muted-foreground" />
          </div>
        )}
      </div>
    );
  }

  if (value === '') return null;

  return <span className="text-sm font-medium">{value}</span>;
}

export function FeatureComparisonTable() {
  return (
    <Card className="border-border/50 shadow-lg">
      <CardHeader className="text-center">
        <CardTitle className="text-3xl">Feature Comparison</CardTitle>
        <CardDescription>
          Compare all features across our plans to find the perfect fit
        </CardDescription>
      </CardHeader>

      <CardContent>
        {/* Desktop Table */}
        <div className="hidden overflow-x-auto md:block">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border/50">
                <th className="pb-4 text-left">
                  <span className="text-lg font-semibold">Features</span>
                </th>
                <th className="pb-4 text-center">
                  <div className="flex flex-col items-center gap-1">
                    <span className="text-lg font-semibold">Starter</span>
                    <span className="text-sm font-normal text-muted-foreground">
                      Free
                    </span>
                  </div>
                </th>
                <th className="pb-4 text-center">
                  <div className="flex flex-col items-center gap-1">
                    <span className="text-lg font-semibold">Builder</span>
                    <span className="text-sm font-normal text-muted-foreground">
                      $19/month
                    </span>
                  </div>
                </th>
                <th className="pb-4 text-center">
                  <div className="flex flex-col items-center gap-1">
                    <span className="text-lg font-semibold">Pro</span>
                    <span className="text-sm font-normal text-muted-foreground">
                      $49/month
                    </span>
                  </div>
                </th>
              </tr>
            </thead>

            <tbody>
              {features.map((feature, idx) => {
                if (feature.category) {
                  return (
                    <tr key={idx} className="border-t border-border/50">
                      <td colSpan={4} className="pb-3 pt-6">
                        <span className="text-sm font-semibold uppercase tracking-wider text-primary">
                          {feature.category}
                        </span>
                      </td>
                    </tr>
                  );
                }

                return (
                  <tr
                    key={idx}
                    className="border-b border-border/20 last:border-0"
                  >
                    <td className="py-4 text-sm text-foreground">
                      {feature.name}
                    </td>
                    <td className="py-4 text-center text-muted-foreground">
                      <FeatureCell value={feature.starter} />
                    </td>
                    <td className="py-4 text-center text-muted-foreground">
                      <FeatureCell value={feature.builder} />
                    </td>
                    <td className="py-4 text-center text-muted-foreground">
                      <FeatureCell value={feature.pro} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Mobile Stack */}
        <div className="space-y-6 md:hidden">
          {['starter', 'builder', 'pro'].map((planKey) => {
            const planName = planKey.charAt(0).toUpperCase() + planKey.slice(1);
            const price =
              planKey === 'starter'
                ? 'Free'
                : planKey === 'builder'
                  ? '$19/month'
                  : '$49/month';

            return (
              <div
                key={planKey}
                className="rounded-lg border border-border/50 p-4"
              >
                <div className="mb-4 border-b border-border/50 pb-4">
                  <h3 className="text-lg font-semibold">{planName}</h3>
                  <p className="text-sm text-muted-foreground">{price}</p>
                </div>

                <div className="space-y-3">
                  {features.map((feature, idx) => {
                    if (feature.category) {
                      return (
                        <div key={idx} className="pt-2">
                          <span className="text-xs font-semibold uppercase tracking-wider text-primary">
                            {feature.category}
                          </span>
                        </div>
                      );
                    }

                    const value =
                      feature[
                        planKey as keyof Omit<Feature, 'name' | 'category'>
                      ];

                    return (
                      <div
                        key={idx}
                        className="flex items-center justify-between gap-2"
                      >
                        <span className="text-sm">{feature.name}</span>
                        <div className="text-sm text-muted-foreground">
                          <FeatureCell value={value} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

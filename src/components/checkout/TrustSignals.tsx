'use client';

import { Shield, Zap, RotateCcw, Lock } from 'lucide-react';

const trustSignals = [
  {
    icon: Shield,
    title: 'Secure Payments',
    description: 'Industry-standard encryption',
    gradient: 'from-blue-500 to-cyan-500',
  },
  {
    icon: Zap,
    title: 'Instant Access',
    description: 'Start building immediately',
    gradient: 'from-primary to-purple-500',
  },
  {
    icon: RotateCcw,
    title: 'Cancel Anytime',
    description: 'No long-term commitments',
    gradient: 'from-accent to-green-500',
  },
  {
    icon: Lock,
    title: 'Money-Back Guarantee',
    description: '30-day refund policy',
    gradient: 'from-orange-500 to-red-500',
  },
];

export function TrustSignals() {
  return (
    <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
      {trustSignals.map((signal) => (
        <div
          key={signal.title}
          className="group flex flex-col items-center rounded-xl border border-border/50 bg-background/50 p-6 text-center backdrop-blur-sm transition-all hover:border-border hover:shadow-lg"
        >
          <div
            className={`mb-4 flex h-14 w-14 items-center justify-center rounded-xl bg-gradient-to-br ${signal.gradient} p-3 shadow-lg transition-transform group-hover:scale-110`}
          >
            <signal.icon className="h-7 w-7 text-white" />
          </div>

          <h3 className="mb-1 font-semibold">{signal.title}</h3>
          <p className="text-sm text-muted-foreground">{signal.description}</p>
        </div>
      ))}
    </div>
  );
}

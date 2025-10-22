import { MessageSquare, Eye, Code2, Zap, Download } from 'lucide-react';

interface Feature {
  icon: React.ReactNode;
  title: string;
  description: string;
  bgColor: string;
  textColor: string;
  iconBg: string;
  visual?: React.ReactNode;
  span?: string;
}

const features: Feature[] = [
  {
    icon: <MessageSquare className="h-6 w-6" />,
    title: 'Create at the speed of thought',
    description:
      'Tell Stryama your idea, and watch it transform into a working app—complete with all the necessary components, pages, flows and features.',
    bgColor:
      'bg-gradient-to-br from-blue-50 to-purple-50 dark:from-blue-950/20 dark:to-purple-950/20',
    textColor: 'text-foreground',
    iconBg: 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400',
    span: 'md:col-span-2 md:row-span-1',
  },
  {
    icon: <Eye className="h-6 w-6" />,
    title: 'Live Preview',
    description:
      'See your app come to life in real-time with instant previews and updates.',
    bgColor:
      'bg-gradient-to-br from-purple-50 to-pink-50 dark:from-purple-950/20 dark:to-pink-950/20',
    textColor: 'text-foreground',
    iconBg:
      'bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400',
    visual: (
      <div className="mt-6 rounded-lg border border-border/40 bg-white p-4 dark:bg-background/50">
        <div className="mb-3 flex gap-1.5">
          <div className="h-2.5 w-2.5 rounded-full bg-red-400" />
          <div className="h-2.5 w-2.5 rounded-full bg-yellow-400" />
          <div className="h-2.5 w-2.5 rounded-full bg-green-400" />
        </div>
        <div className="space-y-2">
          <div className="h-2 w-3/4 rounded bg-muted" />
          <div className="h-8 rounded bg-gradient-to-r from-[#8B5CF6] to-[#A855F7]" />
        </div>
      </div>
    ),
    span: 'md:col-span-1',
  },
  {
    icon: <Code2 className="h-6 w-6" />,
    title: 'Real Code Output',
    description:
      'Get production-ready React code you own completely. Export and deploy anywhere.',
    bgColor:
      'bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-950/20 dark:to-emerald-950/20',
    textColor: 'text-foreground',
    iconBg:
      'bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400',
    visual: (
      <div className="mt-6 rounded-lg bg-[#1e1e1e] p-4 font-mono text-sm">
        <span className="text-purple-400">export</span>{' '}
        <span className="text-blue-400">function</span>{' '}
        <span className="text-yellow-300">App</span>
        <span className="text-white">() {'{'}</span>
      </div>
    ),
    span: 'md:col-span-1',
  },
  {
    icon: <Zap className="h-6 w-6" />,
    title: 'Lightning Fast',
    description: 'From idea to prototype in under 2 minutes',
    bgColor:
      'bg-gradient-to-br from-orange-50 to-amber-50 dark:from-orange-950/20 dark:to-amber-950/20',
    textColor: 'text-foreground',
    iconBg:
      'bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400',
    span: 'md:col-span-1',
  },
  {
    icon: <Download className="h-6 w-6" />,
    title: 'Export',
    description: 'Deploy to any platform',
    bgColor:
      'bg-gradient-to-br from-pink-50 to-rose-50 dark:from-pink-950/20 dark:to-rose-950/20',
    textColor: 'text-foreground',
    iconBg: 'bg-pink-100 dark:bg-pink-900/30 text-pink-600 dark:text-pink-400',
    span: 'md:col-span-1',
  },
];

export function FeatureGrid() {
  return (
    <section className="px-4 py-24">
      <div className="mx-auto max-w-7xl">
        <div className="grid gap-6 md:grid-cols-3">
          {features.map((feature, index) => (
            <div
              key={index}
              className={`${feature.span ?? ''} ${feature.bgColor} ${feature.textColor} rounded-3xl border border-border/40 p-8 transition-all duration-300 hover:-translate-y-1 hover:shadow-lg`}
            >
              {/* Icon */}
              <div
                className={`inline-flex h-14 w-14 items-center justify-center rounded-2xl ${feature.iconBg} mb-6`}
              >
                {feature.icon}
              </div>

              {/* Content */}
              <h3 className="mb-3 text-2xl font-semibold">{feature.title}</h3>
              <p className="leading-relaxed text-muted-foreground">
                {feature.description}
              </p>

              {/* Visual Element */}
              {feature.visual && feature.visual}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

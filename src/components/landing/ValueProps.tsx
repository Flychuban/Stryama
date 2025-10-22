import { Zap, Sparkles, Code2 } from 'lucide-react';

type ValueProp = {
  icon: React.ReactNode;
  title: string;
  description: string;
  gradient: string;
};

const valueProps: ValueProp[] = [
  {
    icon: <Zap className="h-8 w-8" />,
    title: 'Lightning Fast',
    description:
      'Working application in under 15 minutes. From idea to prototype at unprecedented speed.',
    gradient: 'from-amber-500/10 to-orange-500/10',
  },
  {
    icon: <Sparkles className="h-8 w-8" />,
    title: 'Incredibly Easy',
    description:
      'Natural language prompts. No coding experience required. Just describe what you want.',
    gradient: 'from-primary/10 to-purple-500/10',
  },
  {
    icon: <Code2 className="h-8 w-8" />,
    title: 'Real Code',
    description:
      'Actual custom code you own and can export. Not templates. Not limitations. True flexibility.',
    gradient: 'from-accent/10 to-teal-500/10',
  },
];

export function ValueProps() {
  return (
    <section className="relative px-4 py-32">
      {/* Subtle background texture */}
      <div className="absolute inset-0 -z-10 bg-gradient-to-b from-background via-secondary/20 to-background" />

      <div className="mx-auto max-w-7xl">
        <div className="mb-20 text-center">
          <h2 className="mb-6 text-4xl font-bold tracking-tight md:text-5xl lg:text-6xl">
            Why developers choose Stryama
          </h2>
          <p className="mx-auto max-w-2xl text-xl leading-relaxed text-muted-foreground">
            The fastest way to transform ideas into working applications
          </p>
        </div>

        <div className="grid gap-8 md:grid-cols-3">
          {valueProps.map((prop, index) => (
            <div key={index} className="group relative">
              {/* Gradient background on hover */}
              <div
                className={`absolute -inset-0.5 bg-gradient-to-r ${prop.gradient} rounded-2xl opacity-0 blur transition-opacity duration-500 group-hover:opacity-100`}
              />

              <div className="relative h-full rounded-2xl border border-border bg-card p-8 transition-all hover:border-border/50 hover:shadow-xl">
                <div className="space-y-6">
                  <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-gradient-to-br from-primary/10 to-accent/10 text-primary transition-transform group-hover:scale-110">
                    {prop.icon}
                  </div>
                  <div className="space-y-3">
                    <h3 className="text-2xl font-semibold">{prop.title}</h3>
                    <p className="leading-relaxed text-muted-foreground">
                      {prop.description}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

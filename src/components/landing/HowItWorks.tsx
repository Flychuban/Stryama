type Step = {
  number: string;
  title: string;
  description: string;
  gradient: string;
};

const steps: Step[] = [
  {
    number: '01',
    title: 'Describe',
    description:
      'Tell Stryama what you want to build using natural language. Be as detailed or as brief as you like.',
    gradient: 'from-primary to-primary',
  },
  {
    number: '02',
    title: 'Generate',
    description:
      'Watch as AI generates your app in real-time with components, layouts, and functionality.',
    gradient: 'from-primary to-primary',
  },
  {
    number: '03',
    title: 'Deploy',
    description:
      'Iterate, refine, export your code and deploy anywhere. You own everything.',
    gradient: 'from-primary to-accent',
  },
];

type Feature = {
  icon: string;
  title: string;
  description: string;
};

const features: Feature[] = [
  {
    icon: '⚡',
    title: 'Lightning Fast',
    description: 'Apps in under 2 minutes',
  },
  {
    icon: '🎯',
    title: 'Zero Code Required',
    description: 'Natural language prompts',
  },
  {
    icon: '💎',
    title: 'Production Ready',
    description: 'Real React code you own',
  },
  {
    icon: '🔒',
    title: 'Privacy First',
    description: 'Your code, your data',
  },
];

export function HowItWorks() {
  return (
    <section
      id="how-it-works"
      className="bg-gradient-to-b from-background via-muted/20 to-background px-4 py-16 md:py-24"
    >
      <div className="mx-auto max-w-7xl">
        {/* Header */}
        <div className="mb-16 text-center md:mb-20">
          <h2 className="mb-4 text-3xl font-bold md:text-4xl lg:text-5xl">
            Why Choose Stryama?
          </h2>
          <p className="text-base text-muted-foreground md:text-lg">
            The fastest way to turn your ideas into reality
          </p>
        </div>

        {/* Steps */}
        <div className="relative mb-24 grid gap-8 md:grid-cols-3">
          {/* Connector lines */}
          <div
            className="left-1/6 right-1/6 absolute top-16 hidden h-px bg-gradient-to-r from-transparent via-border to-transparent md:block"
            style={{ left: '20%', right: '20%', top: '4rem' }}
          />

          {steps.map((step, index) => (
            <div key={index} className="relative text-center">
              {/* Number Badge */}
              <div
                className={`inline-flex h-24 w-24 items-center justify-center rounded-2xl bg-gradient-to-br ${step.gradient} mb-6 text-3xl font-bold text-white shadow-lg`}
              >
                {step.number}
              </div>

              {/* Content */}
              <h3 className="mb-4 text-2xl font-semibold">{step.title}</h3>
              <p className="mx-auto max-w-sm leading-relaxed text-muted-foreground">
                {step.description}
              </p>
            </div>
          ))}
        </div>

        {/* Features */}
        <div className="grid grid-cols-1 gap-8 border-t border-border/40 pt-12 sm:grid-cols-2 md:grid-cols-4">
          {features.map((feature, index) => (
            <div
              key={index}
              className="group rounded-2xl border border-border/50 bg-card/50 p-6 text-center transition-all hover:border-primary/50 hover:bg-card hover:shadow-lg"
            >
              <div className="mb-3 text-4xl transition-transform group-hover:scale-110">
                {feature.icon}
              </div>
              <h4 className="mb-2 text-lg font-semibold">{feature.title}</h4>
              <p className="text-sm text-muted-foreground">
                {feature.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

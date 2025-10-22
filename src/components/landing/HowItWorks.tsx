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
    gradient: 'from-[#8B5CF6] to-[#8B5CF6]',
  },
  {
    number: '02',
    title: 'Generate',
    description:
      'Watch as AI generates your app in real-time with components, layouts, and functionality.',
    gradient: 'from-[#8B5CF6] to-[#A855F7]',
  },
  {
    number: '03',
    title: 'Deploy',
    description:
      'Iterate, refine, export your code and deploy anywhere. You own everything.',
    gradient: 'from-[#8B5CF6] to-[#10B981]',
  },
];

type Stat = {
  value: string;
  label: string;
};

const stats: Stat[] = [
  { value: '10,000+', label: 'Apps Built' },
  { value: '< 2min', label: 'Avg Build Time' },
  { value: '99.9%', label: 'Uptime' },
  { value: '5,000+', label: 'Happy Creators' },
];

export function HowItWorks() {
  return (
    <section className="bg-gradient-to-b from-background via-muted/20 to-background px-4 py-24">
      <div className="mx-auto max-w-7xl">
        {/* Header */}
        <div className="mb-20 text-center">
          <h2 className="mb-4 text-4xl font-bold md:text-5xl">
            Why Choose Stryama?
          </h2>
          <p className="text-lg text-muted-foreground">
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

        {/* Stats */}
        <div className="grid grid-cols-2 gap-8 border-t border-border/40 pt-12 md:grid-cols-4">
          {stats.map((stat, index) => (
            <div key={index} className="text-center">
              <div className="mb-2 bg-gradient-to-r from-[#8B5CF6] to-[#10B981] bg-clip-text text-4xl font-bold text-transparent md:text-5xl">
                {stat.value}
              </div>
              <div className="text-sm text-muted-foreground">{stat.label}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

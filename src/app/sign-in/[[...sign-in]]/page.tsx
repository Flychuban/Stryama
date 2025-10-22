import { SignIn } from '@clerk/nextjs';

export default function SignInPage() {
  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      {/* Animated Background */}
      <div className="fixed inset-0 -z-10">
        <div className="gradient-mesh absolute inset-0 opacity-30" />
        <div className="absolute right-20 top-20 h-96 w-96 animate-float rounded-full bg-primary/20 blur-3xl" />
        <div
          className="absolute bottom-20 left-20 h-96 w-96 animate-float rounded-full bg-accent/20 blur-3xl"
          style={{ animationDelay: '2s' }}
        />
      </div>

      <SignIn
        appearance={{
          elements: {
            formButtonPrimary:
              'bg-primary hover:bg-primary/90 text-sm normal-case',
            card: 'shadow-2xl',
            headerTitle: 'text-2xl font-bold',
            headerSubtitle: 'text-muted-foreground',
            socialButtonsBlockButton:
              'border-border hover:bg-accent/5 text-foreground',
            formFieldLabel: 'text-foreground',
            formFieldInput:
              'border-border focus:border-primary focus:ring-primary',
            footerActionLink: 'text-primary hover:text-primary/80',
          },
        }}
      />
    </div>
  );
}

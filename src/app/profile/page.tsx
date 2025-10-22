import { UserProfile } from '@clerk/nextjs';
import { AppHeader } from '@/components/shared/AppHeader';

export default function ProfilePage() {
  return (
    <div className="min-h-screen bg-background">
      <AppHeader />

      {/* Animated Background */}
      <div className="fixed inset-0 -z-10">
        <div className="gradient-mesh absolute inset-0 opacity-30" />
        <div className="absolute right-20 top-20 h-96 w-96 animate-float rounded-full bg-primary/20 blur-3xl" />
        <div
          className="absolute bottom-20 left-20 h-96 w-96 animate-float rounded-full bg-accent/20 blur-3xl"
          style={{ animationDelay: '2s' }}
        />
      </div>

      {/* Main Content */}
      <main className="mx-auto max-w-4xl px-6 py-24">
        <div className="mb-8">
          <h1 className="mb-2 bg-gradient-to-r from-primary via-accent to-primary bg-clip-text text-4xl font-bold text-transparent">
            Profile Settings
          </h1>
          <p className="text-muted-foreground">
            Manage your account settings and preferences
          </p>
        </div>

        <UserProfile
          appearance={{
            elements: {
              rootBox: 'w-full',
              card: 'shadow-2xl',
              navbar: 'hidden',
              pageScrollBox: 'p-0',
              formButtonPrimary:
                'bg-primary hover:bg-primary/90 text-sm normal-case',
              formFieldInput:
                'border-border focus:border-primary focus:ring-primary',
              formFieldLabel: 'text-foreground',
              profileSectionPrimaryButton:
                'text-primary hover:bg-accent/5 normal-case',
            },
          }}
        />
      </main>
    </div>
  );
}

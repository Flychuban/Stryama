import { SignUp } from '@clerk/nextjs';
import Link from 'next/link';
import { Logo } from '@/components/shared/Logo';

export default function SignUpPage() {
  return (
    <div className="flex min-h-screen">
      {/* Left Side - Auth Form */}
      <div className="flex flex-1 items-center justify-center p-8">
        <div className="w-full max-w-md">
          <div className="mb-8 text-center">
            <Link href="/" className="mb-6 inline-flex">
              <Logo
                size={40}
                showText={true}
                withContainer
                containerVariant="subtle"
              />
            </Link>
          </div>

          <SignUp
            forceRedirectUrl="/dashboard"
            appearance={{
              elements: {
                rootBox: 'w-full',
                card: 'shadow-none border-0 bg-transparent w-full',
                headerTitle: 'text-3xl font-bold tracking-tight text-center',
                headerSubtitle: 'text-muted-foreground text-center mt-2',
                formContainer: 'space-y-6',
                formFieldRow: 'space-y-2',
                formFieldLabel: 'text-foreground font-medium',
                formFieldInput:
                  'h-11 border-border focus:border-primary focus:ring-primary bg-background',
                formFieldInputShowPasswordButton:
                  'text-muted-foreground hover:text-foreground',
                formButtonPrimary:
                  'w-full h-11 bg-primary hover:bg-primary/90 text-primary-foreground text-sm font-medium normal-case shadow-sm',
                dividerLine: 'bg-border',
                dividerText: 'text-xs uppercase text-muted-foreground',
                socialButtonsBlockButton:
                  'h-11 border-border hover:bg-accent/5 text-foreground font-normal normal-case',
                socialButtonsBlockButtonText: 'font-normal text-sm',
                footerActionText: 'text-center text-sm text-muted-foreground',
                footerActionLink: 'text-primary hover:underline font-medium',
                formFieldErrorText: 'text-xs text-destructive',
                cardBox: 'w-full shadow-none',
                main: 'w-full',
              },
              layout: {
                socialButtonsPlacement: 'bottom',
                socialButtonsVariant: 'blockButton',
              },
            }}
          />
        </div>
      </div>

      {/* Right Side - Hero */}
      <div className="relative hidden flex-1 overflow-hidden bg-gradient-to-br from-primary/10 via-accent/5 to-background lg:flex">
        <div className="absolute inset-0">
          <div className="absolute right-20 top-20 h-72 w-72 animate-float rounded-full bg-primary/20 blur-3xl" />
          <div
            className="absolute bottom-20 left-20 h-96 w-96 animate-float rounded-full bg-accent/20 blur-3xl"
            style={{ animationDelay: '2s' }}
          />
        </div>
        <div className="relative flex items-center justify-center p-12">
          <div className="max-w-md space-y-6 text-center">
            <h2 className="text-4xl font-bold">Join Thousands of Creators</h2>
            <p className="text-lg text-muted-foreground">
              Transform your ideas into reality with AI-powered development.
              Start creating in minutes.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

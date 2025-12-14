'use client';

import { useState, useEffect } from 'react';
import { useUser, useClerk } from '@clerk/nextjs';
import { AppHeader } from '@/components/shared/AppHeader';
import { AppFooter } from '@/components/shared/AppFooter';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useToast } from '@/hooks/use-toast';
import { Camera, Github, Cloud } from 'lucide-react';
import { UsageDashboard } from '@/components/dashboard/UsageDashboard';
import { SubscriptionManager } from '@/components/subscription/SubscriptionManager';
import { IntegrationCard } from '@/components/integrations/IntegrationCard';

export default function ProfilePage() {
  const { user, isLoaded } = useUser();
  const { openUserProfile } = useClerk();
  const { toast } = useToast();

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [isUpdating, setIsUpdating] = useState(false);

  // Update state when user data loads
  useEffect(() => {
    if (isLoaded && user) {
      setFirstName(user.firstName ?? '');
      setLastName(user.lastName ?? '');
    }
  }, [isLoaded, user]);

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setIsUpdating(true);
    try {
      await user.update({
        firstName,
        lastName,
      });

      toast({
        title: 'Profile updated',
        description: 'Your changes have been saved successfully.',
      });
    } catch {
      toast({
        title: 'Error',
        description: 'Failed to update profile. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsUpdating(false);
    }
  };

  const handlePasswordUpdate = () => {
    // Open Clerk's password update modal
    openUserProfile({ appearance: { elements: { rootBox: 'z-50' } } });
  };

  const handleTwoFactorAuth = () => {
    // Open Clerk's 2FA settings modal
    openUserProfile({ appearance: { elements: { rootBox: 'z-50' } } });
  };

  if (!isLoaded || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
      </div>
    );
  }

  const userInitials = `${user.firstName?.[0] ?? ''}${user.lastName?.[0] ?? ''}`;
  const userEmail =
    user.primaryEmailAddress?.emailAddress ?? 'No email available';

  return (
    <div className="min-h-screen bg-background">
      <AppHeader />

      {/* Animated Background */}
      <div className="fixed inset-0 -z-10">
        <div className="gradient-mesh absolute inset-0 animate-gradient-shift opacity-30" />
        <div className="absolute right-0 top-0 h-[500px] w-[500px] animate-float rounded-full bg-primary/10 blur-[120px]" />
        <div
          className="absolute bottom-0 left-0 h-[500px] w-[500px] animate-float rounded-full bg-accent/10 blur-[120px]"
          style={{ animationDelay: '2s' }}
        />
      </div>

      <main className="px-6 pb-16 pt-24">
        <div className="mx-auto max-w-4xl space-y-8">
          {/* Profile Header */}
          <div className="space-y-4 text-center">
            <div className="relative inline-block">
              <Avatar className="h-24 w-24 border-4 border-background shadow-lg">
                {user.imageUrl && <AvatarImage src={user.imageUrl} />}
                <AvatarFallback className="bg-gradient-to-br from-primary to-accent text-2xl text-white">
                  {userInitials}
                </AvatarFallback>
              </Avatar>
              <Button
                size="icon"
                variant="secondary"
                className="absolute bottom-0 right-0 h-8 w-8 rounded-full shadow-lg"
                onClick={() => openUserProfile()}
              >
                <Camera className="h-4 w-4" />
              </Button>
            </div>
            <div>
              <h1 className="text-3xl font-bold">
                {user.firstName} {user.lastName}
              </h1>
              <p className="text-muted-foreground">{userEmail}</p>
            </div>
          </div>

          {/* Usage & Plan */}
          <UsageDashboard />

          {/* Subscription Management */}
          <SubscriptionManager />

          {/* Profile Settings */}
          <Card className="border-border/50 shadow-lg">
            <CardHeader>
              <CardTitle>Personal Information</CardTitle>
              <CardDescription>Update your profile details</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleUpdateProfile} className="space-y-6">
                <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="firstName">First Name</Label>
                    <Input
                      id="firstName"
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      className="h-11"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="lastName">Last Name</Label>
                    <Input
                      id="lastName"
                      value={lastName}
                      onChange={(e) => setLastName(e.target.value)}
                      className="h-11"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={userEmail}
                    disabled
                    className="h-11 cursor-not-allowed opacity-60"
                  />
                  <p className="text-xs text-muted-foreground">
                    To change your email, use the account settings below
                  </p>
                </div>

                <Button
                  type="submit"
                  className="w-full md:w-auto"
                  disabled={isUpdating}
                >
                  {isUpdating ? 'Saving...' : 'Save Changes'}
                </Button>
              </form>
            </CardContent>
          </Card>

          {/* Account Settings */}
          <Card className="border-border/50 shadow-lg">
            <CardHeader>
              <CardTitle>Account Settings</CardTitle>
              <CardDescription>Manage your account preferences</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between border-b border-border/50 py-3">
                <div>
                  <h3 className="font-medium">Password</h3>
                  <p className="text-sm text-muted-foreground">
                    Change your password
                  </p>
                </div>
                <Button variant="outline" onClick={handlePasswordUpdate}>
                  Update
                </Button>
              </div>

              <div className="flex items-center justify-between border-b border-border/50 py-3">
                <div>
                  <h3 className="font-medium">Email & Authentication</h3>
                  <p className="text-sm text-muted-foreground">
                    Manage email addresses and security settings
                  </p>
                </div>
                <Button variant="outline" onClick={handleTwoFactorAuth}>
                  Manage
                </Button>
              </div>

              <div className="flex items-center justify-between py-3">
                <div>
                  <h3 className="font-medium text-destructive">
                    Delete Account
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    Permanently delete your account
                  </p>
                </div>
                <Button
                  variant="destructive"
                  className="bg-destructive/10 text-destructive hover:bg-destructive hover:text-destructive-foreground"
                  onClick={() => openUserProfile()}
                >
                  Delete
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Integrations */}
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-bold">Integrations</h2>
              <p className="text-muted-foreground">
                Manage your connected GitHub and Netlify accounts
              </p>
            </div>

            {/* GitHub Integration Card */}
            <IntegrationCard
              name="GitHub"
              description="Export projects to GitHub repositories"
              icon={<Github className="h-5 w-5" />}
              type="github"
            />

            {/* Netlify Integration Card */}
            <IntegrationCard
              name="Netlify"
              description="Deploy projects with one click"
              icon={<Cloud className="h-5 w-5" />}
              type="netlify"
            />
          </div>
        </div>
      </main>

      {/* Footer */}
      <AppFooter />
    </div>
  );
}

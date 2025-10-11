import { UserProfile } from '@clerk/nextjs';

export default function ProfilePage() {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <UserProfile />
    </div>
  );
}

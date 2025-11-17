import { type Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Profile Settings',
  description:
    'Manage your account settings, subscription, and usage statistics on Stryama.',
  robots: {
    index: false,
    follow: false,
  },
};

export default function ProfileLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}

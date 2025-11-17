import { type Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Dashboard - My Projects',
  description:
    'View and manage your AI-generated projects. Build apps in minutes with Stryama.',
  robots: {
    index: false,
    follow: false,
  },
};

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}

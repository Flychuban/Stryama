import { type Metadata } from 'next';

export const metadata: Metadata = {
  title: 'App Editor',
  description:
    'Build and customize your app with AI assistance. Preview changes in real-time.',
  robots: {
    index: false,
    follow: false,
  },
};

export default function EditorLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}

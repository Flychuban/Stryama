import { HydrateClient } from '~/trpc/server';

export default async function Home() {
  return (
    <HydrateClient>
      <main className="flex min-h-screen flex-col items-center justify-center">
        <h1 className="text-4xl font-bold">Welcome to Stryama</h1>
      </main>
    </HydrateClient>
  );
}

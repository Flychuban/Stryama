import {
  defaultShouldDehydrateQuery,
  QueryCache,
  QueryClient,
} from '@tanstack/react-query';
import SuperJSON from 'superjson';

export const createQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: {
        // With SSR, we usually want to set some default staleTime
        // above 0 to avoid refetching immediately on the client
        staleTime: 30 * 1000,
        // Disable automatic refetching on window focus to prevent auth race conditions
        // When React Query refetches stale queries, Clerk's auth tokens may be expired
        refetchOnWindowFocus: false,
        // Don't retry on authentication errors (401)
        retry: (failureCount, error) => {
          // Check if error is an auth error
          if (
            error &&
            typeof error === 'object' &&
            'message' in error &&
            typeof error.message === 'string' &&
            (error.message.includes('UNAUTHORIZED') ||
              error.message.includes('401'))
          ) {
            return false; // Don't retry auth errors
          }
          return failureCount < 3; // Standard retry logic for other errors
        },
      },
      mutations: {
        // Don't retry mutations on authentication errors
        retry: (failureCount, error) => {
          if (
            error &&
            typeof error === 'object' &&
            'message' in error &&
            typeof error.message === 'string' &&
            (error.message.includes('UNAUTHORIZED') ||
              error.message.includes('401'))
          ) {
            return false;
          }
          return failureCount < 1; // Mutations typically shouldn't retry automatically
        },
      },
      dehydrate: {
        serializeData: SuperJSON.serialize,
        shouldDehydrateQuery: (query) =>
          defaultShouldDehydrateQuery(query) ||
          query.state.status === 'pending',
      },
      hydrate: {
        deserializeData: SuperJSON.deserialize,
      },
    },
    // Global error handler for authentication failures
    queryCache: new QueryCache({
      onError: (error, query) => {
        // Check if this is an auth error
        const isAuthError =
          error &&
          typeof error === 'object' &&
          'message' in error &&
          typeof error.message === 'string' &&
          (error.message.includes('UNAUTHORIZED') ||
            error.message.includes('401'));

        if (isAuthError) {
          console.error('[React Query] Authentication error detected:', error);
          console.warn(
            '[React Query] Query failed due to auth:',
            query.queryKey
          );

          // Option: Force page reload to refresh Clerk session
          // Uncomment if you want automatic recovery via page reload
          // if (typeof window !== 'undefined') {
          //   console.warn('[React Query] Reloading page to refresh authentication');
          //   window.location.reload();
          // }
        }
      },
    }),
  });

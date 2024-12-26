import { QueryClientConfig, hashKey } from '@tanstack/query-core';

const MAX_FAILURE_COUNT = 3;

export const defaultQueryClientConfig = {
  defaultOptions: {
    queries: {
      throwOnError: true,
      queryKeyHashFn: hashKey,
      refetchOnWindowFocus: 'always',
      refetchOnReconnect: 'always',
      staleTime: 5 * 60 * 1000,
      retry: (failureCount, error) => {
        if (error instanceof Response && error.status >= 500) {
          return MAX_FAILURE_COUNT - failureCount > 0;
        }
        return false;
      },
    },
    mutations: {
      throwOnError: true,
    },
  },
} satisfies QueryClientConfig;

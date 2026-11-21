import { hashKey } from '@tanstack/query-core';

import { FetchError, type QueryClientConfig } from 'mobx-tanstack-query';

export const defaultQueryClientConfig = {
  defaultOptions: {
    queries: {
      throwOnError: true,
      queryKeyHashFn: hashKey,
      refetchOnWindowFocus: 'always',
      refetchOnReconnect: 'always',
      staleTime: 5 * 60 * 1000,
      retry: (failureCount, error) => {
        const response = error instanceof FetchError ? error.response : error;
        if (response instanceof Response && response.status >= 500) {
          return failureCount < 3;
        }
        return false;
      },
    },
    mutations: {
      throwOnError: true,
    },
  },
} satisfies QueryClientConfig;

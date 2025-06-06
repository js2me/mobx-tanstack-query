import { hashKey } from '@tanstack/query-core';

import { QueryClientConfig } from '../../mobx-query-client.types';

export const defaultQueryClientConfig = {
  defaultOptions: {
    queries: {
      throwOnError: true,
      queryKeyHashFn: hashKey,
      refetchOnWindowFocus: 'always',
      refetchOnReconnect: 'always',
      structuralSharing: false, // see https://github.com/js2me/mobx-tanstack-query/issues/7
      staleTime: 5 * 60 * 1000,
      retry: (failureCount, error) => {
        if (error instanceof Response && error.status >= 500) {
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

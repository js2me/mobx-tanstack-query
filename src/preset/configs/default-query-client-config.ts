import { hashKey } from '@tanstack/query-core';

import { MobxQueryClientConfig } from '../../mobx-query-client';

const MAX_FAILURE_COUNT = 3;

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
          return MAX_FAILURE_COUNT - failureCount > 0;
        }
        return false;
      },
    },
    mutations: {
      throwOnError: true,
    },
  },
} satisfies MobxQueryClientConfig;

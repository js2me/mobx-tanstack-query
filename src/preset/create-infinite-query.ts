import { DefaultError, QueryClient, QueryKey } from '@tanstack/query-core';

import { InfiniteQuery } from '../inifinite-query';
import { InfiniteQueryConfig } from '../inifinite-query.types';

import { queryClient } from './query-client';

export type CreateInfiniteQueryParams<
  TData,
  TError = DefaultError,
  TQueryKey extends QueryKey = any,
  TPageParam = unknown,
> = Omit<
  InfiniteQueryConfig<TData, TError, TQueryKey, TPageParam>,
  'queryClient' | 'queryFn'
> & {
  queryClient?: QueryClient;
};

export const createInfiniteQuery = <
  TData,
  TError = DefaultError,
  TQueryKey extends QueryKey = any,
  TPageParam = unknown,
>(
  fn: InfiniteQueryConfig<TData, TError, TQueryKey, TPageParam>['queryFn'],
  params: CreateInfiniteQueryParams<TData, TError, TQueryKey, TPageParam>,
) => {
  return new InfiniteQuery({
    ...params,
    queryClient: params?.queryClient ?? queryClient,
    queryFn: fn,
    onInit: (query) => {
      queryClient.mount();
      params?.onInit?.(query);
    },
  });
};

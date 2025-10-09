import {
  DefaultError,
  InfiniteData,
  QueryClient,
  QueryKey,
} from '@tanstack/query-core';

import { InfiniteQuery, InfiniteQueryConfig } from '../index.js';

import { queryClient } from './query-client';

export type CreateInfiniteQueryParams<
  TQueryFnData = unknown,
  TError = DefaultError,
  TPageParam = unknown,
  TData = InfiniteData<TQueryFnData, TPageParam>,
  TQueryKey extends QueryKey = QueryKey,
> = Omit<
  InfiniteQueryConfig<TQueryFnData, TError, TPageParam, TData, TQueryKey>,
  'queryClient' | 'queryFn'
> & {
  queryClient?: QueryClient;
};

export const createInfiniteQuery = <
  TQueryFnData = unknown,
  TError = DefaultError,
  TPageParam = unknown,
  TData = InfiniteData<TQueryFnData, TPageParam>,
  TQueryKey extends QueryKey = QueryKey,
>(
  fn: InfiniteQueryConfig<
    TQueryFnData,
    TError,
    TPageParam,
    TData,
    TQueryKey
  >['queryFn'],
  params: CreateInfiniteQueryParams<
    TQueryFnData,
    TError,
    TPageParam,
    TData,
    TQueryKey
  >,
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

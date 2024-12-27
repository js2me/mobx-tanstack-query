import { DefaultError, QueryClient, QueryKey } from '@tanstack/query-core';

import { MobxInfiniteQuery } from '../mobx-inifinite-query';
import { MobxInfiniteQueryConfig } from '../mobx-inifinite-query.types';

import { queryClient } from './query-client';

export type CreateInfiniteQueryParams<
  TData,
  TError = DefaultError,
  TQueryKey extends QueryKey = any,
  TPageParam = unknown,
> = Omit<
  MobxInfiniteQueryConfig<TData, TError, TQueryKey, TPageParam>,
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
  fn: MobxInfiniteQueryConfig<TData, TError, TQueryKey, TPageParam>['queryFn'],
  params?: CreateInfiniteQueryParams<TData, TError, TQueryKey, TPageParam>,
) => {
  return new MobxInfiniteQuery({
    ...params,
    queryClient: params?.queryClient ?? queryClient,
    queryFn: fn,
    onInit: (query) => {
      queryClient.mount();
      params?.onInit?.(query);
    },
  });
};

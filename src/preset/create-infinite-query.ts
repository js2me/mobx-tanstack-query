import { DefaultError, QueryKey } from '@tanstack/query-core';

import { MobxInfiniteQuery } from '../mobx-inifinite-query';
import { MobxInfiniteQueryConfig } from '../mobx-inifinite-query.types';

import { queryClient } from './query-client';

export const createInfiniteQuery = <
  TData,
  TError = DefaultError,
  TQueryKey extends QueryKey = any,
  TPageParam = unknown,
>(
  fn: MobxInfiniteQueryConfig<TData, TError, TQueryKey, TPageParam>['queryFn'],
  params?: Omit<
    MobxInfiniteQueryConfig<TData, TError, TQueryKey, TPageParam>,
    'queryClient' | 'queryFn'
  >,
) => {
  return new MobxInfiniteQuery({
    queryClient,
    ...params,
    queryFn: fn,
    onInit: (query) => {
      queryClient.mount();
      params?.onInit?.(query);
    },
  });
};

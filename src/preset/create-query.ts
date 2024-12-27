import { DefaultError, QueryClient, QueryKey } from '@tanstack/query-core';

import { MobxQuery } from '../mobx-query';
import { MobxQueryConfig } from '../mobx-query.types';

import { queryClient } from './query-client';

export type CreateQueryParams<
  TData,
  TError = DefaultError,
  TQueryKey extends QueryKey = any,
> = Omit<
  MobxQueryConfig<TData, TError, TQueryKey>,
  'queryClient' | 'queryFn'
> & {
  queryClient?: QueryClient;
};

export const createQuery = <
  TData,
  TError = DefaultError,
  TQueryKey extends QueryKey = any,
>(
  fn: MobxQueryConfig<TData, TError, TQueryKey>['queryFn'],
  params?: CreateQueryParams<TData, TError, TQueryKey>,
) => {
  return new MobxQuery({
    ...params,
    queryClient: params?.queryClient ?? queryClient,
    queryFn: fn,
    onInit: (query) => {
      queryClient.mount();
      params?.onInit?.(query);
    },
  });
};

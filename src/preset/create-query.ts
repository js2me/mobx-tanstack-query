import { DefaultError, QueryClient, QueryKey } from '@tanstack/query-core';

import { MobxQuery } from '../mobx-query';
import { AnyQueryClient } from '../mobx-query-client.types';
import { MobxQueryConfig, MobxQueryFn } from '../mobx-query.types';
import { QueryOptionsParams } from '../query-options';

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

export function createQuery<
  TData,
  TError = DefaultError,
  TQueryKey extends QueryKey = any,
>(
  options: QueryOptionsParams<TData, TError, TQueryKey>,
): MobxQuery<TData, TError, TQueryKey>;

export function createQuery<
  TData,
  TError = DefaultError,
  TQueryKey extends QueryKey = any,
>(
  queryFn: MobxQueryFn<TData, TError, TQueryKey>,
  params?: CreateQueryParams<TData, TError, TQueryKey>,
): MobxQuery<TData, TError, TQueryKey>;

export function createQuery<
  TData,
  TError = DefaultError,
  TQueryKey extends QueryKey = any,
>(
  queryClient: AnyQueryClient,
  options: () => QueryOptionsParams<TData, TError, TQueryKey>,
): MobxQuery<TData, TError, TQueryKey>;

export function createQuery(...args: [any, any?]) {
  if (typeof args[0] === 'function') {
    return new MobxQuery({
      ...args[1],
      queryClient: args[1]?.queryClient ?? queryClient,
      queryFn: args[0],
      onInit: (query) => {
        queryClient.mount();
        args[0]?.onInit?.(query);
      },
    });
  } else if (args.length === 2) {
    return new MobxQuery(args[0], args[1]());
  }

  return new MobxQuery(queryClient, args[0]);
}

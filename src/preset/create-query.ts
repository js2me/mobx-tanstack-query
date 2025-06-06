import { DefaultError, QueryClient, QueryKey } from '@tanstack/query-core';

import { MobxQuery } from '../mobx-query';
import { AnyQueryClient } from '../mobx-query-client.types';
import { MobxQueryConfig, MobxQueryFn } from '../mobx-query.types';
import { QueryOptionsParams } from '../query-options';

import { queryClient } from './query-client';

export type CreateQueryParams<
  TQueryFnData = unknown,
  TError = DefaultError,
  TData = TQueryFnData,
  TQueryData = TQueryFnData,
  TQueryKey extends QueryKey = QueryKey,
> = Omit<
  MobxQueryConfig<TQueryFnData, TError, TData, TQueryData, TQueryKey>,
  'queryClient' | 'queryFn'
> & {
  queryClient?: QueryClient;
};

export function createQuery<
  TQueryFnData = unknown,
  TError = DefaultError,
  TData = TQueryFnData,
  TQueryData = TQueryFnData,
  TQueryKey extends QueryKey = QueryKey,
>(
  options: QueryOptionsParams<
    TQueryFnData,
    TError,
    TData,
    TQueryData,
    TQueryKey
  >,
): MobxQuery<TQueryFnData, TError, TData, TQueryData, TQueryKey>;

export function createQuery<
  TQueryFnData = unknown,
  TError = DefaultError,
  TData = TQueryFnData,
  TQueryData = TQueryFnData,
  TQueryKey extends QueryKey = QueryKey,
>(
  queryFn: MobxQueryFn<TQueryFnData, TError, TData, TQueryData, TQueryKey>,
  params?: CreateQueryParams<
    TQueryFnData,
    TError,
    TData,
    TQueryData,
    TQueryKey
  >,
): MobxQuery<TData, TError, TQueryKey, TQueryData, TQueryKey>;

export function createQuery<
  TQueryFnData = unknown,
  TError = DefaultError,
  TData = TQueryFnData,
  TQueryData = TQueryFnData,
  TQueryKey extends QueryKey = QueryKey,
>(
  queryClient: AnyQueryClient,
  options: () => QueryOptionsParams<
    TQueryFnData,
    TError,
    TData,
    TQueryData,
    TQueryKey
  >,
): MobxQuery<TQueryFnData, TError, TData, TQueryData, TQueryKey>;

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

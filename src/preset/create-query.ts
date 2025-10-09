import type { DefaultError, QueryClient, QueryKey } from '@tanstack/query-core';

import {
  type AnyQueryClient,
  Query,
  type QueryConfig,
  type QueryFn,
  type QueryOptionsParams,
} from 'mobx-tanstack-query';

import { queryClient } from './query-client.js';

export type CreateQueryParams<
  TQueryFnData = unknown,
  TError = DefaultError,
  TData = TQueryFnData,
  TQueryData = TQueryFnData,
  TQueryKey extends QueryKey = QueryKey,
> = Omit<
  QueryConfig<TQueryFnData, TError, TData, TQueryData, TQueryKey>,
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
): Query<TQueryFnData, TError, TData, TQueryData, TQueryKey>;

export function createQuery<
  TQueryFnData = unknown,
  TError = DefaultError,
  TData = TQueryFnData,
  TQueryData = TQueryFnData,
  TQueryKey extends QueryKey = QueryKey,
>(
  queryFn: QueryFn<TQueryFnData, TError, TData, TQueryData, TQueryKey>,
  params?: CreateQueryParams<
    TQueryFnData,
    TError,
    TData,
    TQueryData,
    TQueryKey
  >,
): Query<TQueryFnData, TError, TData, TQueryData, TQueryKey>;

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
): Query<TQueryFnData, TError, TData, TQueryData, TQueryKey>;

export function createQuery(...args: [any, any?]) {
  if (typeof args[0] === 'function') {
    return new Query({
      ...args[1],
      queryClient: args[1]?.queryClient ?? queryClient,
      queryFn: args[0],
      onInit: (query) => {
        queryClient.mount();
        args[0]?.onInit?.(query);
      },
    });
  } else if (args.length === 2) {
    return new Query(args[0], args[1]());
  }

  return new Query(queryClient, args[0]);
}

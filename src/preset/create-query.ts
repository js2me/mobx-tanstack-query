import type {
  DefaultError,
  QueryFunction,
  QueryKey,
} from '@tanstack/query-core';

import { Query, type QueryConfig } from 'mobx-tanstack-query';
import { queryClient } from './query-client.js';

export interface CreateQueryFnConfig<
  TQueryFnData = unknown,
  TError = DefaultError,
  TData = TQueryFnData,
  TQueryData = TQueryFnData,
  TQueryKey extends QueryKey = QueryKey,
> extends QueryConfig<TQueryFnData, TError, TData, TQueryData, TQueryKey> {}

export function createQuery<
  TQueryFnData,
  TError = DefaultError,
  TData = TQueryFnData,
  TQueryData = TQueryFnData,
  TQueryKey extends QueryKey = QueryKey,
>(
  queryFn: QueryFunction<TQueryFnData, TQueryKey>,
  options?: Omit<
    Partial<
      CreateQueryFnConfig<TQueryFnData, TError, TData, TQueryData, TQueryKey>
    >,
    'queryFn'
  >,
): Query<TQueryFnData, TError, TData, TQueryData, TQueryKey>;

export function createQuery<
  TQueryFnData,
  TError = DefaultError,
  TData = TQueryFnData,
  TQueryData = TQueryFnData,
  TQueryKey extends QueryKey = QueryKey,
>(
  options: CreateQueryFnConfig<
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
    return new Query(
      args[0],
      typeof args[1] === 'function' ? args[1] : () => args[1],
    );
  }

  return new Query(
    queryClient,
    typeof args[0] === 'function' ? args[0] : () => args[0],
  );
}

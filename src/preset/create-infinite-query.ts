import type {
  DefaultError,
  InfiniteData,
  QueryFunction,
  QueryKey,
} from '@tanstack/query-core';
import {
  type AnyQueryClient,
  getQueryClient,
  InfiniteQuery,
  type InfiniteQueryConfig,
  mountQueryClientOnce,
} from 'mobx-tanstack-query';
import type { PartialKeys } from 'yummies/types';
import { queryClient } from './query-client.js';

export interface CreateInfiniteQueryFnConfig<
  TQueryFnData = unknown,
  TError = DefaultError,
  TPageParam = unknown,
  TData = InfiniteData<TQueryFnData, TPageParam>,
  TQueryKey extends QueryKey = QueryKey,
> extends InfiniteQueryConfig<
    TQueryFnData,
    TError,
    TPageParam,
    TData,
    TQueryKey
  > {}

export function createInfiniteQuery<
  TQueryFnData = unknown,
  TError = DefaultError,
  TPageParam = unknown,
  TData = InfiniteData<TQueryFnData, TPageParam>,
  TQueryKey extends QueryKey = QueryKey,
>(
  queryClient: AnyQueryClient,
  options:
    | Omit<
        Partial<
          CreateInfiniteQueryFnConfig<
            TQueryFnData,
            TError,
            TPageParam,
            TData,
            TQueryKey
          >
        >,
        'queryClient'
      >
    | (() => Omit<
        Partial<
          CreateInfiniteQueryFnConfig<
            TQueryFnData,
            TError,
            TPageParam,
            TData,
            TQueryKey
          >
        >,
        'queryClient'
      >),
): InfiniteQuery<TQueryFnData, TError, TPageParam, TData, TQueryKey>;

export function createInfiniteQuery<
  TQueryFnData = unknown,
  TError = DefaultError,
  TPageParam = unknown,
  TData = InfiniteData<TQueryFnData, TPageParam>,
  TQueryKey extends QueryKey = QueryKey,
>(
  queryFn: QueryFunction<TQueryFnData, TQueryKey>,
  options: Omit<
    PartialKeys<
      CreateInfiniteQueryFnConfig<
        NoInfer<TQueryFnData>,
        TError,
        TPageParam,
        TData,
        TQueryKey
      >,
      'queryClient'
    >,
    'queryFn'
  >,
): InfiniteQuery<TQueryFnData, TError, TPageParam, TData, TQueryKey>;

export function createInfiniteQuery<
  TQueryFnData = unknown,
  TError = DefaultError,
  TPageParam = unknown,
  TData = InfiniteData<TQueryFnData, TPageParam>,
  TQueryKey extends QueryKey = QueryKey,
>(
  options: PartialKeys<
    CreateInfiniteQueryFnConfig<
      TQueryFnData,
      TError,
      TPageParam,
      TData,
      TQueryKey
    >,
    'queryClient'
  >,
): InfiniteQuery<TQueryFnData, TError, TPageParam, TData, TQueryKey>;

export function createInfiniteQuery(...args: [any, any?]) {
  let query: InfiniteQuery;

  if (typeof args[0] === 'function') {
    query = new InfiniteQuery({
      ...args[1],
      queryClient: args[1]?.queryClient ?? queryClient,
      queryFn: args[0],
    });
  } else if (args.length === 2) {
    query = new InfiniteQuery(
      args[0],
      typeof args[1] === 'function' ? args[1] : () => args[1],
    );
  } else {
    const options = args[0];
    query = new InfiniteQuery({
      ...options,
      queryClient: options.queryClient ?? queryClient,
    });
  }

  mountQueryClientOnce(getQueryClient(query));

  return query;
}

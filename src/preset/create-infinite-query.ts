import type {
  DefaultError,
  InfiniteData,
  QueryFunction,
  QueryKey,
} from '@tanstack/query-core';
import {
  type AnyQueryClient,
  InfiniteQuery,
  type InfiniteQueryConfig,
} from 'mobx-tanstack-query';
import type { PartialKeys } from 'yummies/types';
import { createQueryInstance } from './create-query-instance.js';

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
  return createQueryInstance(InfiniteQuery, args);
}

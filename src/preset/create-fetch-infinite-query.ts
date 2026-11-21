import type { DefaultError, InfiniteData } from '@tanstack/query-core';
import {
  type AnyQueryClient,
  FetchInfiniteQuery,
  type FetchInfiniteQueryConfig,
} from 'mobx-tanstack-query';
import type { PartialKeys } from 'yummies/types';
import { createFetchQueryInstance } from './create-query-instance.js';

export interface CreateFetchInfiniteQueryFnConfig<
  TQueryFnData = unknown,
  TError = DefaultError,
  TPageParam = unknown,
  TData = InfiniteData<TQueryFnData | null, TPageParam>,
> extends FetchInfiniteQueryConfig<TQueryFnData, TError, TPageParam, TData> {}

type ClientOptions<TQueryFnData, TError, TPageParam, TData> = Omit<
  PartialKeys<
    CreateFetchInfiniteQueryFnConfig<TQueryFnData, TError, TPageParam, TData>,
    'queryClient'
  >,
  'queryClient'
>;

export function createFetchInfiniteQuery<
  TQueryFnData = unknown,
  TError = DefaultError,
  TPageParam = unknown,
  TData = InfiniteData<TQueryFnData | null, TPageParam>,
>(
  queryClient: AnyQueryClient,
  options:
    | ClientOptions<TQueryFnData, TError, TPageParam, TData>
    | (() => ClientOptions<TQueryFnData, TError, TPageParam, TData>),
): FetchInfiniteQuery<TQueryFnData, TError, TPageParam, TData>;

export function createFetchInfiniteQuery<
  TQueryFnData = unknown,
  TError = DefaultError,
  TPageParam = unknown,
  TData = InfiniteData<TQueryFnData | null, TPageParam>,
>(
  options: () => PartialKeys<
    CreateFetchInfiniteQueryFnConfig<TQueryFnData, TError, TPageParam, TData>,
    'queryClient'
  >,
): FetchInfiniteQuery<TQueryFnData, TError, TPageParam, TData>;

export function createFetchInfiniteQuery<
  TQueryFnData = unknown,
  TError = DefaultError,
  TPageParam = unknown,
  TData = InfiniteData<TQueryFnData | null, TPageParam>,
>(
  options: PartialKeys<
    CreateFetchInfiniteQueryFnConfig<TQueryFnData, TError, TPageParam, TData>,
    'queryClient'
  >,
): FetchInfiniteQuery<TQueryFnData, TError, TPageParam, TData>;

export function createFetchInfiniteQuery(...args: [any, any?]) {
  return createFetchQueryInstance(FetchInfiniteQuery, args);
}

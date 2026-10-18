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
  TData = InfiniteData<TQueryFnData, TPageParam>,
  TOutputData = any,
> extends FetchInfiniteQueryConfig<
    TQueryFnData,
    TError,
    TPageParam,
    TData,
    TOutputData
  > {}

type ClientOptions<TQueryFnData, TError, TPageParam, TData, TOutputData> = Omit<
  PartialKeys<
    CreateFetchInfiniteQueryFnConfig<
      TQueryFnData,
      TError,
      TPageParam,
      TData,
      TOutputData
    >,
    'queryClient'
  >,
  'queryClient'
>;

export function createFetchInfiniteQuery<
  TQueryFnData = unknown,
  TError = DefaultError,
  TPageParam = unknown,
  TData = InfiniteData<TQueryFnData, TPageParam>,
  TOutputData = any,
>(
  queryClient: AnyQueryClient,
  options:
    | ClientOptions<TQueryFnData, TError, TPageParam, TData, TOutputData>
    | (() => ClientOptions<
        TQueryFnData,
        TError,
        TPageParam,
        TData,
        TOutputData
      >),
): FetchInfiniteQuery<TQueryFnData, TError, TPageParam, TData, TOutputData>;

export function createFetchInfiniteQuery<
  TQueryFnData = unknown,
  TError = DefaultError,
  TPageParam = unknown,
  TData = InfiniteData<TQueryFnData, TPageParam>,
  TOutputData = any,
>(
  options: () => PartialKeys<
    CreateFetchInfiniteQueryFnConfig<
      TQueryFnData,
      TError,
      TPageParam,
      TData,
      TOutputData
    >,
    'queryClient'
  >,
): FetchInfiniteQuery<TQueryFnData, TError, TPageParam, TData, TOutputData>;

export function createFetchInfiniteQuery<
  TQueryFnData = unknown,
  TError = DefaultError,
  TPageParam = unknown,
  TData = InfiniteData<TQueryFnData, TPageParam>,
  TOutputData = any,
>(
  options: PartialKeys<
    CreateFetchInfiniteQueryFnConfig<
      TQueryFnData,
      TError,
      TPageParam,
      TData,
      TOutputData
    >,
    'queryClient'
  >,
): FetchInfiniteQuery<TQueryFnData, TError, TPageParam, TData, TOutputData>;

export function createFetchInfiniteQuery(...args: [any, any?]) {
  return createFetchQueryInstance(FetchInfiniteQuery, args);
}

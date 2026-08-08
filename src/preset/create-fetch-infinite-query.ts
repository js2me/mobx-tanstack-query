import type { DefaultError, InfiniteData } from '@tanstack/query-core';
import {
  type AnyQueryClient,
  FetchInfiniteQuery,
  type FetchInfiniteQueryConfig,
  getQueryClient,
  mountQueryClientOnce,
} from 'mobx-tanstack-query';
import type { PartialKeys } from 'yummies/types';
import { queryClient } from './query-client.js';

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

export function createFetchInfiniteQuery<
  TQueryFnData = unknown,
  TError = DefaultError,
  TPageParam = unknown,
  TData = InfiniteData<TQueryFnData, TPageParam>,
  TOutputData = any,
>(
  queryClient: AnyQueryClient,
  options:
    | Omit<
        Partial<
          CreateFetchInfiniteQueryFnConfig<
            TQueryFnData,
            TError,
            TPageParam,
            TData,
            TOutputData
          >
        >,
        'queryClient'
      >
    | (() => Omit<
        Partial<
          CreateFetchInfiniteQueryFnConfig<
            TQueryFnData,
            TError,
            TPageParam,
            TData,
            TOutputData
          >
        >,
        'queryClient'
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
  let fetchInfiniteQuery: FetchInfiniteQuery;

  if (args.length === 2) {
    if (typeof args[1] === 'function') {
      const getOptions = args[1];
      fetchInfiniteQuery = new FetchInfiniteQuery(() => ({
        ...getOptions(),
        queryClient: args[0],
      }));
    } else {
      fetchInfiniteQuery = new FetchInfiniteQuery(args[0], args[1]);
    }
  } else if (typeof args[0] === 'function') {
    const getOptions = args[0];
    fetchInfiniteQuery = new FetchInfiniteQuery(() => {
      const options = getOptions();
      return {
        ...options,
        queryClient: options.queryClient ?? queryClient,
      };
    });
  } else {
    const options = args[0];
    fetchInfiniteQuery = new FetchInfiniteQuery({
      ...options,
      queryClient: options.queryClient ?? queryClient,
    });
  }

  mountQueryClientOnce(getQueryClient(fetchInfiniteQuery));

  return fetchInfiniteQuery;
}

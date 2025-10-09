import type { DefaultError, QueryKey } from '@tanstack/query-core';

import type { QueryConfig } from './query.types.js';

export interface QueryOptionsParams<
  TQueryFnData = unknown,
  TError = DefaultError,
  TData = TQueryFnData,
  TQueryData = TQueryFnData,
  TQueryKey extends QueryKey = QueryKey,
> extends Omit<
    QueryConfig<TQueryFnData, TError, TData, TQueryData, TQueryKey>,
    'queryClient' | 'options'
  > {}

export function queryOptions<
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
): QueryOptionsParams<TQueryFnData, TError, TData, TQueryData, TQueryKey>;

export function queryOptions(options: unknown) {
  return options;
}

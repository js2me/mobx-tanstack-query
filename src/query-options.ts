import { DefaultError, QueryKey } from '@tanstack/query-core';

import { QueryConfig } from './query.types';

export interface QueryOptionsParams<
  TQueryFnData = unknown,
  TError = DefaultError,
  TData = TQueryFnData,
  TQueryData = TQueryFnData,
  TQueryKey extends QueryKey = QueryKey,
> extends Omit<
    QueryConfig<TQueryFnData, TError, TData, TQueryData, TQueryKey>,
    'queryClient'
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

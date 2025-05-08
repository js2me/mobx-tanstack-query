import { DefaultError, QueryKey } from '@tanstack/query-core';

import { MobxQueryConfig } from './mobx-query.types';

export interface QueryOptionsParams<
  TQueryFnData = unknown,
  TError = DefaultError,
  TData = TQueryFnData,
  TQueryData = TQueryFnData,
  TQueryKey extends QueryKey = QueryKey,
> extends Omit<
    MobxQueryConfig<TQueryFnData, TError, TData, TQueryData, TQueryKey>,
    'queryClient'
  > {}

export function queryOptions<
  TData,
  TError = DefaultError,
  TQueryKey extends QueryKey = QueryKey,
>(
  options: QueryOptionsParams<TData, TError, TQueryKey>,
): QueryOptionsParams<TData, TError, TQueryKey>;

export function queryOptions(options: unknown) {
  return options;
}

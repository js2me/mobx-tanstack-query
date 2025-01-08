import { DefaultError, QueryKey } from '@tanstack/query-core';

import { MobxQueryConfig } from './mobx-query.types';

interface QueryOptionsParams<
  TData,
  TError = DefaultError,
  TQueryKey extends QueryKey = QueryKey,
> extends Omit<MobxQueryConfig<TData, TError, TQueryKey>, 'queryClient'> {}

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

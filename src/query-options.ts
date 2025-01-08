import { DefaultError, QueryKey } from '@tanstack/query-core';

import { MobxQueryConfig } from './mobx-query.types';

type PartialKeys<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;

interface QueryOptionsParams<
  TData,
  TError = DefaultError,
  TQueryKey extends QueryKey = QueryKey,
> extends PartialKeys<
    MobxQueryConfig<TData, TError, TQueryKey>,
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

import type {
  DefaultError,
  QueryFunction,
  QueryKey,
} from '@tanstack/query-core';
import {
  type AnyQueryClient,
  Query,
  type QueryConfig,
} from 'mobx-tanstack-query';
import type { PartialKeys } from 'yummies/types';
import { createQueryInstance } from './create-query-instance.js';

export interface CreateQueryFnConfig<
  TQueryFnData = unknown,
  TError = DefaultError,
  TData = TQueryFnData,
  TQueryData = TQueryFnData,
  TQueryKey extends QueryKey = QueryKey,
> extends QueryConfig<TQueryFnData, TError, TData, TQueryData, TQueryKey> {}

export function createQuery<
  TQueryFnData,
  TError = DefaultError,
  TData = TQueryFnData,
  TQueryData = TQueryFnData,
  TQueryKey extends QueryKey = QueryKey,
>(
  queryClient: AnyQueryClient,
  options:
    | Omit<
        Partial<
          CreateQueryFnConfig<
            TQueryFnData,
            TError,
            TData,
            TQueryData,
            TQueryKey
          >
        >,
        'queryClient'
      >
    | (() => Omit<
        Partial<
          CreateQueryFnConfig<
            TQueryFnData,
            TError,
            TData,
            TQueryData,
            TQueryKey
          >
        >,
        'queryClient'
      >),
): Query<TQueryFnData, TError, TData, TQueryData, TQueryKey>;

export function createQuery<
  TQueryFnData,
  TError = DefaultError,
  TData = TQueryFnData,
  TQueryData = TQueryFnData,
  TQueryKey extends QueryKey = QueryKey,
>(
  queryFn: QueryFunction<TQueryFnData, TQueryKey>,
  options?: Omit<
    Partial<
      CreateQueryFnConfig<
        NoInfer<TQueryFnData>,
        TError,
        TData,
        NoInfer<TQueryData>,
        TQueryKey
      >
    >,
    'queryFn'
  >,
): Query<TQueryFnData, TError, TData, TQueryData, TQueryKey>;

export function createQuery<
  TQueryFnData,
  TError = DefaultError,
  TData = TQueryFnData,
  TQueryData = TQueryFnData,
  TQueryKey extends QueryKey = QueryKey,
>(
  options: PartialKeys<
    CreateQueryFnConfig<TQueryFnData, TError, TData, TQueryData, TQueryKey>,
    'queryClient'
  >,
): Query<TQueryFnData, TError, TData, TQueryData, TQueryKey>;

export function createQuery(...args: [any, any?]) {
  return createQueryInstance(Query, args);
}

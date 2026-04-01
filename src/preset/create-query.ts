import type { DefaultError, QueryClient, QueryKey } from '@tanstack/query-core';

import {
  type AnyQueryClient,
  Query,
  type QueryConfig,
  type QueryOptionsParams,
} from 'mobx-tanstack-query';

import { queryClient } from './query-client.js';

export type CreateQueryParams<
  TQueryFnData = unknown,
  TError = DefaultError,
  TData = TQueryFnData,
  TQueryData = TQueryFnData,
  TQueryKey extends QueryKey = QueryKey,
> = Omit<
  QueryConfig<TQueryFnData, TError, TData, TQueryData, TQueryKey>,
  'queryClient' | 'queryFn' | 'initialData'
> & {
  initialData?: TQueryFnData | (() => TQueryFnData | undefined);
  queryClient?: QueryClient;
};

type QueryFnDataFromFn<TQueryFn extends (...args: any[]) => unknown> = Awaited<
  ReturnType<TQueryFn>
>;

type QueryFnCallback<
  TQueryFnData = unknown,
  TError = DefaultError,
  TData = TQueryFnData,
  TQueryData = TQueryFnData,
  TQueryKey extends QueryKey = QueryKey,
> = Extract<
  QueryConfig<TQueryFnData, TError, TData, TQueryData, TQueryKey>['queryFn'],
  (...args: any[]) => any
>;

type CreateQueryParamsFromFn<
  TQueryFn extends (...args: any[]) => unknown,
  TError = DefaultError,
  TData = QueryFnDataFromFn<TQueryFn>,
  TQueryData = QueryFnDataFromFn<TQueryFn>,
  TQueryKey extends QueryKey = QueryKey,
> = Omit<
  CreateQueryParams<
    QueryFnDataFromFn<TQueryFn>,
    TError,
    TData,
    TQueryData,
    TQueryKey
  >,
  'initialData' | 'select'
> & {
  initialData?: QueryConfig<
    QueryFnDataFromFn<TQueryFn>,
    TError,
    QueryFnDataFromFn<TQueryFn>,
    TQueryData,
    TQueryKey
  >['initialData'];
  select?: QueryConfig<
    QueryFnDataFromFn<TQueryFn>,
    TError,
    TData,
    TQueryData,
    TQueryKey
  >['select'];
};

type CreateQueryParamsFromFnWithoutInitialData<
  TQueryFn extends (...args: any[]) => unknown,
  TError = DefaultError,
  TData = QueryFnDataFromFn<TQueryFn>,
  TQueryData = QueryFnDataFromFn<TQueryFn>,
  TQueryKey extends QueryKey = QueryKey,
> = Omit<
  CreateQueryParamsFromFn<TQueryFn, TError, TData, TQueryData, TQueryKey>,
  'initialData'
>;

type CreateQueryParamsFromFnWithInitialData<
  TQueryFn extends (...args: any[]) => unknown,
  TError = DefaultError,
  TData = QueryFnDataFromFn<TQueryFn>,
  TQueryData = QueryFnDataFromFn<TQueryFn>,
  TQueryKey extends QueryKey = QueryKey,
> = CreateQueryParamsFromFnWithoutInitialData<
  TQueryFn,
  TError,
  TData,
  TQueryData,
  TQueryKey
> & {
  initialData: QueryConfig<
    QueryFnDataFromFn<TQueryFn>,
    TError,
    QueryFnDataFromFn<TQueryFn>,
    TQueryData,
    TQueryKey
  >['initialData'];
};

type ValidateCreateQueryParamsFromFn<
  TQueryFn extends (...args: any[]) => unknown,
  TParams extends CreateQueryParamsFromFn<
    TQueryFn,
    TError,
    TData,
    TQueryData,
    TQueryKey
  >,
  TError = DefaultError,
  TData = QueryFnDataFromFn<TQueryFn>,
  TQueryData = QueryFnDataFromFn<TQueryFn>,
  TQueryKey extends QueryKey = QueryKey,
> = Omit<TParams, 'initialData'> &
  (TParams extends { initialData: infer TInitialData }
    ? {
        initialData: TInitialData extends QueryConfig<
          QueryFnDataFromFn<TQueryFn>,
          TError,
          QueryFnDataFromFn<TQueryFn>,
          TQueryData,
          TQueryKey
        >['initialData']
          ? TInitialData
          : never;
      }
    : {});

export function createQuery<
  TQueryFn extends (...args: any[]) => unknown,
  TError = DefaultError,
  TData = QueryFnDataFromFn<TQueryFn>,
  TQueryData = QueryFnDataFromFn<TQueryFn>,
  TQueryKey extends QueryKey = QueryKey,
>(
  ...args: [
    queryFn: TQueryFn &
      QueryFnCallback<
        QueryFnDataFromFn<TQueryFn>,
        TError,
        TData,
        TQueryData,
        TQueryKey
      >,
  ]
): Query<QueryFnDataFromFn<TQueryFn>, TError, TData, TQueryData, TQueryKey>;

export function createQuery<
  TQueryFnData = unknown,
  TError = DefaultError,
  TData = TQueryFnData,
  TQueryData = TQueryFnData,
  TQueryKey extends QueryKey = QueryKey,
  TQueryFn extends (...args: any[]) => TQueryFnData | Promise<TQueryFnData> = (
    ...args: any[]
  ) => TQueryFnData | Promise<TQueryFnData>,
  TParams extends CreateQueryParamsFromFnWithInitialData<
    TQueryFn,
    TError,
    TData,
    TQueryData,
    TQueryKey
  > = CreateQueryParamsFromFnWithInitialData<
    TQueryFn,
    TError,
    TData,
    TQueryData,
    TQueryKey
  >,
>(
  ...args: [
    queryFn: TQueryFn &
      QueryFnCallback<TQueryFnData, TError, TData, TQueryData, TQueryKey>,
    params: ValidateCreateQueryParamsFromFn<
      TQueryFn,
      TParams,
      TError,
      TData,
      TQueryData,
      TQueryKey
    > &
      CreateQueryParams<
        NoInfer<TQueryFnData>,
        TError,
        TData,
        TQueryData,
        TQueryKey
      >,
  ]
): Query<TQueryFnData, TError, TData, TQueryData, TQueryKey>;

export function createQuery<
  TQueryFnData = unknown,
  TError = DefaultError,
  TData = TQueryFnData,
  TQueryData = TQueryFnData,
  TQueryKey extends QueryKey = QueryKey,
  TQueryFn extends (...args: any[]) => TQueryFnData | Promise<TQueryFnData> = (
    ...args: any[]
  ) => TQueryFnData | Promise<TQueryFnData>,
>(
  ...args: [
    queryFn: TQueryFn &
      QueryFnCallback<TQueryFnData, TError, TData, TQueryData, TQueryKey>,
    params: CreateQueryParamsFromFn<
      TQueryFn,
      TError,
      TData,
      TQueryData,
      TQueryKey
    > &
      CreateQueryParams<
        NoInfer<TQueryFnData>,
        TError,
        TData,
        TQueryData,
        TQueryKey
      >,
  ]
): Query<TQueryFnData, TError, TData, TQueryData, TQueryKey>;

export function createQuery<
  TQueryFnData = unknown,
  TError = DefaultError,
  TData = TQueryFnData,
  TQueryData = TQueryFnData,
  TQueryKey extends QueryKey = QueryKey,
>(
  ...args: [
    options: QueryOptionsParams<
      TQueryFnData,
      TError,
      TData,
      TQueryData,
      TQueryKey
    >,
  ]
): Query<TQueryFnData, TError, TData, TQueryData, TQueryKey>;

export function createQuery<
  TQueryFnData = unknown,
  TError = DefaultError,
  TData = TQueryFnData,
  TQueryData = TQueryFnData,
  TQueryKey extends QueryKey = QueryKey,
>(
  ...args: [
    queryClient: AnyQueryClient,
    options: () => QueryOptionsParams<
      TQueryFnData,
      TError,
      TData,
      TQueryData,
      TQueryKey
    >,
  ]
): Query<TQueryFnData, TError, TData, TQueryData, TQueryKey>;

export function createQuery(...args: [any, any?]) {
  if (typeof args[0] === 'function') {
    return new Query({
      ...args[1],
      queryClient: args[1]?.queryClient ?? queryClient,
      queryFn: args[0],
      onInit: (query) => {
        queryClient.mount();
        args[0]?.onInit?.(query);
      },
    });
  } else if (args.length === 2) {
    return new Query(
      args[0],
      typeof args[1] === 'function' ? args[1] : () => args[1],
    );
  }

  return new Query(
    queryClient,
    typeof args[0] === 'function' ? args[0] : () => args[0],
  );
}

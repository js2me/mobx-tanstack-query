import {
  DefaultedQueryObserverOptions,
  DefaultError,
  InvalidateQueryFilters,
  QueryFilters,
  QueryKey,
  QueryObserverOptions,
  RefetchOptions,
} from '@tanstack/query-core';

import type { MobxQuery } from './mobx-query';
import { AnyQueryClient } from './mobx-query-client.types';

export interface MobxQueryInvalidateParams
  extends Partial<Omit<InvalidateQueryFilters, 'queryKey' | 'exact'>> {}

export interface MobxQueryResetParams
  extends Partial<Omit<QueryFilters, 'queryKey' | 'exact'>> {}

export interface MobxQueryDynamicOptions<
  TQueryFnData = unknown,
  TError = DefaultError,
  TData = TQueryFnData,
  TQueryData = TQueryFnData,
  TQueryKey extends QueryKey = QueryKey,
> extends Partial<
    Omit<
      QueryObserverOptions<TQueryFnData, TError, TData, TQueryData, TQueryKey>,
      'queryFn' | 'enabled' | 'queryKeyHashFn'
    >
  > {
  enabled?: boolean;
}

export interface MobxQueryOptions<
  TQueryFnData = unknown,
  TError = DefaultError,
  TData = TQueryFnData,
  TQueryData = TQueryFnData,
  TQueryKey extends QueryKey = QueryKey,
> extends DefaultedQueryObserverOptions<
    TQueryFnData,
    TError,
    TData,
    TQueryData,
    TQueryKey
  > {}

export type MobxQueryUpdateOptions<
  TQueryFnData = unknown,
  TError = DefaultError,
  TData = TQueryFnData,
  TQueryData = TQueryFnData,
  TQueryKey extends QueryKey = QueryKey,
> = Partial<
  QueryObserverOptions<TQueryFnData, TError, TData, TQueryData, TQueryKey>
>;

export interface MobxQueryFeatures {
  /**
   * Reset query when dispose is called
   *
   * @deprecated Please use 'resetOnDestroy'
   */
  resetOnDispose?: boolean;

  /**
   * Reset query when destroy or abort signal is called
   */
  resetOnDestroy?: boolean;

  /**
   * Enable query only if result is requested
   */
  enableOnDemand?: boolean;
}

export type MobxQueryConfigFromFn<
  T extends (...args: any[]) => any,
  TError = DefaultError,
  TQueryKey extends QueryKey = QueryKey,
> = MobxQueryConfig<
  ReturnType<T> extends Promise<infer TData> ? TData : ReturnType<T>,
  TError,
  TQueryKey
>;

export interface MobxQueryConfig<
  TQueryFnData = unknown,
  TError = DefaultError,
  TData = TQueryFnData,
  TQueryData = TQueryFnData,
  TQueryKey extends QueryKey = QueryKey,
> extends Partial<
      Omit<
        QueryObserverOptions<
          TQueryFnData,
          TError,
          TData,
          TQueryData,
          TQueryKey
        >,
        'queryKey'
      >
    >,
    MobxQueryFeatures {
  queryClient: AnyQueryClient;
  /**
   * TanStack Query manages query caching for you based on query keys.
   * Query keys have to be an Array at the top level, and can be as simple as an Array with a single string, or as complex as an array of many strings and nested objects.
   * As long as the query key is serializable, and unique to the query's data, you can use it!
   *
   * **Important:** If you define it as a function then it will be reactively updates query origin key every time
   * when observable values inside the function changes
   *
   * @link https://tanstack.com/query/v4/docs/framework/react/guides/query-keys#simple-query-keys
   */
  queryKey?: TQueryKey | (() => TQueryKey);
  onInit?: (
    query: MobxQuery<TQueryFnData, TError, TData, TQueryData, TQueryKey>,
  ) => void;
  abortSignal?: AbortSignal;
  onDone?: (data: TData, payload: void) => void;
  onError?: (error: TError, payload: void) => void;
  /**
   * Dynamic query parameters, when result of this function changed query will be updated
   * (reaction -> setOptions)
   */
  options?: (
    query: NoInfer<
      MobxQuery<
        NoInfer<TQueryFnData>,
        NoInfer<TError>,
        NoInfer<TData>,
        NoInfer<TQueryData>,
        NoInfer<TQueryKey>
      >
    >,
  ) => MobxQueryDynamicOptions<
    TQueryFnData,
    TError,
    TData,
    TQueryData,
    TQueryKey
  >;
}

export type MobxQueryFn<
  TQueryFnData = unknown,
  TError = DefaultError,
  TData = TQueryFnData,
  TQueryData = TQueryFnData,
  TQueryKey extends QueryKey = QueryKey,
> = Exclude<
  MobxQueryConfig<
    TQueryFnData,
    TError,
    TData,
    TQueryData,
    TQueryKey
  >['queryFn'],
  undefined
>;

export type AnyMobxQuery = MobxQuery<any, any, any, any, any>;

export interface MobxQueryStartParams<
  TQueryFnData = unknown,
  TError = DefaultError,
  TData = TQueryFnData,
  TQueryData = TQueryFnData,
  TQueryKey extends QueryKey = QueryKey,
> extends MobxQueryUpdateOptions<
      TQueryFnData,
      TError,
      TData,
      TQueryData,
      TQueryKey
    >,
    Pick<RefetchOptions, 'cancelRefetch'> {}

export type InferQuery<
  T extends MobxQueryConfig | MobxQuery,
  TInferValue extends 'data' | 'key' | 'error' | 'query' | 'config',
> =
  T extends MobxQueryConfig<
    infer TQueryFnData,
    infer TError,
    infer TData,
    infer TQueryData,
    infer TQueryKey
  >
    ? TInferValue extends 'config'
      ? T
      : TInferValue extends 'data'
        ? TData
        : TInferValue extends 'key'
          ? TQueryKey
          : TInferValue extends 'error'
            ? TError
            : TInferValue extends 'query'
              ? MobxQuery<TQueryFnData, TError, TData, TQueryData, TQueryKey>
              : never
    : T extends MobxQuery<
          infer TQueryFnData,
          infer TError,
          infer TData,
          infer TQueryData,
          infer TQueryKey
        >
      ? TInferValue extends 'config'
        ? MobxQueryConfig<TQueryFnData, TError, TData, TQueryData, TQueryKey>
        : TInferValue extends 'data'
          ? TData
          : TInferValue extends 'key'
            ? TQueryKey
            : TInferValue extends 'error'
              ? TError
              : TInferValue extends 'query'
                ? T
                : never
      : never;

import {
  DefaultedQueryObserverOptions,
  DefaultError,
  InvalidateQueryFilters,
  QueryFilters,
  QueryKey,
  QueryObserverOptions,
} from '@tanstack/query-core';

import type { Query } from './query';
import { AnyQueryClient } from './query-client.types';

export interface QueryInvalidateParams
  extends Partial<Omit<InvalidateQueryFilters, 'queryKey' | 'exact'>> {}

/**
 * @deprecated ⚠️ use `QueryInvalidateParams`. This type will be removed in next major release
 */
export type MobxQueryInvalidateParams = QueryInvalidateParams;

export interface QueryResetParams
  extends Partial<Omit<QueryFilters, 'queryKey' | 'exact'>> {}

export interface QueryRemoveParams
  extends Partial<Omit<QueryFilters, 'queryKey' | 'exact'>> {
  /**
   * Removes only queries that have no observers or one observer that is `queryObserver`.
   */
  safe?: boolean;
}

/**
 * @deprecated ⚠️ use `QueryResetParams`. This type will be removed in next major release
 */
export type MobxQueryResetParams = QueryResetParams;

export interface QueryDynamicOptions<
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

/**
 * @deprecated ⚠️ use `QueryDynamicOptions`. This type will be removed in next major released
 */
export type MobxQueryDynamicOptions<
  TQueryFnData = unknown,
  TError = DefaultError,
  TData = TQueryFnData,
  TQueryData = TQueryFnData,
  TQueryKey extends QueryKey = QueryKey,
> = QueryDynamicOptions<TQueryFnData, TError, TData, TQueryData, TQueryKey>;

export interface QueryOptions<
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

/**
 * @deprecated ⚠️ use `QueryOptions`. This type will be removed in next major release
 */
export type MobxQueryOptions<
  TQueryFnData = unknown,
  TError = DefaultError,
  TData = TQueryFnData,
  TQueryData = TQueryFnData,
  TQueryKey extends QueryKey = QueryKey,
> = QueryOptions<TQueryFnData, TError, TData, TQueryData, TQueryKey>;

export type QueryUpdateOptions<
  TQueryFnData = unknown,
  TError = DefaultError,
  TData = TQueryFnData,
  TQueryData = TQueryFnData,
  TQueryKey extends QueryKey = QueryKey,
> = Partial<
  QueryObserverOptions<TQueryFnData, TError, TData, TQueryData, TQueryKey>
>;

/**
 * @deprecated ⚠️ use `QueryUpdateOptions`. This type will be removed in next major release
 */
export type MobxQueryUpdateOptions<
  TQueryFnData = unknown,
  TError = DefaultError,
  TData = TQueryFnData,
  TQueryData = TQueryFnData,
  TQueryKey extends QueryKey = QueryKey,
> = QueryUpdateOptions<TQueryFnData, TError, TData, TQueryData, TQueryKey>;

export interface QueryFeatures {
  /**
   * Reset query when dispose is called
   *
   * @deprecated Please use 'resetOnDestroy'. This type will be removed in next major release
   */
  resetOnDispose?: boolean;

  /**
   * Reset query when destroy or abort signal is called
   */
  resetOnDestroy?: boolean;

  /**
   * Removes query when destroy or abort signal is called
   *
   * `safe` - means removes only queries that have no observers or one observer that is `queryObserver`. @see QueryRemoveParams
   *
   * It uses [queryClient.removeQueries](https://tanstack.com/query/v5/docs/reference/QueryClient#queryclientremovequeries)
   */
  removeOnDestroy?: boolean | 'safe';

  /**
   * Enable query only if result is requested
   */
  enableOnDemand?: boolean;

  /**
   * `delay` for dynamic options
   * @see https://mobx.js.org/reactions.html#delay-_autorun-reaction_
   */
  dynamicOptionsUpdateDelay?: number;
  /**
   * **EXPERIMENTAL**
   *
   * Make all query reactions and subscriptions lazy.
   * They exists only when query result is observed.
   */
  lazy?: boolean;
  transformError?: (error: any) => any;

  /**
   * Cumulative all query key hashes when user update options inside query
   * When destroy happened all accumulated query keys will be removed (if removeOnDestroy is true), and reseted (if resetOnDestroy is true)
   */
  cumulativeQueryHash?: boolean;

  /**
   * Removes previous query if current query hash is different
   */
  autoRemovePreviousQuery?: boolean;
}

/**
 * @deprecated ⚠️ use `QueryFeatures`. This type will be removed in next major release
 */
export type MobxQueryFeatures = QueryFeatures;

export type QueryConfigFromFn<
  TFunction extends (...args: any[]) => any,
  TError = DefaultError,
  TQueryKey extends QueryKey = QueryKey,
> = QueryConfig<
  ReturnType<TFunction> extends Promise<infer TData>
    ? TData
    : ReturnType<TFunction>,
  TError,
  TQueryKey
>;

/**
 * @deprecated ⚠️ use `QueryConfigFromFn`. This type will be removed in next major release
 */
export type MobxQueryConfigFromFn<
  TFunction extends (...args: any[]) => any,
  TError = DefaultError,
  TQueryKey extends QueryKey = QueryKey,
> = QueryConfigFromFn<TFunction, TError, TQueryKey>;

export type QueryErrorListener<TError = DefaultError> = (
  error: TError,
  payload: void,
) => void;

export type QueryDoneListener<TData = unknown> = (
  data: TData,
  payload: void,
) => void;

export interface QueryConfig<
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
    QueryFeatures {
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
    query: Query<TQueryFnData, TError, TData, TQueryData, TQueryKey>,
  ) => void;
  abortSignal?: AbortSignal;
  onDone?: QueryDoneListener<TData>;
  onError?: QueryErrorListener<TError>;
  /**
   * Dynamic query parameters, when result of this function changed query will be updated
   * (reaction -> setOptions)
   */
  options?: (
    query: NoInfer<
      Query<
        NoInfer<TQueryFnData>,
        NoInfer<TError>,
        NoInfer<TData>,
        NoInfer<TQueryData>,
        NoInfer<TQueryKey>
      >
    >,
  ) => QueryDynamicOptions<TQueryFnData, TError, TData, TQueryData, TQueryKey>;
}

/**
 * @deprecated ⚠️ use `QueryConfig`. This type will be removed in next major release
 */
export type MobxQueryConfig<
  TQueryFnData = unknown,
  TError = DefaultError,
  TData = TQueryFnData,
  TQueryData = TQueryFnData,
  TQueryKey extends QueryKey = QueryKey,
> = QueryConfig<TQueryFnData, TError, TData, TQueryData, TQueryKey>;

export type QueryFn<
  TQueryFnData = unknown,
  TError = DefaultError,
  TData = TQueryFnData,
  TQueryData = TQueryFnData,
  TQueryKey extends QueryKey = QueryKey,
> = Exclude<
  QueryConfig<TQueryFnData, TError, TData, TQueryData, TQueryKey>['queryFn'],
  undefined
>;

export type QueryUpdateOptionsAllVariants<
  TQueryFnData = unknown,
  TError = DefaultError,
  TData = TQueryFnData,
  TQueryData = TQueryFnData,
  TQueryKey extends QueryKey = QueryKey,
> =
  | Partial<QueryOptions<TQueryFnData, TError, TData, TQueryData, TQueryKey>>
  | QueryUpdateOptions<TQueryFnData, TError, TData, TQueryData, TQueryKey>
  | QueryDynamicOptions<TQueryFnData, TError, TData, TQueryData, TQueryKey>;

/**
 * @deprecated ⚠️ use `QueryFn`. This type will be removed in next major release
 */
export type MobxQueryFn<
  TQueryFnData = unknown,
  TError = DefaultError,
  TData = TQueryFnData,
  TQueryData = TQueryFnData,
  TQueryKey extends QueryKey = QueryKey,
> = QueryFn<TQueryFnData, TError, TData, TQueryData, TQueryKey>;

export type AnyQuery = Query<any, any, any, any, any>;

/**
 * @deprecated ⚠️ use `AnyQuery`. This type will be removed in next major release
 */
export type AnyMobxQuery = AnyQuery;

export interface QueryStartParams<
  TQueryFnData = unknown,
  TError = DefaultError,
  TData = TQueryFnData,
  TQueryData = TQueryFnData,
  TQueryKey extends QueryKey = QueryKey,
> extends QueryUpdateOptions<
    TQueryFnData,
    TError,
    TData,
    TQueryData,
    TQueryKey
  > {}

/**
 * @deprecated ⚠️ use `QueryStartParams`. This type will be removed in next major release
 */
export type MobxQueryStartParams<
  TQueryFnData = unknown,
  TError = DefaultError,
  TData = TQueryFnData,
  TQueryData = TQueryFnData,
  TQueryKey extends QueryKey = QueryKey,
> = QueryStartParams<TQueryFnData, TError, TData, TQueryData, TQueryKey>;

export type InferQuery<
  T extends QueryConfig | Query,
  TInferValue extends 'data' | 'key' | 'error' | 'query' | 'config',
> =
  T extends QueryConfig<
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
              ? Query<TQueryFnData, TError, TData, TQueryData, TQueryKey>
              : never
    : T extends Query<
          infer TQueryFnData,
          infer TError,
          infer TData,
          infer TQueryData,
          infer TQueryKey
        >
      ? TInferValue extends 'config'
        ? QueryConfig<TQueryFnData, TError, TData, TQueryData, TQueryKey>
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

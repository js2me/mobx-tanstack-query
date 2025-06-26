import {
  DefaultError,
  InfiniteQueryObserverOptions,
  QueryKey,
  InfiniteData,
  DefaultedInfiniteQueryObserverOptions,
  RefetchOptions,
} from '@tanstack/query-core';

import { InfiniteQuery } from './inifinite-query';
import { AnyQueryClient } from './query-client.types';
import {
  QueryFeatures,
  QueryInvalidateParams,
  QueryResetParams,
} from './query.types';

export interface InfiniteQueryInvalidateParams extends QueryInvalidateParams {}

/**
 * @remarks ⚠️ use `InfiniteQueryInvalidateParams`. This type will be removed in next major release
 */
export type MobxInfiniteQueryInvalidateParams = InfiniteQueryInvalidateParams;

export interface InfiniteQueryResetParams extends QueryResetParams {}

/**
 * @remarks ⚠️ use `InfiniteQueryResetParams`. This type will be removed in next major release
 */
export type MobxInfiniteQueryResetParams = InfiniteQueryResetParams;

export interface InfiniteQueryDynamicOptions<
  TData,
  TError = DefaultError,
  TQueryKey extends QueryKey = QueryKey,
  TPageParam = unknown,
> extends Partial<
    Omit<
      InfiniteQueryObserverOptions<
        TData,
        TError,
        InfiniteData<TData>,
        TQueryKey,
        TPageParam
      >,
      'queryFn' | 'enabled' | 'queryKeyHashFn'
    >
  > {
  enabled?: boolean;
}

/**
 * @remarks ⚠️ use `InfiniteQueryDynamicOptions`. This type will be removed in next major release
 */
export type MobxInfiniteQueryDynamicOptions<
  TData,
  TError = DefaultError,
  TQueryKey extends QueryKey = QueryKey,
  TPageParam = unknown,
> = InfiniteQueryDynamicOptions<TData, TError, TQueryKey, TPageParam>;

export interface InfiniteQueryOptions<
  TData,
  TError = DefaultError,
  TQueryKey extends QueryKey = QueryKey,
  TPageParam = unknown,
> extends DefaultedInfiniteQueryObserverOptions<
    TData,
    TError,
    InfiniteData<TData, TPageParam>,
    TQueryKey,
    TPageParam
  > {}

/**
 * @remarks ⚠️ use `InfiniteQueryOptions`. This type will be removed in next major release
 */
export type MobxInfiniteQueryOptions<
  TData,
  TError = DefaultError,
  TQueryKey extends QueryKey = QueryKey,
  TPageParam = unknown,
> = InfiniteQueryOptions<TData, TError, TQueryKey, TPageParam>;

export interface InfiniteQueryUpdateOptions<
  TData,
  TError = DefaultError,
  TQueryKey extends QueryKey = QueryKey,
  TPageParam = unknown,
> extends Partial<
    InfiniteQueryObserverOptions<
      TData,
      TError,
      InfiniteData<TData>,
      TQueryKey,
      TPageParam
    >
  > {}

export interface InfiniteQueryStartParams<
  TData,
  TError = DefaultError,
  TQueryKey extends QueryKey = QueryKey,
  TPageParam = unknown,
> extends InfiniteQueryUpdateOptions<TData, TError, TQueryKey, TPageParam>,
    Pick<RefetchOptions, 'cancelRefetch'> {}

/**
 * @remarks ⚠️ use `InfiniteQueryUpdateOptions`. This type will be removed in next major release
 */
export type MobxInfiniteQueryUpdateOptions<
  TData,
  TError = DefaultError,
  TQueryKey extends QueryKey = QueryKey,
  TPageParam = unknown,
> = InfiniteQueryUpdateOptions<TData, TError, TQueryKey, TPageParam>;

export type InfiniteQueryConfigFromFn<
  TFn extends (...args: any[]) => any,
  TError = DefaultError,
  TQueryKey extends QueryKey = QueryKey,
  TPageParam = unknown,
> = InfiniteQueryConfig<
  ReturnType<TFn> extends Promise<infer TData> ? TData : ReturnType<TFn>,
  TError,
  TQueryKey,
  TPageParam
>;

export type InfiniteQueryUpdateOptionsAllVariants<
  TData,
  TError = DefaultError,
  TQueryKey extends QueryKey = any,
  TPageParam = unknown,
> =
  | Partial<InfiniteQueryOptions<TData, TError, TQueryKey, TPageParam>>
  | InfiniteQueryUpdateOptions<TData, TError, TQueryKey, TPageParam>
  | InfiniteQueryDynamicOptions<TData, TError, TQueryKey, TPageParam>;

/**
 * @remarks ⚠️ use `InfiniteQueryConfigFromFn`. This type will be removed in next major release
 */
export type MobxInfiniteQueryConfigFromFn<
  TFn extends (...args: any[]) => any,
  TError = DefaultError,
  TQueryKey extends QueryKey = QueryKey,
  TPageParam = unknown,
> = InfiniteQueryConfigFromFn<TFn, TError, TQueryKey, TPageParam>;

export interface InfiniteQueryConfig<
  TData,
  TError = DefaultError,
  TQueryKey extends QueryKey = QueryKey,
  TPageParam = unknown,
> extends Partial<
      Omit<
        InfiniteQueryObserverOptions<
          TData,
          TError,
          InfiniteData<TData>,
          TQueryKey,
          TPageParam
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
  onInit?: (query: InfiniteQuery<TData, TError, TQueryKey, TPageParam>) => void;
  abortSignal?: AbortSignal;
  onDone?: (data: InfiniteData<TData, TPageParam>, payload: void) => void;
  onError?: (error: TError, payload: void) => void;
  /**
   * Dynamic query parameters, when result of this function changed query will be updated
   * (reaction -> setOptions)
   */
  options?: (
    query: NoInfer<
      InfiniteQuery<
        NoInfer<TData>,
        NoInfer<TError>,
        NoInfer<TQueryKey>,
        NoInfer<TPageParam>
      >
    >,
  ) => InfiniteQueryDynamicOptions<TData, TError, TQueryKey, TPageParam>;
}

export interface InfiniteQueryFlattenConfig<
  TData,
  TError = DefaultError,
  TQueryKey extends QueryKey = QueryKey,
  TPageParam = unknown,
> extends Omit<
    InfiniteQueryConfig<TData, TError, TQueryKey, TPageParam>,
    'queryKey' | 'options' | 'queryClient'
  > {
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
  queryKey?: TQueryKey;
}

/**
 * @remarks ⚠️ use `InfiniteQueryConfig`. This type will be removed in next major release
 */
export type MobxInfiniteQueryConfig<
  TData,
  TError = DefaultError,
  TQueryKey extends QueryKey = QueryKey,
  TPageParam = unknown,
> = InfiniteQueryConfig<TData, TError, TQueryKey, TPageParam>;

export type InferInfiniteQuery<
  T extends
    | InfiniteQueryConfig<any, any, any, any>
    | InfiniteQuery<any, any, any>,
  TInferValue extends
    | 'data'
    | 'key'
    | 'page-param'
    | 'error'
    | 'query'
    | 'config',
> =
  T extends InfiniteQueryConfig<
    infer TData,
    infer TError,
    infer TQueryKey,
    infer TPageParam
  >
    ? TInferValue extends 'config'
      ? T
      : TInferValue extends 'data'
        ? TData
        : TInferValue extends 'key'
          ? TQueryKey
          : TInferValue extends 'page-param'
            ? TPageParam
            : TInferValue extends 'error'
              ? TError
              : TInferValue extends 'query'
                ? InfiniteQuery<TData, TError, TQueryKey, TPageParam>
                : never
    : T extends InfiniteQuery<
          infer TData,
          infer TError,
          infer TQueryKey,
          infer TPageParam
        >
      ? TInferValue extends 'config'
        ? InfiniteQueryConfig<TData, TError, TQueryKey, TPageParam>
        : TInferValue extends 'data'
          ? TData
          : TInferValue extends 'key'
            ? TQueryKey
            : TInferValue extends 'page-param'
              ? TPageParam
              : TInferValue extends 'error'
                ? TError
                : TInferValue extends 'query'
                  ? T
                  : never
      : never;

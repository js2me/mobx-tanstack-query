import type {
  DefaultError,
  InfiniteData,
  DefaultedInfiniteQueryObserverOptions as LibDefaultedInfiniteQueryObserverOptions,
  InfiniteQueryObserverOptions as LibInfiniteQueryObserverOptions,
  QueryKey,
  RefetchOptions,
  ThrowOnError,
} from '@tanstack/query-core';

import type { InfiniteQuery } from './inifinite-query.js';
import type {
  QueryFeatures,
  QueryInvalidateParams,
  QueryRemoveParams,
  QueryResetParams,
} from './query.types.js';
import type { AnyQueryClient } from './query-client.types.js';

export type InfiniteQueryErrorListener<TError = DefaultError> = (
  error: TError,
  payload: void,
) => void;

export type InfiniteQueryDoneListener<TData = unknown> = (
  data: TData,
  payload: void,
) => void;

export interface InfiniteQueryInvalidateParams extends QueryInvalidateParams {}

/**
 * @deprecated ⚠️ use `InfiniteQueryInvalidateParams`. This type will be removed in next major release
 */
export type MobxInfiniteQueryInvalidateParams = InfiniteQueryInvalidateParams;

export interface InfiniteQueryResetParams extends QueryResetParams {}
export interface InfiniteQueryRemoveParams extends QueryRemoveParams {}

/**
 * @deprecated ⚠️ use `InfiniteQueryResetParams`. This type will be removed in next major release
 */
export type MobxInfiniteQueryResetParams = InfiniteQueryResetParams;

type InfiniteQueryOptionTypeFixes<
  TQueryFnData = unknown,
  TError = DefaultError,
  TPageParam = unknown,
  TData = InfiniteData<TQueryFnData, TPageParam>,
  TQueryKey extends QueryKey = QueryKey,
> = {
  throwOnError?: ThrowOnError<TQueryFnData, TError, TData, TQueryKey>;
};

export interface InfiniteQueryDynamicOptions<
  TQueryFnData = unknown,
  TError = DefaultError,
  TPageParam = unknown,
  TData = InfiniteData<TQueryFnData, TPageParam>,
  TQueryKey extends QueryKey = QueryKey,
> extends Partial<
      Omit<
        LibInfiniteQueryObserverOptions<
          TQueryFnData,
          TError,
          TData,
          TQueryKey,
          TPageParam
        >,
        | 'queryFn'
        | 'enabled'
        | 'queryKeyHashFn'
        | keyof InfiniteQueryOptionTypeFixes
      >
    >,
    InfiniteQueryOptionTypeFixes<
      TQueryFnData,
      TError,
      TPageParam,
      TData,
      TQueryKey
    > {
  enabled?: boolean;
}

/**
 * @deprecated ⚠️ use `InfiniteQueryDynamicOptions`. This type will be removed in next major release
 */
export type MobxInfiniteQueryDynamicOptions<
  TData,
  TError = DefaultError,
  TQueryKey extends QueryKey = QueryKey,
  TPageParam = unknown,
> = InfiniteQueryDynamicOptions<
  TData,
  TError,
  TPageParam,
  InfiniteData<TData, TPageParam>,
  TQueryKey
>;

export interface InfiniteQueryOptions<
  TQueryFnData = unknown,
  TError = DefaultError,
  TPageParam = unknown,
  TData = InfiniteData<TQueryFnData, TPageParam>,
  TQueryKey extends QueryKey = QueryKey,
> extends Omit<
      LibDefaultedInfiniteQueryObserverOptions<
        TQueryFnData,
        TError,
        TData,
        TQueryKey,
        TPageParam
      >,
      keyof InfiniteQueryOptionTypeFixes
    >,
    InfiniteQueryOptionTypeFixes<
      TQueryFnData,
      TError,
      TPageParam,
      TData,
      TQueryKey
    > {}

/**
 * @deprecated ⚠️ use `InfiniteQueryOptions`. This type will be removed in next major release
 */
export type MobxInfiniteQueryOptions<
  TData,
  TError = DefaultError,
  TQueryKey extends QueryKey = QueryKey,
  TPageParam = unknown,
> = InfiniteQueryOptions<
  TData,
  TError,
  TPageParam,
  InfiniteData<TData, TPageParam>,
  TQueryKey
>;

export interface InfiniteQueryUpdateOptions<
  TQueryFnData = unknown,
  TError = DefaultError,
  TPageParam = unknown,
  TData = InfiniteData<TQueryFnData, TPageParam>,
  TQueryKey extends QueryKey = QueryKey,
> extends Omit<
      Partial<
        LibInfiniteQueryObserverOptions<
          TData,
          TError,
          InfiniteData<TData, TPageParam>,
          TQueryKey,
          TPageParam
        >
      >,
      keyof InfiniteQueryOptionTypeFixes
    >,
    InfiniteQueryOptionTypeFixes<
      TQueryFnData,
      TError,
      TPageParam,
      TData,
      TQueryKey
    > {}

export interface InfiniteQueryStartParams<
  TQueryFnData = unknown,
  TError = DefaultError,
  TPageParam = unknown,
  TData = InfiniteData<TQueryFnData, TPageParam>,
  TQueryKey extends QueryKey = QueryKey,
> extends InfiniteQueryUpdateOptions<
      TQueryFnData,
      TError,
      TPageParam,
      TData,
      TQueryKey
    >,
    Pick<RefetchOptions, 'cancelRefetch'> {}

/**
 * @deprecated ⚠️ use `InfiniteQueryUpdateOptions`. This type will be removed in next major release
 */
export type MobxInfiniteQueryUpdateOptions<
  TData,
  TError = DefaultError,
  TQueryKey extends QueryKey = QueryKey,
  TPageParam = unknown,
> = InfiniteQueryUpdateOptions<
  TData,
  TError,
  TPageParam,
  InfiniteData<TData, TPageParam>,
  TQueryKey
>;

export type InfiniteQueryConfigFromFn<
  TFn extends (...args: any[]) => any,
  TError = DefaultError,
  TQueryKey extends QueryKey = QueryKey,
  TPageParam = unknown,
> = InfiniteQueryConfig<
  ReturnType<TFn> extends Promise<infer TData> ? TData : ReturnType<TFn>,
  TError,
  TPageParam,
  InfiniteData<
    ReturnType<TFn> extends Promise<infer TData> ? TData : ReturnType<TFn>,
    TPageParam
  >,
  TQueryKey
>;

export type InfiniteQueryUpdateOptionsAllVariants<
  TQueryFnData = unknown,
  TError = DefaultError,
  TPageParam = unknown,
  TData = InfiniteData<TQueryFnData, TPageParam>,
  TQueryKey extends QueryKey = QueryKey,
> =
  | Partial<
      InfiniteQueryOptions<TQueryFnData, TError, TPageParam, TData, TQueryKey>
    >
  | InfiniteQueryUpdateOptions<
      TQueryFnData,
      TError,
      TPageParam,
      TData,
      TQueryKey
    >
  | InfiniteQueryDynamicOptions<
      TQueryFnData,
      TError,
      TPageParam,
      TData,
      TQueryKey
    >;

/**
 * @deprecated ⚠️ use `InfiniteQueryConfigFromFn`. This type will be removed in next major release
 */
export type MobxInfiniteQueryConfigFromFn<
  TFn extends (...args: any[]) => any,
  TError = DefaultError,
  TQueryKey extends QueryKey = QueryKey,
  TPageParam = unknown,
> = InfiniteQueryConfigFromFn<TFn, TError, TQueryKey, TPageParam>;

export interface InfiniteQueryConfig<
  TQueryFnData = unknown,
  TError = DefaultError,
  TPageParam = unknown,
  TData = InfiniteData<TQueryFnData, TPageParam>,
  TQueryKey extends QueryKey = QueryKey,
> extends Omit<
      LibInfiniteQueryObserverOptions<
        TQueryFnData,
        TError,
        TData,
        TQueryKey,
        TPageParam
      >,
      'queryKey'
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
    query: InfiniteQuery<TQueryFnData, TError, TPageParam, TData, TQueryKey>,
  ) => void;
  abortSignal?: AbortSignal;
  onDone?: InfiniteQueryDoneListener<TData>;
  onError?: InfiniteQueryErrorListener<TError>;
  /**
   * Dynamic query parameters, when result of this function changed query will be updated
   * (reaction -> setOptions)
   */
  options?: (
    query: NoInfer<
      InfiniteQuery<
        NoInfer<TQueryFnData>,
        NoInfer<TError>,
        NoInfer<TPageParam>,
        NoInfer<TData>,
        NoInfer<TQueryKey>
      >
    >,
  ) => InfiniteQueryDynamicOptions<
    TQueryFnData,
    TError,
    TPageParam,
    TData,
    TQueryKey
  >;
}

export interface InfiniteQueryFlattenConfig<
  TQueryFnData = unknown,
  TError = DefaultError,
  TPageParam = unknown,
  TData = InfiniteData<TQueryFnData, TPageParam>,
  TQueryKey extends QueryKey = QueryKey,
> extends Omit<
    InfiniteQueryConfig<TQueryFnData, TError, TPageParam, TData, TQueryKey>,
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
 * @deprecated ⚠️ use `InfiniteQueryConfig`. This type will be removed in next major release
 */
export type MobxInfiniteQueryConfig<
  TData,
  TError = DefaultError,
  TQueryKey extends QueryKey = QueryKey,
  TPageParam = unknown,
> = InfiniteQueryConfig<
  TData,
  TError,
  TPageParam,
  InfiniteData<TData, TPageParam>,
  TQueryKey
>;

export type InferInfiniteQuery<
  T extends
    | InfiniteQueryConfig<any, any, any, any, any>
    | InfiniteQuery<any, any, any, any, any>,
  TInferValue extends
    | 'query-data'
    | 'data'
    | 'key'
    | 'page-param'
    | 'error'
    | 'query'
    | 'config',
> = T extends InfiniteQueryConfig<
  infer TQueryFnData,
  infer TError,
  infer TPageParam,
  infer TData,
  infer TQueryKey
>
  ? TInferValue extends 'config'
    ? T
    : TInferValue extends 'data'
      ? TData
      : TInferValue extends 'query-data'
        ? TQueryFnData
        : TInferValue extends 'key'
          ? TQueryKey
          : TInferValue extends 'page-param'
            ? TPageParam
            : TInferValue extends 'error'
              ? TError
              : TInferValue extends 'query'
                ? InfiniteQuery<
                    TQueryFnData,
                    TError,
                    TPageParam,
                    TData,
                    TQueryKey
                  >
                : never
  : T extends InfiniteQuery<
        infer TQueryFnData,
        infer TError,
        infer TPageParam,
        infer TData,
        infer TQueryKey
      >
    ? TInferValue extends 'config'
      ? InfiniteQueryConfig<TQueryFnData, TError, TPageParam, TData, TQueryKey>
      : TInferValue extends 'data'
        ? TData
        : TInferValue extends 'query-data'
          ? TQueryFnData
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

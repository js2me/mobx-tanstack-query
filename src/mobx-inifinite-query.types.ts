import {
  DefaultError,
  InfiniteQueryObserverOptions,
  QueryClient,
  QueryKey,
  InfiniteData,
  DefaultedInfiniteQueryObserverOptions,
} from '@tanstack/query-core';
import { IDisposer } from 'disposer-util';

import { MobxInfiniteQuery } from './mobx-inifinite-query';
import {
  MobxQueryInvalidateParams,
  MobxQueryResetParams,
} from './mobx-query.types';

export interface MobxInfiniteQueryInvalidateParams
  extends MobxQueryInvalidateParams {}

export interface MobxInfiniteQueryResetParams extends MobxQueryResetParams {}

export interface MobxInfiniteQueryDynamicOptions<
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
        InfiniteData<TData>,
        TQueryKey,
        TPageParam
      >,
      'queryFn' | 'enabled' | 'queryKeyHashFn'
    >
  > {
  enabled?: boolean;
}

export interface MobxInfiniteQueryOptions<
  TData,
  TError = DefaultError,
  TQueryKey extends QueryKey = QueryKey,
  TPageParam = unknown,
> extends DefaultedInfiniteQueryObserverOptions<
    TData,
    TError,
    InfiniteData<TData>,
    InfiniteData<TData>,
    TQueryKey,
    TPageParam
  > {}

export interface MobxInfiniteQueryConfig<
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
        InfiniteData<TData>,
        TQueryKey,
        TPageParam
      >,
      'queryKey'
    >
  > {
  queryClient: QueryClient;
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
    query: MobxInfiniteQuery<TData, TError, TQueryKey, TPageParam>,
  ) => void;
  /**
   * @deprecated use `abortSignal` instead
   */
  disposer?: IDisposer;
  abortSignal?: AbortSignal;
  onDone?: (data: InfiniteData<TData>, payload: void) => void;
  onError?: (error: TError, payload: void) => void;
  /**
   * Dynamic query parameters, when result of this function changed query will be updated
   * (reaction -> setOptions)
   */
  options?: (
    query: NoInfer<
      MobxInfiniteQuery<
        NoInfer<TData>,
        NoInfer<TError>,
        NoInfer<TQueryKey>,
        NoInfer<TPageParam>
      >
    >,
  ) => MobxInfiniteQueryDynamicOptions<TData, TError, TQueryKey, TPageParam>;

  /**
   * Reset query when dispose is called
   */
  resetOnDispose?: boolean;

  /**
   * Enable query only if result is requested
   */
  enableOnDemand?: boolean;
}

export interface MobxInfiniteQueryUpdateOptions<
  TData,
  TError = DefaultError,
  TQueryKey extends QueryKey = QueryKey,
  TPageParam = unknown,
> extends Partial<
    InfiniteQueryObserverOptions<
      TData,
      TError,
      InfiniteData<TData>,
      InfiniteData<TData>,
      TQueryKey,
      TPageParam
    >
  > {}
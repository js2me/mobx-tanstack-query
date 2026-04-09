import type {
  DefaultError,
  DefaultedQueryObserverOptions,
  InvalidateQueryFilters,
  QueryFilters,
  QueryKey,
  QueryObserverOptions,
} from '@tanstack/query-core';
import type { IReactionOptions } from 'mobx';
import type { ObservableTypes } from 'yummies/mobx';
import type { Query } from './query.js';
import type { AnyQueryClient } from './query-client.types.js';

export interface QueryInvalidateParams
  extends Partial<Omit<InvalidateQueryFilters, 'queryKey' | 'exact'>> {}

export interface QueryResetParams
  extends Partial<Omit<QueryFilters, 'queryKey' | 'exact'>> {}

export interface QueryRemoveParams
  extends Partial<Omit<QueryFilters, 'queryKey' | 'exact'>> {
  /**
   * Removes only queries that have no observers or one observer that is `queryObserver`.
   */
  safe?: boolean;
}

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

export type QueryUpdateOptions<
  TQueryFnData = unknown,
  TError = DefaultError,
  TData = TQueryFnData,
  TQueryData = TQueryFnData,
  TQueryKey extends QueryKey = QueryKey,
> = Partial<
  QueryObserverOptions<TQueryFnData, TError, TData, TQueryData, TQueryKey>
>;

export interface QueryFeatures {
  /**
   * Reset query when destroy method called or abort signal is called
   *
   * [**Documentation**](https://js2me.github.io/mobx-tanstack-query/api/Query.html#resetondestroy-queryfeature)
   */
  resetOnDestroy?: boolean;

  /**
   * Removes query when destroy or abort signal is called
   *
   * `safe` - means removes only queries that have no observers or one observer that is `queryObserver`. @see QueryRemoveParams
   *
   * It uses [queryClient.removeQueries](https://tanstack.com/query/v5/docs/reference/QueryClient#queryclientremovequeries)
   *
   * [**Documentation**](https://js2me.github.io/mobx-tanstack-query/api/Query.html#removeondestroy-queryfeature)
   */
  removeOnDestroy?: boolean | 'safe';

  /**
   * Enable query only if result is requested
   *
   * [**Documentation**](https://js2me.github.io/mobx-tanstack-query/api/Query.html#enableondemand-queryfeature)
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
   *
   * [**Documentation**](https://js2me.github.io/mobx-tanstack-query/api/Query.html#lazy-option-queryfeature)
   */
  lazy?: boolean;

  /**
   *
   *
   * [**Documentation**](https://js2me.github.io/mobx-tanstack-query/api/Query.html#transformerror-queryfeature)
   */
  transformError?: (error: any) => any;

  /**
   * Cumulative all query key hashes when user update options inside query
   * When destroy happened all accumulated query keys will be removed (if removeOnDestroy is true), and reseted (if resetOnDestroy is true)
   */
  cumulativeQueryHash?: boolean;

  /**
   * Removes previous query if current query hash is different
   *
   * [**Documentation**](https://js2me.github.io/mobx-tanstack-query/api/Query.html#autoremovepreviousquery-queryfeature)
   */
  autoRemovePreviousQuery?: boolean;

  /**
   * Custom comparer for dynamic options reactions
   *
   * [**Documentation**](https://js2me.github.io/mobx-tanstack-query/api/Query.html#dynamicoptionscomparer)
   */
  dynamicOptionsComparer?: IReactionOptions<any, any>['equals'];

  /**
   * MobX observable flavour for the internal TanStack Query result object (`_result`), applied with
   * `annotation.observable()` from `yummies/mobx`. Public fields (`data`, `status`, `isLoading`, …) read from
   * this object, so the option controls how deeply updates to the query result propagate to observers.
   *
   * - `'deep'` — default when omitted; deep observability for plain objects and arrays.
   * - `'shallow'` / `'struct'` — shallow or structural comparison for nested keys.
   * - `'ref'` — track only the result reference (useful when the whole result object is replaced each update).
   * - `true` — base `observable` (same as omitting the option).
   * - `false` — skip decorating `_result` (no automatic MobX tracking for the result; advanced use only).
   *
   * @default 'deep'
   *
   * [**Documentation**](https://js2me.github.io/mobx-tanstack-query/api/Query.html#resultobservable-queryfeature)
   */
  resultObservable?: ObservableTypes | boolean;
}

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

export type AnyQuery = Query<any, any, any, any, any>;

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

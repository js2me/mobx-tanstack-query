import {
  type DefaultError,
  type FetchStatus,
  type QueryKey,
  QueryObserver,
  type QueryObserverBaseResult,
  type QueryObserverResult,
  type QueryStatus,
} from '@tanstack/query-core';
import { BaseQuery } from './base-query.js';
import type {
  QueryConfig,
  QueryDoneListener,
  QueryErrorListener,
  QueryOptions,
  QueryResetParams,
  QueryStartParams,
} from './query.types.js';
import type { QueryClient } from './query-client.js';
import type { AnyQueryClient } from './query-client.types.js';
import type { QueryOptionsParams } from './query-options.js';

export const originalQueryProperties = [
  'data',
  'dataUpdatedAt',
  'error',
  'errorUpdatedAt',
  'failureCount',
  'failureReason',
  'errorUpdateCount',
  'isError',
  'isFetched',
  'isFetching',
  'isLoading',
  'isPending',
  'isLoadingError',
  'isPaused',
  'isPlaceholderData',
  'isRefetchError',
  'isRefetching',
  'isStale',
  'isSuccess',
  'status',
  'fetchStatus',
] as const satisfies (keyof QueryObserverBaseResult)[];

export class Query<
    TQueryFnData = unknown,
    TError = DefaultError,
    TData = TQueryFnData,
    TQueryData = TQueryFnData,
    TQueryKey extends QueryKey = QueryKey,
  >
  extends BaseQuery<
    TQueryFnData,
    TError,
    TData,
    QueryOptions<TQueryFnData, TError, TData, TQueryData, TQueryKey>,
    QueryObserverResult<TData, TError>,
    QueryObserver<TQueryFnData, TError, TData, TQueryData, TQueryKey>,
    QueryDoneListener<TData>,
    QueryErrorListener<TError>,
    Partial<QueryOptions<TQueryFnData, TError, TData, TQueryData, TQueryKey>>,
    QueryResetParams,
    { safe?: boolean; predicate?: (query: any) => boolean } | undefined,
    | {
        exact?: boolean;
        queryKey?: TQueryKey;
        predicate?: (query: any) => boolean;
      }
    | undefined,
    QueryStartParams<TQueryFnData, TError, TData, TQueryData, TQueryKey>
  >
  implements
    Pick<
      QueryObserverBaseResult<TData, TError>,
      (typeof originalQueryProperties)[number]
    >
{
  protected config: QueryConfig<
    TQueryFnData,
    TError,
    TData,
    TQueryData,
    TQueryKey
  >;

  /**
   * The last successfully resolved data for the query.
   *
   * [**Documentation**](https://js2me.github.io/mobx-tanstack-query/api/Query.html#data-tdata-undefined)
   */
  data!: TData | undefined;
  /**
   * The timestamp for when the query most recently returned the `status` as `"success"`.
   *
   * [**Documentation**](https://js2me.github.io/mobx-tanstack-query/api/Query.html#dataupdatedat-number)
   */
  dataUpdatedAt!: number;
  /**
   * The error object for the query, if an error was thrown.
   * - Defaults to `null`.
   *
   * [**Documentation**](https://js2me.github.io/mobx-tanstack-query/api/Query.html#error-terror-null)
   */
  error!: TError | null;
  /**
   * The timestamp for when the query most recently returned the `status` as `"error"`.
   *
   * [**Documentation**](https://js2me.github.io/mobx-tanstack-query/api/Query.html#errorupdatedat-number)
   */
  errorUpdatedAt!: number;
  /**
   * The failure count for the query.
   * - Incremented every time the query fails.
   * - Reset to `0` when the query succeeds.
   *
   * [**Documentation**](https://js2me.github.io/mobx-tanstack-query/api/Query.html#failurecount-number)
   */
  failureCount!: number;
  /**
   * The failure reason for the query retry.
   * - Reset to `null` when the query succeeds.
   *
   * [**Documentation**](https://js2me.github.io/mobx-tanstack-query/api/Query.html#failurereason-terror-null)
   */
  failureReason!: TError | null;
  /**
   * The sum of all errors.
   *
   * [**Documentation**](https://js2me.github.io/mobx-tanstack-query/api/Query.html#errorupdatecount-number)
   */
  errorUpdateCount!: number;
  /**
   * A derived boolean from the `status` variable, provided for convenience.
   * - `true` if the query attempt resulted in an error.
   *
   * [**Documentation**](https://js2me.github.io/mobx-tanstack-query/api/Query.html#iserror-boolean)
   */
  isError!: boolean;
  /**
   * Will be `true` if the query has been fetched.
   *
   * [**Documentation**](https://js2me.github.io/mobx-tanstack-query/api/Query.html#isfetched-boolean)
   */
  isFetched!: boolean;
  /**
   * A derived boolean from the `fetchStatus` variable, provided for convenience.
   * - `true` whenever the `queryFn` is executing, which includes initial `pending` as well as background refetch.
   *
   * [**Documentation**](https://js2me.github.io/mobx-tanstack-query/api/Query.html#isfetching-boolean)
   */
  isFetching!: boolean;
  /**
   * Is `true` whenever the first fetch for a query is in-flight.
   * - Is the same as `isFetching && isPending`.
   *
   * [**Documentation**](https://js2me.github.io/mobx-tanstack-query/api/Query.html#isloading-boolean)
   */
  isLoading!: boolean;
  /**
   * Will be `pending` if there's no cached data and no query attempt was finished yet.
   *
   * [**Documentation**](https://js2me.github.io/mobx-tanstack-query/api/Query.html#ispending-boolean)
   */
  isPending!: boolean;
  /**
   * Will be `true` if the query failed while fetching for the first time.
   *
   * [**Documentation**](https://js2me.github.io/mobx-tanstack-query/api/Query.html#isloadingerror-boolean)
   */
  isLoadingError!: boolean;
  /**
   * A derived boolean from the `fetchStatus` variable, provided for convenience.
   * - The query wanted to fetch, but has been `paused`.
   *
   * [**Documentation**](https://js2me.github.io/mobx-tanstack-query/api/Query.html#ispaused-boolean)
   */
  isPaused!: boolean;
  /**
   * Will be `true` if the data shown is the placeholder data.
   *
   * [**Documentation**](https://js2me.github.io/mobx-tanstack-query/api/Query.html#isplaceholderdata-boolean)
   */
  isPlaceholderData!: boolean;
  /**
   * Will be `true` if the query failed while refetching.
   *
   * [**Documentation**](https://js2me.github.io/mobx-tanstack-query/api/Query.html#isrefetcherror-boolean)
   */
  isRefetchError!: boolean;
  /**
   * Is `true` whenever a background refetch is in-flight, which _does not_ include initial `pending`.
   * - Is the same as `isFetching && !isPending`.
   *
   * [**Documentation**](https://js2me.github.io/mobx-tanstack-query/api/Query.html#isrefetching-boolean)
   */
  isRefetching!: boolean;
  /**
   * Will be `true` if the data in the cache is invalidated or if the data is older than the given `staleTime`.
   *
   * [**Documentation**](https://js2me.github.io/mobx-tanstack-query/api/Query.html#isstale-boolean)
   */
  isStale!: boolean;
  /**
   * A derived boolean from the `status` variable, provided for convenience.
   * - `true` if the query has received a response with no errors and is ready to display its data.
   *
   * [**Documentation**](https://js2me.github.io/mobx-tanstack-query/api/Query.html#issuccess-boolean)
   */
  isSuccess!: boolean;
  /**
   * The status of the query.
   * - Will be:
   *   - `pending` if there's no cached data and no query attempt was finished yet.
   *   - `error` if the query attempt resulted in an error.
   *   - `success` if the query has received a response with no errors and is ready to display its data.
   *
   * [**Documentation**](https://js2me.github.io/mobx-tanstack-query/api/Query.html#status-querystatus)
   */
  status!: QueryStatus;
  /**
   * The fetch status of the query.
   * - `fetching`: Is `true` whenever the queryFn is executing, which includes initial `pending` as well as background refetch.
   * - `paused`: The query wanted to fetch, but has been `paused`.
   * - `idle`: The query is not fetching.
   * - See [Network Mode](https://tanstack.com/query/latest/docs/framework/react/guides/network-mode) for more information.
   *
   * [**Documentation**](https://js2me.github.io/mobx-tanstack-query/api/Query.html#fetchstatus-fetchstatus)
   */
  fetchStatus!: FetchStatus;

  constructor(
    config: QueryConfig<TQueryFnData, TError, TData, TQueryData, TQueryKey>,
  );
  constructor(
    queryClient: AnyQueryClient,
    config: () => QueryOptionsParams<
      TQueryFnData,
      TError,
      TData,
      TQueryData,
      TQueryKey
    >,
  );

  constructor(...args: any[]) {
    let queryClient: AnyQueryClient;
    let config: QueryOptionsParams<
      TQueryFnData,
      TError,
      TData,
      TQueryData,
      TQueryKey
    >;
    let getDynamicOptions:
      | QueryConfig<
          TQueryFnData,
          TError,
          TData,
          TQueryData,
          TQueryKey
        >['options']
      | undefined;

    if (args.length === 2) {
      queryClient = args[0];
      config = args[1]();
      getDynamicOptions = args[1];
    } else {
      queryClient = args[0].queryClient;
      config = args[0];
      getDynamicOptions = args[0].options;
    }

    super(config.abortSignal);

    this.cumulativeQueryKeyHashesSet = new Set();

    const { queryKey: queryKeyOrDynamicQueryKey, ...restOptions } = config;

    this.config = {
      ...config,
      queryClient,
    };

    const qc = queryClient as unknown as Partial<
      Pick<QueryClient, 'queryFeatures' | 'hooks'>
    >;
    this.features = BaseQuery.mergeQueryFeatures(config, queryClient);
    this.initializeBaseState(queryClient, this.features, qc.hooks);

    const isQueryKeyDynamic = typeof queryKeyOrDynamicQueryKey === 'function';

    if (!isQueryKeyDynamic) {
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-expect-error
      restOptions.queryKey = queryKeyOrDynamicQueryKey;
    }

    this.options = this.queryClient.defaultQueryOptions(restOptions as any);

    this.options.structuralSharing = this.options.structuralSharing ?? false;

    const getAllDynamicOptions =
      getDynamicOptions || isQueryKeyDynamic
        ? () => {
            const freshDynamicOptions = {
              ...getDynamicOptions?.(this),
            };

            if (isQueryKeyDynamic) {
              freshDynamicOptions.queryKey = queryKeyOrDynamicQueryKey();
            }

            return freshDynamicOptions;
          }
        : undefined;

    if (getAllDynamicOptions) {
      Object.assign(this.options, getAllDynamicOptions());
    } else if (!isQueryKeyDynamic) {
      this.options.queryKey =
        queryKeyOrDynamicQueryKey ?? this.options.queryKey ?? [];
    }

    // Tracking props visit should be done in MobX, by default.
    this.options.notifyOnChangeProps =
      restOptions.notifyOnChangeProps ??
      queryClient.getDefaultOptions().queries?.notifyOnChangeProps ??
      'all';

    this.processOptions(this.options);

    this.queryObserver = new QueryObserver<
      TQueryFnData,
      TError,
      TData,
      TQueryData,
      TQueryKey
    >(queryClient as QueryClient, this.options);

    this.finalizeInitialization({
      originalQueryProperties,
      getAllDynamicOptions,
      abortSignal: config.abortSignal,
    });
    this.registerInitialListeners({
      onDone: config.onDone,
      onError: config.onError,
    });

    this.config.onInit?.(this);
    this.hooks?.onQueryInit?.(this);
  }

  protected handleDestroy() {
    this.cleanup();
    this.hooks?.onQueryDestroy?.(this);
  }
}

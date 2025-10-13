/* eslint-disable @typescript-eslint/ban-ts-comment */
import {
  type DefaultError,
  type FetchNextPageOptions,
  type FetchPreviousPageOptions,
  type FetchStatus,
  type InfiniteData,
  InfiniteQueryObserver,
  type InfiniteQueryObserverBaseResult,
  type InfiniteQueryObserverResult,
  type QueryKey,
  type QueryStatus,
  type RefetchOptions,
  type SetDataOptions,
  type Updater,
} from '@tanstack/query-core';
import {
  action,
  makeObservable,
  observable,
  reaction,
  runInAction,
} from 'mobx';
import { lazyObserve } from 'yummies/mobx';

import type {
  InfiniteQueryConfig,
  InfiniteQueryDoneListener,
  InfiniteQueryErrorListener,
  InfiniteQueryFlattenConfig,
  InfiniteQueryInvalidateParams,
  InfiniteQueryOptions,
  InfiniteQueryRemoveParams,
  InfiniteQueryResetParams,
  InfiniteQueryStartParams,
  InfiniteQueryUpdateOptionsAllVariants,
} from './inifinite-query.types.js';
import { Query } from './query.js';
import type { QueryFeatures } from './query.types.js';
import type { QueryClient } from './query-client.js';
import type { AnyQueryClient, QueryClientHooks } from './query-client.types.js';
import { Destroyable } from './utils/destroyable.js';

const originalQueryProperties = [
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
  'fetchNextPage',
  'fetchPreviousPage',
  'hasNextPage',
  'hasPreviousPage',
  'isFetchNextPageError',
  'isFetchingNextPage',
  'isFetchPreviousPageError',
  'isFetchingPreviousPage',
] as const satisfies (keyof InfiniteQueryObserverBaseResult)[];

export class InfiniteQuery<
    TQueryFnData = unknown,
    TError = DefaultError,
    TPageParam = unknown,
    TData = InfiniteData<TQueryFnData, TPageParam>,
    TQueryKey extends QueryKey = QueryKey,
  >
  extends Destroyable
  implements
    Disposable,
    Pick<
      InfiniteQueryObserverBaseResult<TData, TError>,
      (typeof originalQueryProperties)[number]
    >
{
  protected queryClient: AnyQueryClient;

  protected _result: InfiniteQueryObserverResult<TData, TError>;

  protected config: InfiniteQueryConfig<
    TQueryFnData,
    TError,
    TPageParam,
    TData,
    TQueryKey
  >;

  /**
   * The last successfully resolved data for the query.
   */
  data!: TData | undefined;
  /**
   * The timestamp for when the query most recently returned the `status` as `"success"`.
   */
  dataUpdatedAt!: number;
  /**
   * The error object for the query, if an error was thrown.
   * - Defaults to `null`.
   */
  error!: TError | null;
  /**
   * The timestamp for when the query most recently returned the `status` as `"error"`.
   */
  errorUpdatedAt!: number;
  /**
   * The failure count for the query.
   * - Incremented every time the query fails.
   * - Reset to `0` when the query succeeds.
   */
  failureCount!: number;
  /**
   * The failure reason for the query retry.
   * - Reset to `null` when the query succeeds.
   */
  failureReason!: TError | null;
  /**
   * The sum of all errors.
   */
  errorUpdateCount!: number;
  /**
   * A derived boolean from the `status` variable, provided for convenience.
   * - `true` if the query attempt resulted in an error.
   */
  isError!: boolean;
  /**
   * Will be `true` if the query has been fetched.
   */
  isFetched!: boolean;
  /**
   * A derived boolean from the `fetchStatus` variable, provided for convenience.
   * - `true` whenever the `queryFn` is executing, which includes initial `pending` as well as background refetch.
   */
  isFetching!: boolean;
  /**
   * Is `true` whenever the first fetch for a query is in-flight.
   * - Is the same as `isFetching && isPending`.
   */
  isLoading!: boolean;
  /**
   * Will be `pending` if there's no cached data and no query attempt was finished yet.
   */
  isPending!: boolean;
  /**
   * Will be `true` if the query failed while fetching for the first time.
   */
  isLoadingError!: boolean;
  /**
   * A derived boolean from the `fetchStatus` variable, provided for convenience.
   * - The query wanted to fetch, but has been `paused`.
   */
  isPaused!: boolean;
  /**
   * Will be `true` if the data shown is the placeholder data.
   */
  isPlaceholderData!: boolean;
  /**
   * Will be `true` if the query failed while refetching.
   */
  isRefetchError!: boolean;
  /**
   * Is `true` whenever a background refetch is in-flight, which _does not_ include initial `pending`.
   * - Is the same as `isFetching && !isPending`.
   */
  isRefetching!: boolean;
  /**
   * Will be `true` if the data in the cache is invalidated or if the data is older than the given `staleTime`.
   */
  isStale!: boolean;
  /**
   * A derived boolean from the `status` variable, provided for convenience.
   * - `true` if the query has received a response with no errors and is ready to display its data.
   */
  isSuccess!: boolean;
  /**
   * The status of the query.
   * - Will be:
   *   - `pending` if there's no cached data and no query attempt was finished yet.
   *   - `error` if the query attempt resulted in an error.
   *   - `success` if the query has received a response with no errors and is ready to display its data.
   */
  status!: QueryStatus;
  /**
   * The fetch status of the query.
   * - `fetching`: Is `true` whenever the queryFn is executing, which includes initial `pending` as well as background refetch.
   * - `paused`: The query wanted to fetch, but has been `paused`.
   * - `idle`: The query is not fetching.
   * - See [Network Mode](https://tanstack.com/query/latest/docs/framework/react/guides/network-mode) for more information.
   */
  fetchStatus!: FetchStatus;
  /**
   * Will be `true` if there is a next page to be fetched (known via the `getNextPageParam` option).
   */
  hasNextPage!: boolean;
  /**
   * Will be `true` if there is a previous page to be fetched (known via the `getPreviousPageParam` option).
   */
  hasPreviousPage!: boolean;
  /**
   * Will be `true` if the query failed while fetching the next page.
   */
  isFetchNextPageError!: boolean;
  /**
   * Will be `true` while fetching the next page with `fetchNextPage`.
   */
  isFetchingNextPage!: boolean;
  /**
   * Will be `true` if the query failed while fetching the previous page.
   */
  isFetchPreviousPageError!: boolean;
  /**
   * Will be `true` while fetching the previous page with `fetchPreviousPage`.
   */
  isFetchingPreviousPage!: boolean;

  options: InfiniteQueryOptions<
    TQueryFnData,
    TError,
    TPageParam,
    TData,
    TQueryKey
  >;
  queryObserver: InfiniteQueryObserver<
    TData,
    TError,
    TData,
    TQueryKey,
    TPageParam
  >;

  isResultRequsted: boolean;

  protected features: QueryFeatures;

  /**
   * This parameter is responsible for holding the enabled value,
   * in cases where the "enableOnDemand" option is enabled
   */
  private holdedEnabledOption: InfiniteQueryOptions<
    TQueryFnData,
    TError,
    TPageParam,
    TData,
    TQueryKey
  >['enabled'];
  private _observerSubscription?: VoidFunction;
  private hooks?: QueryClientHooks;

  protected errorListeners: InfiniteQueryErrorListener<TError>[];
  protected doneListeners: InfiniteQueryDoneListener<TData>[];

  protected cumulativeQueryKeyHashesSet: Set<string>;

  constructor(
    config: InfiniteQueryConfig<
      TQueryFnData,
      TError,
      TPageParam,
      TData,
      TQueryKey
    >,
  );
  constructor(
    queryClient: AnyQueryClient,
    config: () => InfiniteQueryFlattenConfig<
      TQueryFnData,
      TError,
      TPageParam,
      TData,
      TQueryKey
    >,
  );

  constructor(...args: any[]) {
    let queryClient: AnyQueryClient;
    let config: InfiniteQueryConfig<
      TQueryFnData,
      TError,
      TPageParam,
      TData,
      TQueryKey
    >;
    let getDynamicOptions:
      | InfiniteQueryConfig<
          TQueryFnData,
          TError,
          TPageParam,
          TData,
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

    this.queryClient = queryClient;
    this._result = undefined as any;
    this.isResultRequsted = false;

    this.errorListeners = [];
    this.doneListeners = [];

    // simple type override to make typescript happy
    // and do less for javascript
    const qc = queryClient as unknown as Partial<
      Pick<QueryClient, 'queryFeatures' | 'hooks'>
    >;

    this.features = {
      cumulativeQueryHash:
        config.cumulativeQueryHash ?? qc.queryFeatures?.cumulativeQueryHash,
      enableOnDemand: config.enableOnDemand ?? qc.queryFeatures?.enableOnDemand,
      lazy: config.lazy ?? qc.queryFeatures?.lazy,
      resetOnDestroy:
        config.resetOnDestroy ??
        config.resetOnDispose ??
        qc.queryFeatures?.resetOnDestroy ??
        qc.queryFeatures?.resetOnDispose,
      removeOnDestroy:
        config.removeOnDestroy ?? qc.queryFeatures?.removeOnDestroy,
      transformError: config.transformError ?? qc.queryFeatures?.transformError,
      dynamicOptionsUpdateDelay:
        config.dynamicOptionsUpdateDelay ??
        qc.queryFeatures?.dynamicOptionsUpdateDelay,
      autoRemovePreviousQuery:
        config.autoRemovePreviousQuery ??
        qc.queryFeatures?.autoRemovePreviousQuery,
    };
    this.hooks = qc.hooks;

    const isQueryKeyDynamic = typeof queryKeyOrDynamicQueryKey === 'function';

    if (!isQueryKeyDynamic) {
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-expect-error
      restOptions.queryKey = queryKeyOrDynamicQueryKey;
    }

    this.options = this.queryClient.defaultQueryOptions(
      restOptions as any,
    ) as InfiniteQueryOptions<
      TQueryFnData,
      TError,
      TPageParam,
      TData,
      TQueryKey
    >;

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

    // @ts-expect-error
    this.queryObserver = new InfiniteQueryObserver(queryClient, this.options);

    // @ts-expect-error
    this.updateResult(this.queryObserver.getOptimisticResult(this.options));

    observable.deep(this, '_result');
    observable.ref(this, 'isResultRequsted');
    action.bound(this, 'setData');
    action.bound(this, 'update');
    action.bound(this, 'updateResult');
    this.refetch = this.refetch.bind(this);
    this.start = this.start.bind(this);

    originalQueryProperties.forEach((property) => {
      if (!this[property]) {
        Object.defineProperty(this, property, {
          get: () => this.result[property],
        });
      }
    });

    makeObservable(this);

    if (this.features.lazy) {
      const cleanup = lazyObserve({
        context: this,
        property: '_result',
        onStart: () => {
          if (!this._observerSubscription) {
            if (getAllDynamicOptions) {
              this.update(getAllDynamicOptions());
            }
            this._observerSubscription = this.queryObserver.subscribe(
              this.updateResult,
            );
            if (getAllDynamicOptions) {
              return reaction(getAllDynamicOptions, this.update, {
                delay: this.config.dynamicOptionsUpdateDelay,
                signal: config.abortSignal,
                fireImmediately: true,
              });
            }
          }
        },
        onEnd: (disposeFn, cleanup) => {
          if (this._observerSubscription) {
            disposeFn?.();
            this._observerSubscription();
            this._observerSubscription = undefined;
            config.abortSignal?.removeEventListener('abort', cleanup);
          }
        },
      });

      config.abortSignal?.addEventListener('abort', cleanup);
    } else {
      if (getAllDynamicOptions) {
        reaction(getAllDynamicOptions, this.update, {
          delay: this.config.dynamicOptionsUpdateDelay,
          signal: config.abortSignal,
          equals: this.features.dynamicOptionsComparer,
        });
      }
      this._observerSubscription = this.queryObserver.subscribe(
        this.updateResult,
      );
    }

    if (config.onDone) {
      this.doneListeners.push(config.onDone);
    }
    if (config.onError) {
      this.errorListeners.push(config.onError);
    }

    this.config.onInit?.(this);
    this.hooks?.onInfiniteQueryInit?.(this);
  }

  protected createQueryHash(
    queryKey: any,
    options: InfiniteQueryOptions<
      TQueryFnData,
      TError,
      TPageParam,
      TData,
      TQueryKey
    >,
  ) {
    // @ts-expect-error
    return Query.prototype.createQueryHash.call(this, queryKey, options);
  }

  setData(
    updater: Updater<
      NoInfer<InfiniteData<TQueryFnData, TPageParam>> | undefined,
      NoInfer<InfiniteData<TQueryFnData, TPageParam>> | undefined
    >,
    options?: SetDataOptions,
  ) {
    return Query.prototype.setData.call(this, updater, options);
  }

  /**
   * This function allows you to fetch the next "page" of results.
   */
  fetchNextPage(options?: FetchNextPageOptions | undefined) {
    return this._result.fetchNextPage(options);
  }

  /**
   * This function allows you to fetch the previous "page" of results.
   */
  fetchPreviousPage(options?: FetchPreviousPageOptions | undefined) {
    return this._result.fetchPreviousPage(options);
  }

  update(
    optionsUpdate: InfiniteQueryUpdateOptionsAllVariants<
      TQueryFnData,
      TError,
      TPageParam,
      TData,
      TQueryKey
    >,
  ) {
    return Query.prototype.update.call(this, optionsUpdate);
  }

  private isEnableHolded = false;

  private processOptions(
    options: InfiniteQueryOptions<
      TQueryFnData,
      TError,
      TPageParam,
      TData,
      TQueryKey
    >,
  ) {
    // @ts-expect-error works the same
    return Query.prototype.processOptions.call(this, options);
  }

  public get result() {
    if (this.features.enableOnDemand && !this.isResultRequsted) {
      runInAction(() => {
        this.isResultRequsted = true;
      });
      this.update({});
    }
    return this._result;
  }

  /**
   * Modify this result so it matches the tanstack query result.
   */
  private updateResult(result: InfiniteQueryObserverResult<TData, TError>) {
    // @ts-expect-error
    return Query.prototype.updateResult.call(this, result);
  }

  async refetch(options?: RefetchOptions) {
    return await Query.prototype.refetch.call(this, options);
  }

  async reset(params?: InfiniteQueryResetParams) {
    return await Query.prototype.reset.call(this, params);
  }

  remove(params?: InfiniteQueryRemoveParams) {
    return Query.prototype.remove.call(this, params);
  }

  async invalidate(options?: InfiniteQueryInvalidateParams) {
    return await Query.prototype.invalidate.call(this, options);
  }

  onDone(doneListener: InfiniteQueryDoneListener<TData>): void {
    this.doneListeners.push(doneListener);
  }

  onError(errorListener: InfiniteQueryErrorListener<TError>): void {
    this.errorListeners.push(errorListener);
  }

  async start(
    params: InfiniteQueryStartParams<
      TQueryFnData,
      TError,
      TPageParam,
      TData,
      TQueryKey
    > = {},
  ) {
    return await Query.prototype.start.call(this, params);
  }

  protected handleDestroy() {
    // @ts-expect-error
    Query.prototype.cleanup.call(this);
    this.hooks?.onInfiniteQueryDestroy?.(this);
  }
}

/**
 * @deprecated ⚠️ use `InfiniteQuery`. This export will be removed in next major release
 */
export class MobxInfiniteQuery<
  TData,
  TError = DefaultError,
  TQueryKey extends QueryKey = any,
  TPageParam = unknown,
> extends InfiniteQuery<
  TData,
  TError,
  TPageParam,
  InfiniteData<TData, TPageParam>,
  TQueryKey
> {}

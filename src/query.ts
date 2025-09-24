import {
  DefaultError,
  hashKey,
  QueryKey,
  QueryObserver,
  QueryObserverResult,
  RefetchOptions,
  SetDataOptions,
  Updater,
  QueryObserverBaseResult,
  FetchStatus,
  QueryStatus,
  CancelOptions,
  ResetOptions,
} from '@tanstack/query-core';
import { LinkedAbortController } from 'linked-abort-controller';
import {
  action,
  makeObservable,
  observable,
  reaction,
  runInAction,
  when,
} from 'mobx';
import { lazyObserve } from 'yummies/mobx';

import { enableHolder } from './constants';
import { QueryClient } from './query-client';
import { AnyQueryClient, QueryClientHooks } from './query-client.types';
import { QueryOptionsParams } from './query-options';
import {
  QueryConfig,
  QueryDoneListener,
  QueryErrorListener,
  QueryFeatures,
  QueryInvalidateParams,
  QueryOptions,
  QueryRemoveParams,
  QueryResetParams,
  QueryStartParams,
  QueryUpdateOptionsAllVariants,
} from './query.types';

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
] as const satisfies (keyof QueryObserverBaseResult)[];

export class Query<
    TQueryFnData = unknown,
    TError = DefaultError,
    TData = TQueryFnData,
    TQueryData = TQueryFnData,
    TQueryKey extends QueryKey = QueryKey,
  >
  implements
    Disposable,
    Pick<
      QueryObserverBaseResult<TData, TError>,
      (typeof originalQueryProperties)[number]
    >
{
  protected abortController: LinkedAbortController;
  protected queryClient: AnyQueryClient;

  protected _result: QueryObserverResult<TData, TError>;

  options: QueryOptions<TQueryFnData, TError, TData, TQueryData, TQueryKey>;
  queryObserver: QueryObserver<
    TQueryFnData,
    TError,
    TData,
    TQueryData,
    TQueryKey
  >;

  isResultRequsted: boolean;

  protected features: QueryFeatures;

  /**
   * This parameter is responsible for holding the enabled value,
   * in cases where the "enableOnDemand" option is enabled
   */
  private holdedEnabledOption: QueryOptions<
    TQueryFnData,
    TError,
    TData,
    TQueryData,
    TQueryKey
  >['enabled'];
  private _observerSubscription?: VoidFunction;
  private hooks?: QueryClientHooks;

  protected errorListeners: QueryErrorListener<TError>[];
  protected doneListeners: QueryDoneListener<TData>[];

  protected cumulativeQueryKeyHashesSet: Set<string>;

  protected config: QueryConfig<
    TQueryFnData,
    TError,
    TData,
    TQueryData,
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
    this.cumulativeQueryKeyHashesSet = new Set();

    const { queryKey: queryKeyOrDynamicQueryKey, ...restOptions } = config;

    this.config = {
      ...config,
      queryClient,
    };

    this.abortController = new LinkedAbortController(config.abortSignal);
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

    observable.deep(this, '_result');
    observable.ref(this, 'isResultRequsted');
    action(this, 'handleAbort');
    action.bound(this, 'setData');
    action.bound(this, 'update');
    action.bound(this, 'updateResult');
    this.refetch = this.refetch.bind(this);
    this.start = this.start.bind(this);

    originalQueryProperties.forEach((property) => {
      if (property === 'error' && this.features.transformError) {
        Object.defineProperty(this, property, {
          get: () => this.features.transformError!(this.result[property]),
        });
      } else {
        Object.defineProperty(this, property, {
          get: () => this.result[property],
        });
      }
    });

    makeObservable(this);

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

    this.updateResult(this.queryObserver.getOptimisticResult(this.options));

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
                delay: this.features.dynamicOptionsUpdateDelay,
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
      if (isQueryKeyDynamic) {
        reaction(
          queryKeyOrDynamicQueryKey,
          (queryKey) => this.update({ queryKey }),
          {
            signal: this.abortController.signal,
            delay: this.features.dynamicOptionsUpdateDelay,
          },
        );
      }
      if (getDynamicOptions) {
        reaction(() => getDynamicOptions(this), this.update, {
          signal: this.abortController.signal,
          delay: this.features.dynamicOptionsUpdateDelay,
        });
      }
      this._observerSubscription = this.queryObserver.subscribe(
        this.updateResult,
      );
      this.abortController.signal.addEventListener('abort', () =>
        this.handleAbort(),
      );
    }

    if (config.onDone) {
      this.doneListeners.push(config.onDone);
    }
    if (config.onError) {
      this.errorListeners.push(config.onError);
    }

    this.config.onInit?.(this);
    this.hooks?.onQueryInit?.(this);
  }

  async refetch(options?: RefetchOptions) {
    const result = await this.queryObserver.refetch(options);
    const throwableError = this.getCurrentThrowableError(options);

    if (throwableError) {
      throw throwableError;
    }

    return result;
  }

  protected createQueryHash(
    queryKey: any,
    options: QueryOptions<TQueryFnData, TError, TData, TQueryData, TQueryKey>,
  ) {
    if (options.queryKeyHashFn) {
      return options.queryKeyHashFn(queryKey);
    }

    return hashKey(queryKey);
  }

  protected getCurrentThrowableError(options?: RefetchOptions) {
    const query = this.queryObserver.getCurrentQuery();

    if (
      query.state.error &&
      (options?.throwOnError ||
        this.options.throwOnError === true ||
        (typeof this.options.throwOnError === 'function' &&
          this.options.throwOnError(query.state.error, query)))
    ) {
      return query.state.error;
    }

    return undefined;
  }

  setData(
    updater: Updater<
      NoInfer<TQueryFnData> | undefined,
      NoInfer<TQueryFnData> | undefined
    >,
    options?: SetDataOptions,
  ) {
    return this.queryClient.setQueryData<TQueryFnData>(
      this.options.queryKey,
      updater,
      options,
    );
  }

  update(
    optionsUpdate: QueryUpdateOptionsAllVariants<
      TQueryFnData,
      TError,
      TData,
      TQueryData,
      TQueryKey
    >,
  ) {
    if (this.abortController.signal.aborted) {
      return;
    }

    const nextOptions = {
      ...this.options,
      ...optionsUpdate,
    };

    this.processOptions(nextOptions);

    this.options = nextOptions;

    this.queryObserver.setOptions(this.options);

    if (this.features.lazy) {
      this.updateResult(this.queryObserver.getCurrentResult());
    }
  }

  private isEnableHolded = false;

  private processOptions(
    options: QueryOptions<TQueryFnData, TError, TData, TQueryData, TQueryKey>,
  ) {
    const nextQueryHash = this.createQueryHash(options.queryKey, options);

    if (
      this.features.autoRemovePreviousQuery &&
      options.queryHash !== nextQueryHash
    ) {
      this.remove({ safe: true });
    }

    options.queryHash = nextQueryHash;

    if (this.features.cumulativeQueryHash) {
      this.cumulativeQueryKeyHashesSet.add(options.queryHash);
    }

    // If the on-demand query mode is enabled (when using the result property)
    // then, if the user does not request the result, the queries should not be executed
    // to do this, we hold the original value of the enabled option
    // and set enabled to false until the user requests the result (this.isResultRequsted)
    if (this.features.enableOnDemand) {
      if (this.isEnableHolded && options.enabled !== enableHolder) {
        this.holdedEnabledOption = options.enabled;
      }

      if (this.isResultRequsted) {
        if (this.isEnableHolded) {
          options.enabled =
            this.holdedEnabledOption === enableHolder
              ? undefined
              : this.holdedEnabledOption;
          this.isEnableHolded = false;
        }
      } else {
        this.isEnableHolded = true;
        this.holdedEnabledOption = options.enabled;
        options.enabled = enableHolder;
      }
    }
  }

  public get result() {
    if (this.features.enableOnDemand && !this.isResultRequsted) {
      runInAction(() => {
        this.isResultRequsted = true;
      });
      this.update({});
    }
    return this._result || this.queryObserver.getCurrentResult();
  }

  /**
   * Modify this result so it matches the tanstack query result.
   */
  private updateResult(result: QueryObserverResult<TData, TError>) {
    this._result = result;

    if (result.isSuccess && !result.error && result.fetchStatus === 'idle') {
      this.doneListeners.forEach((fn) => fn(result.data!, void 0));
    } else if (result.error) {
      this.errorListeners.forEach((fn) => fn(result.error!, void 0));
    }
  }

  async reset(params?: QueryResetParams, options?: ResetOptions) {
    if (this.features.cumulativeQueryHash) {
      return await this.queryClient.resetQueries({
        predicate: (query) => {
          return (
            this.cumulativeQueryKeyHashesSet.has(query.options.queryHash!) &&
            (query.observers.length === 0 ||
              (query.observers.length === 1 &&
                query.observers[0] === this.queryObserver)) &&
            (!params?.predicate || params.predicate(query))
          );
        },
        ...params,
      });
    }

    return await this.queryClient.resetQueries(
      {
        queryKey: this.options.queryKey,
        exact: true,
        ...params,
      },
      options,
    );
  }

  remove(params?: QueryRemoveParams) {
    if (this.features.cumulativeQueryHash) {
      return this.queryClient.removeQueries({
        predicate: (query) => {
          return (
            this.cumulativeQueryKeyHashesSet.has(query.options.queryHash!) &&
            (query.observers.length === 0 ||
              (query.observers.length === 1 &&
                query.observers[0] === this.queryObserver)) &&
            (!params?.predicate || params.predicate(query))
          );
        },
        ...params,
      });
    }

    if (params?.safe) {
      return this.queryClient.removeQueries({
        ...params,
        predicate: (query) =>
          query.queryHash === this.options.queryHash &&
          (query.observers.length === 0 ||
            (query.observers.length === 1 &&
              query.observers[0] === this.queryObserver)) &&
          (!params?.predicate || params.predicate(query)),
      });
    }

    return this.queryClient.removeQueries({
      queryKey: this.options.queryKey,
      exact: true,
      ...params,
    });
  }

  async cancel(options?: CancelOptions) {
    return await this.queryClient.cancelQueries(
      {
        queryKey: this.options.queryKey,
        exact: true,
      },
      options,
    );
  }

  async invalidate(params?: QueryInvalidateParams) {
    return await this.queryClient.invalidateQueries({
      exact: true,
      queryKey: this.options.queryKey,
      ...params,
    } as any);
  }

  onDone(doneListener: QueryDoneListener<TData>): void {
    this.doneListeners.push(doneListener);
  }

  onError(errorListener: QueryErrorListener<TError>): void {
    this.errorListeners.push(errorListener);
  }

  protected handleAbort() {
    this._observerSubscription?.();

    this.doneListeners = [];
    this.errorListeners = [];

    this.queryObserver.destroy();

    if (this.features.resetOnDestroy) {
      this.reset();
    }

    if (this.features.removeOnDestroy) {
      this.remove({
        safe: this.features.removeOnDestroy === 'safe',
      });
    }

    delete this._observerSubscription;

    this.cumulativeQueryKeyHashesSet.clear();

    this.hooks?.onQueryDestroy?.(this);
  }

  async start(
    params: QueryStartParams<
      TQueryFnData,
      TError,
      TData,
      TQueryData,
      TQueryKey
    > = {},
  ) {
    this.update({ ...params });

    if (this.result.isFetching) {
      await when(() => !this.result.isFetching, {
        signal: this.abortController.signal,
      });
      const throwableError = this.getCurrentThrowableError();
      if (throwableError) {
        throw throwableError;
      }
    } else {
      await this.refetch();
    }

    return this.result;
  }

  destroy() {
    this.abortController?.abort();
  }

  /**
   * @deprecated use `destroy`. This method will be removed in next major release
   */
  dispose() {
    this.destroy();
  }

  [Symbol.dispose](): void {
    this.destroy();
  }

  // Firefox fix (Symbol.dispose is undefined in FF)
  [Symbol.for('Symbol.dispose')](): void {
    this.destroy();
  }
}

/**
 * @deprecated ⚠️ use `Query`. This export will be removed in next major release
 */
export class MobxQuery<
  TQueryFnData = unknown,
  TError = DefaultError,
  TData = TQueryFnData,
  TQueryData = TQueryFnData,
  TQueryKey extends QueryKey = QueryKey,
> extends Query<TQueryFnData, TError, TData, TQueryData, TQueryKey> {}

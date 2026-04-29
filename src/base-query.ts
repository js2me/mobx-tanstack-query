import {
  type CancelOptions,
  type FetchStatus,
  hashKey,
  type RefetchOptions,
  type ResetOptions,
  type SetDataOptions,
  type Updater,
} from '@tanstack/query-core';
import {
  action,
  makeObservable,
  observable,
  reaction,
  runInAction,
  when,
} from 'mobx';
import { annotation, lazyObserve } from 'yummies/mobx';
import { enableHolder } from './constants.js';
import type { QueryFeatures } from './query.types.js';
import type { AnyQueryClient, QueryClientHooks } from './query-client.types.js';
import { Destroyable } from './utils/destroyable.js';

type BaseObservedQuery = {
  state: {
    dataUpdateCount: number;
    errorUpdateCount: number;
    error: any;
  };
  observers: any[];
  options: {
    queryHash?: string;
  };
  queryHash?: string;
};

type BaseObserver<TResult> = {
  getCurrentQuery(): BaseObservedQuery;
  getCurrentResult(): TResult;
  getOptimisticResult(options: any): TResult;
  setOptions(options: any): void;
  refetch(options?: RefetchOptions): Promise<any>;
  subscribe(listener: (result: TResult) => void): VoidFunction;
  destroy(): void;
};

type BaseOptions = {
  queryKey: any;
  queryHash?: string;
  enabled?: any;
  structuralSharing?: unknown;
  notifyOnChangeProps?: unknown;
  queryKeyHashFn?: ((queryKey: any) => string) | undefined;
  throwOnError?: unknown;
};

type BaseResult<TData, TError> = {
  data: TData | undefined;
  error: TError | null;
  isSuccess: boolean;
  fetchStatus: FetchStatus;
  isFetching: boolean;
};

export abstract class BaseQuery<
  TStoredData,
  TError,
  TData,
  TOptions extends BaseOptions,
  TResult extends BaseResult<TData, TError>,
  TObserver extends BaseObserver<TResult>,
  TDoneListener extends (data: TData, payload: void) => void,
  TErrorListener extends (error: TError, payload: void) => void,
  TUpdateOptions extends object,
  TResetParams extends { predicate?: (query: any) => boolean } | undefined,
  TRemoveParams extends
    | { safe?: boolean; predicate?: (query: any) => boolean }
    | undefined,
  TInvalidateParams extends object | undefined,
  TStartParams extends TUpdateOptions,
> extends Destroyable {
  protected queryClient!: AnyQueryClient;
  protected _result!: TResult;

  options!: TOptions;
  queryObserver!: TObserver;

  isResultRequsted!: boolean;

  protected features!: QueryFeatures;

  protected holdedEnabledOption!: TOptions['enabled'];
  protected _observerSubscription?: VoidFunction;
  protected hooks?: QueryClientHooks;

  protected errorListeners!: TErrorListener[];
  protected doneListeners!: TDoneListener[];
  protected doneNotifiedCounts!: WeakMap<BaseObservedQuery, number>;
  protected errorNotifiedCounts!: WeakMap<BaseObservedQuery, number>;
  protected isNotifyingDone!: boolean;
  protected isNotifyingError!: boolean;
  protected suppressNextDoneNotification!: boolean;

  protected cumulativeQueryKeyHashesSet!: Set<string>;
  protected isEnableHolded = false;

  /**
   * Merges query features from config and queryClient.defaultOptions.queries.
   * [**Documentation**](https://js2me.github.io/mobx-tanstack-query/api/Query.html#queryfeatures-queryfeature)
   */
  protected static mergeQueryFeatures(
    config: Partial<QueryFeatures>,
    queryClient: AnyQueryClient,
  ): QueryFeatures {
    const qf = (queryClient as { queryFeatures?: QueryFeatures }).queryFeatures;
    return {
      cumulativeQueryHash:
        config.cumulativeQueryHash ?? qf?.cumulativeQueryHash,
      enableOnDemand: config.enableOnDemand ?? qf?.enableOnDemand,
      lazy: config.lazy ?? qf?.lazy,
      lazyDelay: config.lazyDelay ?? qf?.lazyDelay,
      resetOnDestroy: config.resetOnDestroy ?? qf?.resetOnDestroy,
      removeOnDestroy: config.removeOnDestroy ?? qf?.removeOnDestroy,
      transformError: config.transformError ?? qf?.transformError,
      dynamicOptionsUpdateDelay:
        config.dynamicOptionsUpdateDelay ?? qf?.dynamicOptionsUpdateDelay,
      dynamicOptionsComparer:
        config.dynamicOptionsComparer ?? qf?.dynamicOptionsComparer,
      autoRemovePreviousQuery:
        config.autoRemovePreviousQuery ?? qf?.autoRemovePreviousQuery,
      resultObservable:
        config.resultObservable ?? qf?.resultObservable ?? 'deep',
    };
  }

  protected initializeBaseState(
    queryClient: AnyQueryClient,
    features: QueryFeatures,
    hooks?: QueryClientHooks,
  ) {
    this.queryClient = queryClient;
    this._result = undefined as unknown as TResult;
    this.isResultRequsted = false;
    this.features = features;
    this.hooks = hooks;
    this.errorListeners = [];
    this.doneListeners = [];
    this.doneNotifiedCounts = new WeakMap();
    this.errorNotifiedCounts = new WeakMap();
    this.isNotifyingDone = false;
    this.isNotifyingError = false;
    this.suppressNextDoneNotification = false;
    this.cumulativeQueryKeyHashesSet = new Set();
  }

  protected finalizeInitialization(params: {
    originalQueryProperties: readonly string[];
    getAllDynamicOptions?: () => Partial<TOptions>;
    abortSignal?: AbortSignal;
    preserveExistingProperties?: boolean;
  }) {
    this.updateResult(this.queryObserver.getOptimisticResult(this.options));

    const resultAnnotation = annotation.observable(
      this.features.resultObservable,
    );
    if (resultAnnotation) {
      resultAnnotation(this, '_result');
    }

    observable.ref(this, 'isResultRequsted');
    action.bound(this, 'setData');
    action.bound(this, 'update');
    action.bound(this, 'updateResult');
    this.refetch = this.refetch.bind(this);
    this.start = this.start.bind(this);

    params.originalQueryProperties.forEach((property) => {
      if (params.preserveExistingProperties && this[property as keyof this]) {
        return;
      }
      Object.defineProperty(this, property, {
        get: () => this.result[property as keyof TResult],
      });
    });

    makeObservable(this);

    if (this.features.lazy) {
      const cleanup = lazyObserve({
        context: this,
        property: '_result',
        endDelay: this.features.lazyDelay,
        onStart: () => {
          if (!this._observerSubscription) {
            if (params.getAllDynamicOptions) {
              this.update(params.getAllDynamicOptions() as TUpdateOptions);
            }
            this._observerSubscription = this.queryObserver.subscribe(
              this.updateResult,
            );
            if (params.getAllDynamicOptions) {
              return reaction(
                params.getAllDynamicOptions,
                (options) => this.update(options as TUpdateOptions),
                {
                  delay: this.features.dynamicOptionsUpdateDelay,
                  signal: params.abortSignal,
                  fireImmediately: true,
                  equals: this.features.dynamicOptionsComparer,
                },
              );
            }
          }
        },
        onEnd: (disposeFn, cleanup) => {
          if (this._observerSubscription) {
            disposeFn?.();
            this._observerSubscription();
            this._observerSubscription = undefined;
            params.abortSignal?.removeEventListener('abort', cleanup);
          }
        },
      });

      params.abortSignal?.addEventListener('abort', cleanup);
    } else {
      if (params.getAllDynamicOptions) {
        reaction(
          params.getAllDynamicOptions,
          (options) => this.update(options as TUpdateOptions),
          {
            delay: this.features.dynamicOptionsUpdateDelay,
            signal: params.abortSignal,
            fireImmediately: true,
            equals: this.features.dynamicOptionsComparer,
          },
        );
      }
      this._observerSubscription = this.queryObserver.subscribe(
        this.updateResult,
      );
    }
  }

  protected registerInitialListeners(params: {
    onDone?: TDoneListener;
    onError?: TErrorListener;
  }) {
    if (params.onDone) {
      this.doneListeners.push(params.onDone);
    }
    if (params.onError) {
      this.errorListeners.push(params.onError);
    }
  }

  protected createQueryHash(queryKey: any, options: TOptions) {
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
          this.options.throwOnError(query.state.error, query as any)))
    ) {
      return query.state.error;
    }

    return undefined;
  }

  /**
   *
   * [**Documentation**](https://js2me.github.io/mobx-tanstack-query/api/Query.html#setdata-updater-options)
   */
  setData(
    updater: Updater<
      NoInfer<TStoredData> | undefined,
      NoInfer<TStoredData> | undefined
    >,
    options?: SetDataOptions,
  ) {
    return this.queryClient.setQueryData<TStoredData>(
      this.options.queryKey,
      updater,
      options,
    );
  }

  /**
   *
   * [**Documentation**](https://js2me.github.io/mobx-tanstack-query/api/Query.html#refetch-options)
   */
  async refetch(options?: RefetchOptions): Promise<TResult> {
    const result = (await this.queryObserver.refetch(options)) as TResult;
    const throwableError = this.getCurrentThrowableError(options);

    if (throwableError) {
      throw throwableError;
    }

    return result;
  }

  /**
   *
   * [**Documentation**](https://js2me.github.io/mobx-tanstack-query/api/Query.html#update-options)
   */
  update(optionsUpdate: TUpdateOptions): void {
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

  protected processOptions(options: TOptions) {
    const nextQueryHash = this.createQueryHash(options.queryKey, options);

    if (
      this.features.autoRemovePreviousQuery &&
      options.queryHash !== nextQueryHash
    ) {
      this.remove({ safe: true } as TRemoveParams);
    }

    options.queryHash = nextQueryHash;

    if (this.features.cumulativeQueryHash) {
      this.cumulativeQueryKeyHashesSet.add(options.queryHash);
    }

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

  /**
   *
   * [**Documentation**](https://js2me.github.io/mobx-tanstack-query/api/Query.html#result-queryobserverresult)
   */
  public get result(): TResult {
    if (this.features.enableOnDemand && !this.isResultRequsted) {
      runInAction(() => {
        this.isResultRequsted = true;
      });
      if (this.isNotifyingDone) {
        this.suppressNextDoneNotification = true;
      }
      this.update({} as TUpdateOptions);
    }
    return this._result || this.queryObserver.getCurrentResult();
  }

  protected updateResult(result: TResult) {
    this._result = result;
    const currentQuery = this.queryObserver.getCurrentQuery();
    const queryState = currentQuery.state;

    if (this.features.transformError && this._result.error) {
      this._result.error = this.features.transformError(this._result.error);
    }

    if (result.isSuccess && !result.error && result.fetchStatus === 'idle') {
      if (this.suppressNextDoneNotification) {
        this.suppressNextDoneNotification = false;
        return;
      }
      const lastDoneCount = this.doneNotifiedCounts.get(currentQuery);
      if (
        !this.isNotifyingDone &&
        queryState.dataUpdateCount !== lastDoneCount
      ) {
        this.doneNotifiedCounts.set(currentQuery, queryState.dataUpdateCount);
        this.isNotifyingDone = true;
        try {
          this.doneListeners.forEach((fn) => {
            fn(result.data!, void 0);
          });
        } finally {
          this.isNotifyingDone = false;
        }
      }
    } else if (result.error) {
      const lastErrorCount = this.errorNotifiedCounts.get(currentQuery);
      if (
        !this.isNotifyingError &&
        queryState.errorUpdateCount !== lastErrorCount
      ) {
        this.errorNotifiedCounts.set(currentQuery, queryState.errorUpdateCount);
        this.isNotifyingError = true;
        try {
          this.errorListeners.forEach((fn) => {
            fn(result.error!, void 0);
          });
        } finally {
          this.isNotifyingError = false;
        }
      }
    }
  }

  /**
   *
   * [**Documentation**](https://js2me.github.io/mobx-tanstack-query/api/Query.html#reset-params-options)
   */
  async reset(params?: TResetParams, options?: ResetOptions): Promise<void> {
    if (this.features.cumulativeQueryHash) {
      return await this.queryClient.resetQueries({
        predicate: (query: any) => {
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

  /**
   *
   * [**Documentation**](https://js2me.github.io/mobx-tanstack-query/api/Query.html#remove-params)
   */
  remove(params?: TRemoveParams) {
    if (this.features.cumulativeQueryHash) {
      return this.queryClient.removeQueries({
        predicate: (query: any) => {
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
        predicate: (query: any) =>
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

  /**
   *
   * [**Documentation**](https://js2me.github.io/mobx-tanstack-query/api/Query.html#cancel-options)
   */
  async cancel(options?: CancelOptions): Promise<void> {
    return await this.queryClient.cancelQueries(
      {
        queryKey: this.options.queryKey,
        exact: true,
      },
      options,
    );
  }

  /**
   *
   * [**Documentation**](https://js2me.github.io/mobx-tanstack-query/api/Query.html#invalidate-params)
   */
  async invalidate(params?: TInvalidateParams): Promise<void> {
    return await this.queryClient.invalidateQueries({
      exact: true,
      queryKey: this.options.queryKey,
      ...params,
    } as any);
  }

  /**
   *
   * [**Documentation**](https://js2me.github.io/mobx-tanstack-query/api/Query.html#ondone-listener)
   */
  onDone(doneListener: TDoneListener): void {
    this.doneListeners.push(doneListener);
  }

  /**
   *
   * [**Documentation**](https://js2me.github.io/mobx-tanstack-query/api/Query.html#onerror-listener)
   */
  onError(errorListener: TErrorListener): void {
    this.errorListeners.push(errorListener);
  }

  protected cleanup() {
    this._observerSubscription?.();

    this.doneListeners = [];
    this.errorListeners = [];
    this.doneNotifiedCounts = new WeakMap();
    this.errorNotifiedCounts = new WeakMap();

    this.queryObserver.destroy();

    if (this.features.resetOnDestroy) {
      void this.reset();
    }

    if (this.features.removeOnDestroy) {
      this.remove({
        safe: this.features.removeOnDestroy === 'safe',
      } as TRemoveParams);
    }

    delete this._observerSubscription;

    this.cumulativeQueryKeyHashesSet.clear();
  }

  /**
   *
   * [**Documentation**](https://js2me.github.io/mobx-tanstack-query/api/Query.html#start-params)
   */
  async start(params: TStartParams = {} as TStartParams): Promise<TResult> {
    this.update({ ...params } as TUpdateOptions);

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
}

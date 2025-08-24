import {
  DefaultError,
  hashKey,
  QueryKey,
  QueryObserver,
  QueryObserverResult,
  RefetchOptions,
  SetDataOptions,
  Updater,
} from '@tanstack/query-core';
import { LinkedAbortController } from 'linked-abort-controller';
import {
  action,
  makeObservable,
  observable,
  reaction,
  runInAction,
} from 'mobx';

import { QueryClient } from './query-client';
import { AnyQueryClient, QueryClientHooks } from './query-client.types';
import { QueryOptionsParams } from './query-options';
import {
  QueryConfig,
  QueryDoneListener,
  QueryErrorListener,
  QueryInvalidateParams,
  QueryOptions,
  QueryResetParams,
  QueryStartParams,
  QueryUpdateOptionsAllVariants,
} from './query.types';
import { lazyObserve } from './utils/lazy-observe';

const enableHolder = () => false;

export class Query<
  TQueryFnData = unknown,
  TError = DefaultError,
  TData = TQueryFnData,
  TQueryData = TQueryFnData,
  TQueryKey extends QueryKey = QueryKey,
> implements Disposable
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

  private isEnabledOnResultDemand: boolean;
  isResultRequsted: boolean;
  protected isLazy?: boolean;

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

  protected config: QueryConfig<
    TQueryFnData,
    TError,
    TData,
    TQueryData,
    TQueryKey
  >;

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

    const { queryKey: queryKeyOrDynamicQueryKey, ...restOptions } = config;

    this.config = {
      ...config,
      queryClient,
    };

    this.abortController = new LinkedAbortController(config.abortSignal);
    this.queryClient = queryClient;
    this._result = undefined as any;
    this.isResultRequsted = false;
    this.isEnabledOnResultDemand = config.enableOnDemand ?? false;
    this.errorListeners = [];
    this.doneListeners = [];
    this.hooks =
      'hooks' in this.queryClient ? this.queryClient.hooks : undefined;
    this.isLazy = this.config.lazy;

    if ('queryFeatures' in queryClient) {
      if (this.config.lazy === undefined) {
        this.isLazy = queryClient.queryFeatures.lazy ?? false;
      }
      if (config.enableOnDemand === undefined) {
        this.isEnabledOnResultDemand =
          queryClient.queryFeatures.enableOnDemand ?? false;
      }
    }

    observable.deep(this, '_result');
    observable.ref(this, 'isResultRequsted');
    action(this, 'handleAbort');
    action.bound(this, 'setData');
    action.bound(this, 'update');
    action.bound(this, 'updateResult');

    makeObservable(this);

    const isQueryKeyDynamic = typeof queryKeyOrDynamicQueryKey === 'function';

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

    if (this.isLazy) {
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
      if (isQueryKeyDynamic) {
        reaction(
          queryKeyOrDynamicQueryKey,
          (queryKey) => this.update({ queryKey }),
          {
            signal: this.abortController.signal,
            delay: this.config.dynamicOptionsUpdateDelay,
          },
        );
      }
      if (getDynamicOptions) {
        reaction(() => getDynamicOptions(this), this.update, {
          signal: this.abortController.signal,
          delay: this.config.dynamicOptionsUpdateDelay,
        });
      }
      this._observerSubscription = this.queryObserver.subscribe(
        this.updateResult,
      );
      this.abortController.signal.addEventListener('abort', this.handleAbort);
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
    const query = this.queryObserver.getCurrentQuery();

    if (
      query.state.error &&
      (options?.throwOnError ||
        this.options.throwOnError === true ||
        (typeof this.options.throwOnError === 'function' &&
          this.options.throwOnError(query.state.error, query)))
    ) {
      throw query.state.error;
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

    if (this.isLazy) {
      this.updateResult(this.queryObserver.getCurrentResult());
    }
  }

  private isEnableHolded = false;

  private processOptions = (
    options: QueryOptions<TQueryFnData, TError, TData, TQueryData, TQueryKey>,
  ) => {
    options.queryHash = this.createQueryHash(options.queryKey, options);

    // If the on-demand query mode is enabled (when using the result property)
    // then, if the user does not request the result, the queries should not be executed
    // to do this, we hold the original value of the enabled option
    // and set enabled to false until the user requests the result (this.isResultRequsted)
    if (this.isEnabledOnResultDemand) {
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
  };

  public get result() {
    if (this.isEnabledOnResultDemand && !this.isResultRequsted) {
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

  async reset(params?: QueryResetParams) {
    return await this.queryClient.resetQueries({
      queryKey: this.options.queryKey,
      exact: true,
      ...params,
    } as any);
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

  protected handleAbort = () => {
    this._observerSubscription?.();

    this.doneListeners = [];
    this.errorListeners = [];

    this.queryObserver.destroy();

    let isNeedToReset =
      this.config.resetOnDestroy || this.config.resetOnDispose;

    if (this.queryClient instanceof QueryClient && !isNeedToReset) {
      isNeedToReset =
        this.queryClient.queryFeatures.resetOnDestroy ||
        this.queryClient.queryFeatures.resetOnDispose;
    }

    if (isNeedToReset) {
      this.reset();
    }

    delete this._observerSubscription;

    this.hooks?.onQueryDestroy?.(this);
  };

  async start({
    cancelRefetch,
    ...params
  }: QueryStartParams<
    TQueryFnData,
    TError,
    TData,
    TQueryData,
    TQueryKey
  > = {}) {
    this.update({ ...params });

    return await this.refetch({ cancelRefetch });
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

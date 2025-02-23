import {
  DefaultError,
  FetchNextPageOptions,
  FetchPreviousPageOptions,
  hashKey,
  InfiniteQueryObserver,
  QueryClient,
  QueryKey,
  InfiniteQueryObserverResult,
  InfiniteData,
  RefetchOptions,
  SetDataOptions,
  Updater,
} from '@tanstack/query-core';
import { LinkedAbortController } from 'linked-abort-controller';
import {
  action,
  reaction,
  makeObservable,
  observable,
  runInAction,
} from 'mobx';

import {
  MobxInfiniteQueryConfig,
  MobxInfiniteQueryDynamicOptions,
  MobxInfiniteQueryInvalidateParams,
  MobxInfiniteQueryOptions,
  MobxInfiniteQueryResetParams,
  MobxInfiniteQueryUpdateOptions,
} from './mobx-inifinite-query.types';
import { MobxQueryClient, MobxQueryClientHooks } from './mobx-query-client';

export class MobxInfiniteQuery<
  TData,
  TError = DefaultError,
  TQueryKey extends QueryKey = any,
  TPageParam = unknown,
> implements Disposable
{
  protected abortController: AbortController;
  protected queryClient: QueryClient | MobxQueryClient;

  protected _result: InfiniteQueryObserverResult<
    InfiniteData<TData, TPageParam>,
    TError
  >;
  options: MobxInfiniteQueryOptions<TData, TError, TQueryKey, TPageParam>;
  queryObserver: InfiniteQueryObserver<
    TData,
    TError,
    InfiniteData<TData, TPageParam>,
    TData,
    TQueryKey,
    TPageParam
  >;

  isResultRequsted: boolean;

  private isEnabledOnResultDemand: boolean;

  private isStaticDisabled;

  /**
   * This parameter is responsible for holding the enabled value,
   * in cases where the "enableOnDemand" option is enabled
   */
  private holdedEnabledOption: MobxInfiniteQueryOptions<
    TData,
    TError,
    TQueryKey,
    TPageParam
  >['enabled'];
  private _observerSubscription?: VoidFunction;
  private hooks?: MobxQueryClientHooks;

  constructor(
    protected config: MobxInfiniteQueryConfig<
      TData,
      TError,
      TQueryKey,
      TPageParam
    >,
  ) {
    const {
      queryClient,
      queryKey: queryKeyOrDynamicQueryKey,
      options: getDynamicOptions,
      ...restOptions
    } = config;
    this.abortController = new LinkedAbortController(config.abortSignal);
    this.queryClient = queryClient;
    this._result = undefined as any;
    this.isResultRequsted = false;
    this.isEnabledOnResultDemand = config.enableOnDemand ?? false;
    this.hooks =
      'hooks' in this.queryClient ? this.queryClient.hooks : undefined;

    if (
      queryClient instanceof MobxQueryClient &&
      config.enableOnDemand == null
    ) {
      this.isEnabledOnResultDemand =
        queryClient.queryFeatures.enableOnDemand ?? false;
    }

    if (config.disposer) {
      config.disposer.add(() => this.dispose());
    }

    observable.deep(this, '_result');
    observable.ref(this, 'isResultRequsted');
    action.bound(this, 'setData');
    action.bound(this, 'update');
    action.bound(this, 'updateResult');

    makeObservable(this);

    this.isStaticDisabled =
      restOptions.enabled === false ||
      this.queryClient.getDefaultOptions().queries?.enabled === false;

    this.options = this.queryClient.defaultQueryOptions({
      ...restOptions,
      ...getDynamicOptions?.(this),
    } as any) as MobxInfiniteQueryOptions<TData, TError, TQueryKey, TPageParam>;

    this.options.structuralSharing = this.options.structuralSharing ?? false;

    this.processOptions(this.options);

    if (this.isStaticDisabled) {
      this.holdedEnabledOption = undefined;
    }

    if (typeof queryKeyOrDynamicQueryKey === 'function') {
      this.options.queryKey = queryKeyOrDynamicQueryKey();

      reaction(
        () => queryKeyOrDynamicQueryKey(),
        (queryKey) => {
          this.update({
            queryKey,
          });
        },
        {
          signal: this.abortController.signal,
        },
      );
    } else {
      this.options.queryKey =
        queryKeyOrDynamicQueryKey ?? this.options.queryKey ?? [];
    }

    // Tracking props visit should be done in MobX, by default.
    this.options.notifyOnChangeProps =
      restOptions.notifyOnChangeProps ??
      queryClient.getDefaultOptions().queries?.notifyOnChangeProps ??
      'all';

    this.queryObserver = new InfiniteQueryObserver(queryClient, this.options);

    this.updateResult(this.queryObserver.getOptimisticResult(this.options));

    this._observerSubscription = this.queryObserver.subscribe(
      this.updateResult,
    );

    if (getDynamicOptions) {
      reaction(() => getDynamicOptions(this), this.update, {
        signal: this.abortController.signal,
      });
    }

    if (this.isEnabledOnResultDemand) {
      reaction(
        () => this.isResultRequsted,
        (isRequested) => {
          if (isRequested) {
            this.update(getDynamicOptions?.(this) ?? {});
          }
        },
        {
          signal: this.abortController.signal,
          fireImmediately: true,
        },
      );
    }

    if (config.onDone) {
      this.onDone(config.onDone);
    }
    if (config.onError) {
      this.onError(config.onError);
    }

    this.abortController.signal.addEventListener('abort', this.handleAbort);

    this.config.onInit?.(this);
    this.hooks?.onInfiniteQueryInit?.(this);
  }

  protected createQueryHash(
    queryKey: any,
    options: MobxInfiniteQueryOptions<TData, TError, TQueryKey, TPageParam>,
  ) {
    if (options.queryKeyHashFn) {
      return options.queryKeyHashFn(queryKey);
    }

    return hashKey(queryKey);
  }

  setData(
    updater: Updater<
      NoInfer<InfiniteData<TData, TPageParam>> | undefined,
      NoInfer<InfiniteData<TData, TPageParam>> | undefined
    >,
    options?: SetDataOptions,
  ) {
    this.queryClient.setQueryData<InfiniteData<TData, TPageParam>>(
      this.options.queryKey,
      updater,
      options,
    );
  }

  private checkIsEnabled() {
    if (this.isEnabledOnResultDemand && !this.isResultRequsted) {
      return false;
    }

    return this.holdedEnabledOption;
  }

  fetchNextPage(options?: FetchNextPageOptions | undefined) {
    return this.queryObserver.fetchNextPage(options);
  }

  fetchPreviousPage(options?: FetchPreviousPageOptions | undefined) {
    return this.queryObserver.fetchPreviousPage(options);
  }

  update(
    optionsUpdate:
      | Partial<MobxInfiniteQueryOptions<TData, TError, TQueryKey, TPageParam>>
      | MobxInfiniteQueryUpdateOptions<TData, TError, TQueryKey, TPageParam>
      | MobxInfiniteQueryDynamicOptions<TData, TError, TQueryKey, TPageParam>,
  ) {
    if (this.abortController.signal.aborted) {
      return;
    }

    const nextOptions = {
      ...this.options,
      ...optionsUpdate,
    } as MobxInfiniteQueryOptions<TData, TError, TQueryKey, TPageParam>;

    this.processOptions(nextOptions);

    this.options = nextOptions;

    this.queryObserver.setOptions(this.options);
  }

  private isEnableHolded = false;

  private enableHolder = () => false;

  private processOptions = (
    options: MobxInfiniteQueryOptions<TData, TError, TQueryKey, TPageParam>,
  ) => {
    options.queryHash = this.createQueryHash(options.queryKey, options);

    // If the on-demand query mode is enabled (when using the result property)
    // then, if the user does not request the result, the queries should not be executed
    // to do this, we hold the original value of the enabled option
    // and set enabled to false until the user requests the result (this.isResultRequsted)
    if (this.isEnabledOnResultDemand) {
      if (this.isEnableHolded && options.enabled !== this.enableHolder) {
        this.holdedEnabledOption = options.enabled;
      }

      if (this.isResultRequsted) {
        if (this.isEnableHolded) {
          options.enabled =
            this.holdedEnabledOption === this.enableHolder
              ? undefined
              : this.holdedEnabledOption;
          this.isEnableHolded = false;
        }
      } else {
        this.isEnableHolded = true;
        this.holdedEnabledOption = options.enabled;
        options.enabled = this.enableHolder;
      }
    }
  };

  public get result() {
    if (!this.isResultRequsted) {
      runInAction(() => {
        this.isResultRequsted = true;
      });
    }
    return this._result;
  }

  /**
   * Modify this result so it matches the tanstack query result.
   */
  private updateResult(
    nextResult: InfiniteQueryObserverResult<
      InfiniteData<TData, TPageParam>,
      TError
    >,
  ) {
    this._result = nextResult || {};
  }

  async refetch(options?: RefetchOptions) {
    return await this.queryObserver.refetch(options);
  }

  async reset(params?: MobxInfiniteQueryResetParams) {
    await this.queryClient.resetQueries({
      queryKey: this.options.queryKey,
      exact: true,
      ...params,
    });
  }

  async invalidate(options?: MobxInfiniteQueryInvalidateParams) {
    await this.queryClient.invalidateQueries({
      exact: true,
      queryKey: this.options.queryKey,
      ...options,
    });
  }

  onDone(
    onDoneCallback: (
      data: InfiniteData<TData, TPageParam>,
      payload: void,
    ) => void,
  ): void {
    reaction(
      () => {
        const { error, isSuccess, fetchStatus } = this._result;
        return isSuccess && !error && fetchStatus === 'idle';
      },
      (isDone) => {
        if (isDone) {
          onDoneCallback(this._result.data!, void 0);
        }
      },
      {
        signal: this.abortController.signal,
      },
    );
  }

  onError(onErrorCallback: (error: TError, payload: void) => void): void {
    reaction(
      () => this._result.error,
      (error) => {
        if (error) {
          onErrorCallback(error, void 0);
        }
      },
      {
        signal: this.abortController.signal,
      },
    );
  }

  protected handleAbort = () => {
    this._observerSubscription?.();

    this.queryObserver.getCurrentQuery().destroy();
    this.queryObserver.destroy();
    this.isResultRequsted = false;

    let isNeedToReset =
      this.config.resetOnDestroy || this.config.resetOnDispose;

    if (this.queryClient instanceof MobxQueryClient && !isNeedToReset) {
      isNeedToReset =
        this.queryClient.queryFeatures.resetOnDestroy ||
        this.queryClient.queryFeatures.resetOnDispose;
    }

    if (isNeedToReset) {
      this.reset();
    }

    delete this._observerSubscription;
    this.hooks?.onInfiniteQueryDestroy?.(this);
  };

  destroy() {
    this.abortController.abort();
  }

  /**
   * @deprecated use `destroy`
   */
  dispose() {
    this.destroy();
  }

  [Symbol.dispose](): void {
    this.destroy();
  }
}

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
import { MobxQueryClient } from './mobx-query-client';

export class MobxInfiniteQuery<
  TData,
  TError = DefaultError,
  TQueryKey extends QueryKey = any,
  TPageParam = unknown,
> implements Disposable
{
  protected abortController: AbortController;
  protected queryClient: QueryClient | MobxQueryClient;

  protected _result: InfiniteQueryObserverResult<InfiniteData<TData>, TError>;
  options: MobxInfiniteQueryOptions<TData, TError, TQueryKey, TPageParam>;
  queryObserver: InfiniteQueryObserver<
    TData,
    TError,
    InfiniteData<TData>,
    InfiniteData<TData>,
    TQueryKey,
    TPageParam
  >;

  isResultRequsted: boolean;

  private isEnabledOnResultDemand: boolean;

  private _originEnabled: MobxInfiniteQueryOptions<
    TData,
    TError,
    TQueryKey,
    TPageParam
  >['enabled'];
  private _observerSubscription?: VoidFunction;

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
      ...restOptions
    } = config;
    this.abortController = new LinkedAbortController(config.abortSignal);
    this.queryClient = queryClient;
    this._result = undefined as any;
    this.isResultRequsted = false;
    this.isEnabledOnResultDemand = config.enableOnDemand ?? false;

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

    this.options = this.createOptions({
      ...restOptions,
      ...config.options?.(this),
    });

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

    if (config.options) {
      reaction(() => config.options!(this), this.update, {
        signal: this.abortController.signal,
      });
    }

    if (this.isEnabledOnResultDemand) {
      reaction(
        () => this.isResultRequsted,
        (isRequested) => {
          if (isRequested) {
            this.update(config.options ? config.options(this) : {});
          }
        },
        {
          signal: this.abortController.signal,
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
      NoInfer<InfiniteData<TData>> | undefined,
      NoInfer<InfiniteData<TData>> | undefined
    >,
    options?: SetDataOptions,
  ) {
    this.queryClient.setQueryData<InfiniteData<TData>>(
      this.options.queryKey,
      updater,
      options,
    );
  }

  private checkIsEnabled() {
    if (this.isEnabledOnResultDemand && !this.isResultRequsted) {
      return false;
    }

    return this._originEnabled;
  }

  fetchNextPage(options?: FetchNextPageOptions | undefined) {
    return this.queryObserver.fetchNextPage(options);
  }

  fetchPreviousPage(options?: FetchPreviousPageOptions | undefined) {
    return this.queryObserver.fetchPreviousPage(options);
  }

  private createOptions(
    optionsUpdate:
      | Partial<MobxInfiniteQueryOptions<TData, TError, TQueryKey, TPageParam>>
      | MobxInfiniteQueryUpdateOptions<TData, TError, TQueryKey, TPageParam>
      | MobxInfiniteQueryDynamicOptions<TData, TError, TQueryKey, TPageParam>,
  ) {
    const options = this.queryClient.defaultQueryOptions({
      ...this.options,
      ...optionsUpdate,
    } as any) as MobxInfiniteQueryOptions<TData, TError, TQueryKey, TPageParam>;
    if ('enabled' in optionsUpdate) {
      this._originEnabled = options.enabled;
    }
    options.enabled = this.checkIsEnabled();
    options.queryHash = this.createQueryHash(options.queryKey, options);

    return options;
  }

  update(
    options:
      | MobxInfiniteQueryUpdateOptions<TData, TError, TQueryKey, TPageParam>
      | MobxInfiniteQueryDynamicOptions<TData, TError, TQueryKey, TPageParam>,
  ) {
    if (this.abortController.signal.aborted) {
      return;
    }
    this.options = this.createOptions(options);
    this.queryObserver.setOptions(this.options);
  }

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
      InfiniteData<TData, unknown>,
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
    onDoneCallback: (data: InfiniteData<TData>, payload: void) => void,
  ): void {
    reaction(
      () => !this._result.error && this._result.isSuccess,
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

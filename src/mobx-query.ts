import {
  DefaultError,
  hashKey,
  QueryClient,
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

import { MobxQueryClient, MobxQueryClientHooks } from './mobx-query-client';
import {
  MobxQueryConfig,
  MobxQueryDynamicOptions,
  MobxQueryInvalidateParams,
  MobxQueryOptions,
  MobxQueryResetParams,
  MobxQueryUpdateOptions,
} from './mobx-query.types';

export class MobxQuery<
  TData,
  TError = DefaultError,
  TQueryKey extends QueryKey = any,
> implements Disposable
{
  protected abortController: AbortController;
  protected queryClient: QueryClient | MobxQueryClient;

  protected _result: QueryObserverResult<TData, TError>;

  options: MobxQueryOptions<TData, TError, TQueryKey>;
  queryObserver: QueryObserver<TData, TError, TData, TData, TQueryKey>;

  isResultRequsted: boolean;

  private isEnabledOnResultDemand: boolean;

  private _originEnabled: MobxQueryOptions<TData, TError, TQueryKey>['enabled'];
  private _observerSubscription?: VoidFunction;
  private hooks?: MobxQueryClientHooks;

  constructor(protected config: MobxQueryConfig<TData, TError, TQueryKey>) {
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

    this.queryObserver = new QueryObserver(queryClient, this.options);

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
    this.hooks?.onQueryInit?.(this);
  }

  async refetch(options?: RefetchOptions) {
    return await this.queryObserver.refetch(options);
  }

  protected createQueryHash(
    queryKey: any,
    options: MobxQueryOptions<TData, TError, TQueryKey>,
  ) {
    if (options.queryKeyHashFn) {
      return options.queryKeyHashFn(queryKey);
    }

    return hashKey(queryKey);
  }

  setData(
    updater: Updater<NoInfer<TData> | undefined, NoInfer<TData> | undefined>,
    options?: SetDataOptions,
  ) {
    return this.queryClient.setQueryData<TData>(
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

  private createOptions(
    optionsUpdate:
      | Partial<MobxQueryOptions<TData, TError, TQueryKey>>
      | MobxQueryUpdateOptions<TData, TError, TQueryKey>
      | MobxQueryDynamicOptions<TData, TError, TQueryKey>,
  ) {
    const options = this.queryClient.defaultQueryOptions({
      ...this.options,
      ...optionsUpdate,
    } as any) as MobxQueryOptions<TData, TError, TQueryKey>;
    if ('enabled' in optionsUpdate) {
      this._originEnabled = options.enabled;
    }
    options.structuralSharing = options.structuralSharing ?? false;
    options.enabled = this.checkIsEnabled();
    options.queryHash = this.createQueryHash(options.queryKey, options);

    return options;
  }

  update(
    options:
      | MobxQueryUpdateOptions<TData, TError, TQueryKey>
      | MobxQueryDynamicOptions<TData, TError, TQueryKey>,
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
  private updateResult(result: QueryObserverResult<TData, TError>) {
    this._result = result;
  }

  async reset(params?: MobxQueryResetParams) {
    return await this.queryClient.resetQueries({
      queryKey: this.options.queryKey,
      exact: true,
      ...params,
    });
  }

  async invalidate(params?: MobxQueryInvalidateParams) {
    return await this.queryClient.invalidateQueries({
      exact: true,
      queryKey: this.options.queryKey,
      ...params,
    });
  }

  onDone(onDoneCallback: (data: TData, payload: void) => void): void {
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
  };

  destroy() {
    this.abortController.abort();
    this.hooks?.onQueryDestroy?.(this);
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

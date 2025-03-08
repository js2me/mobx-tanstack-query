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
  MobxQueryStartParams,
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

  /**
   * This parameter is responsible for holding the enabled value,
   * in cases where the "enableOnDemand" option is enabled
   */
  private holdedEnabledOption: MobxQueryOptions<
    TData,
    TError,
    TQueryKey
  >['enabled'];
  private _observerSubscription?: VoidFunction;
  private hooks?: MobxQueryClientHooks;

  constructor(protected config: MobxQueryConfig<TData, TError, TQueryKey>) {
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

    this.options = this.queryClient.defaultQueryOptions({
      ...restOptions,
      ...getDynamicOptions?.(this),
    } as any);

    this.options.structuralSharing = this.options.structuralSharing ?? false;

    this.processOptions(this.options);

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

    if (getDynamicOptions) {
      reaction(() => getDynamicOptions(this), this.update, {
        signal: this.abortController.signal,
      });
    }

    if (this.isResultRequsted) {
      this.update(getDynamicOptions?.(this) ?? {});
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

  update(
    optionsUpdate:
      | Partial<MobxQueryOptions<TData, TError, TQueryKey>>
      | MobxQueryUpdateOptions<TData, TError, TQueryKey>
      | MobxQueryDynamicOptions<TData, TError, TQueryKey>,
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
  }

  private isEnableHolded = false;

  private enableHolder = () => false;

  private processOptions = (
    options: MobxQueryOptions<TData, TError, TQueryKey>,
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
  private updateResult(result: QueryObserverResult<TData, TError>) {
    this._result = result;
  }

  async reset(params?: MobxQueryResetParams) {
    return await this.queryClient.resetQueries({
      queryKey: this.options.queryKey,
      exact: true,
      ...params,
    } as any);
  }

  async invalidate(params?: MobxQueryInvalidateParams) {
    return await this.queryClient.invalidateQueries({
      exact: true,
      queryKey: this.options.queryKey,
      ...params,
    } as any);
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

    this.hooks?.onQueryDestroy?.(this);
  };

  destroy() {
    this.abortController.abort();
  }

  async start({
    cancelRefetch,
    ...params
  }: MobxQueryStartParams<TData, TError, TQueryKey> = {}) {
    this.update({ ...params });

    await this.refetch({ cancelRefetch });
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

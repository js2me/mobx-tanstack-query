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

import { QueryClient } from './mobx-query-client';
import { AnyQueryClient, QueryClientHooks } from './mobx-query-client.types';
import {
  QueryConfig,
  QueryDynamicOptions,
  QueryInvalidateParams,
  QueryOptions,
  QueryResetParams,
  QueryStartParams,
  QueryUpdateOptions,
} from './mobx-query.types';
import { QueryOptionsParams } from './query-options';

export class Query<
  TQueryFnData = unknown,
  TError = DefaultError,
  TData = TQueryFnData,
  TQueryData = TQueryFnData,
  TQueryKey extends QueryKey = QueryKey,
> implements Disposable
{
  protected abortController: AbortController;
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

  private isEnabledOnResultDemand: boolean;

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
    const [queryClient, config]: [
      AnyQueryClient,
      QueryOptionsParams<TQueryFnData, TError, TData, TQueryData, TQueryKey>,
    ] =
      args.length === 2 ? [args[0], args[1]()] : [args[0].queryClient, args[0]];
    const {
      queryKey: queryKeyOrDynamicQueryKey,
      options: getDynamicOptions,
      ...restOptions
    } = config;
    this.config = {
      ...config,
      queryClient,
    };
    this.abortController = new LinkedAbortController(config.abortSignal);
    this.queryClient = queryClient;
    this._result = undefined as any;
    this.isResultRequsted = false;
    this.isEnabledOnResultDemand = config.enableOnDemand ?? false;
    this.hooks =
      'hooks' in this.queryClient ? this.queryClient.hooks : undefined;

    if (queryClient instanceof QueryClient && config.enableOnDemand == null) {
      this.isEnabledOnResultDemand =
        queryClient.queryFeatures.enableOnDemand ?? false;
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

    this.queryObserver = new QueryObserver<
      TQueryFnData,
      TError,
      TData,
      TQueryData,
      TQueryKey
    >(queryClient as QueryClient, this.options);

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
    optionsUpdate:
      | Partial<
          QueryOptions<TQueryFnData, TError, TData, TQueryData, TQueryKey>
        >
      | QueryUpdateOptions<TQueryFnData, TError, TData, TQueryData, TQueryKey>
      | QueryDynamicOptions<TQueryFnData, TError, TData, TQueryData, TQueryKey>,
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
    options: QueryOptions<TQueryFnData, TError, TData, TQueryData, TQueryKey>,
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

    this.queryObserver.destroy();
    this.isResultRequsted = false;

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

  destroy() {
    this.abortController.abort();
  }

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

    await this.refetch({ cancelRefetch });
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
 * @remarks ⚠️ use `Query`. This export will be removed in next major release
 */
export const MobxQuery = Query;

/* eslint-disable @typescript-eslint/ban-ts-comment */
import {
  DefaultError,
  FetchNextPageOptions,
  FetchPreviousPageOptions,
  hashKey,
  InfiniteQueryObserver,
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
  InfiniteQueryConfig,
  InfiniteQueryFlattenConfig,
  InfiniteQueryInvalidateParams,
  InfiniteQueryOptions,
  InfiniteQueryResetParams,
  InfiniteQueryStartParams,
  InfiniteQueryUpdateOptionsAllVariants,
} from './inifinite-query.types';
import { AnyQueryClient, QueryClientHooks } from './query-client.types';

export class InfiniteQuery<
  TQueryFnData = unknown,
  TError = DefaultError,
  TPageParam = unknown,
  TData = InfiniteData<TQueryFnData, TPageParam>,
  TQueryKey extends QueryKey = QueryKey,
> implements Disposable
{
  protected abortController: AbortController;
  protected queryClient: AnyQueryClient;

  protected _result: InfiniteQueryObserverResult<TData, TError>;

  protected config: InfiniteQueryConfig<
    TQueryFnData,
    TError,
    TPageParam,
    TData,
    TQueryKey
  >;

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

  private isEnabledOnResultDemand: boolean;

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
    this.hooks =
      'hooks' in this.queryClient ? this.queryClient.hooks : undefined;

    if ('queryFeatures' in queryClient && config.enableOnDemand == null) {
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
    } as any) as InfiniteQueryOptions<
      TQueryFnData,
      TError,
      TPageParam,
      TData,
      TQueryKey
    >;

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

    // @ts-expect-error
    this.queryObserver = new InfiniteQueryObserver(queryClient, this.options);

    // @ts-expect-error
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
    options: InfiniteQueryOptions<
      TQueryFnData,
      TError,
      TPageParam,
      TData,
      TQueryKey
    >,
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
    this.queryClient.setQueryData<TData>(
      this.options.queryKey,
      updater,
      options,
    );
  }

  fetchNextPage(options?: FetchNextPageOptions | undefined) {
    return this.queryObserver.fetchNextPage(options);
  }

  fetchPreviousPage(options?: FetchPreviousPageOptions | undefined) {
    return this.queryObserver.fetchPreviousPage(options);
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
    if (this.abortController.signal.aborted) {
      return;
    }

    const nextOptions = {
      ...this.options,
      ...optionsUpdate,
    } as InfiniteQueryOptions<
      TQueryFnData,
      TError,
      TPageParam,
      TData,
      TQueryKey
    >;

    this.processOptions(nextOptions);

    this.options = nextOptions;

    // @ts-expect-error
    this.queryObserver.setOptions(this.options);
  }

  private isEnableHolded = false;

  private enableHolder = () => false;

  private processOptions = (
    options: InfiniteQueryOptions<
      TQueryFnData,
      TError,
      TPageParam,
      TData,
      TQueryKey
    >,
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
  private updateResult(nextResult: InfiniteQueryObserverResult<TData, TError>) {
    this._result = nextResult || {};
  }

  async refetch(options?: RefetchOptions) {
    const result = await this.queryObserver.refetch(options);
    const query = this.queryObserver.getCurrentQuery();

    if (
      query.state.error &&
      (options?.throwOnError ||
        this.options.throwOnError === true ||
        (typeof this.options.throwOnError === 'function' &&
          // @ts-expect-error
          this.options.throwOnError(query.state.error, query)))
    ) {
      throw query.state.error;
    }

    return result;
  }

  async reset(params?: InfiniteQueryResetParams) {
    await this.queryClient.resetQueries({
      queryKey: this.options.queryKey,
      exact: true,
      ...params,
    } as any);
  }

  async invalidate(options?: InfiniteQueryInvalidateParams) {
    await this.queryClient.invalidateQueries({
      exact: true,
      queryKey: this.options.queryKey,
      ...options,
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

  async start({
    cancelRefetch,
    ...params
  }: InfiniteQueryStartParams<
    TQueryFnData,
    TError,
    TPageParam,
    TData,
    TQueryKey
  > = {}) {
    this.update({ ...params });

    return await this.refetch({ cancelRefetch });
  }

  protected handleAbort = () => {
    this._observerSubscription?.();

    this.queryObserver.destroy();
    this.isResultRequsted = false;

    let isNeedToReset =
      this.config.resetOnDestroy || this.config.resetOnDispose;

    if ('queryFeatures' in this.queryClient && !isNeedToReset) {
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

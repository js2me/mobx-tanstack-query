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
> {
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

  constructor({
    queryClient,
    onInit,
    options: getDynamicOptions,
    onDone,
    onError,
    // eslint-disable-next-line sonarjs/deprecation
    disposer,
    abortSignal: outerAbortSignal,
    resetOnDispose,
    enableOnDemand,
    queryKey: queryKeyOrDynamicQueryKey,
    ...options
  }: MobxInfiniteQueryConfig<TData, TError, TQueryKey, TPageParam>) {
    this.abortController = new LinkedAbortController(outerAbortSignal);
    this.queryClient = queryClient;
    this._result = undefined as any;
    this.isResultRequsted = false;
    this.isEnabledOnResultDemand = enableOnDemand ?? false;

    if (queryClient instanceof MobxQueryClient && enableOnDemand == null) {
      this.isEnabledOnResultDemand =
        queryClient.queryFeatures.enableOnDemand ?? false;
    }

    if (disposer) {
      disposer.add(() => this.dispose());
    }

    observable.deep(this, '_result');
    observable.ref(this, 'isResultRequsted');
    action.bound(this, 'setData');
    action.bound(this, 'update');
    action.bound(this, 'updateResult');

    makeObservable(this);

    const mergedOptions = {
      ...options,
      ...getDynamicOptions?.(this),
    };

    if (queryKeyOrDynamicQueryKey) {
      if (typeof queryKeyOrDynamicQueryKey === 'function') {
        mergedOptions.queryKey = queryKeyOrDynamicQueryKey();

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
        mergedOptions.queryKey = queryKeyOrDynamicQueryKey;
      }
    }

    this.options = this.createOptions({
      ...mergedOptions,
      queryKey: (mergedOptions.queryKey ?? []) as TQueryKey,
    });

    // Tracking props visit should be done in MobX, by default.
    this.options.notifyOnChangeProps =
      options.notifyOnChangeProps ??
      queryClient.getDefaultOptions().queries?.notifyOnChangeProps ??
      'all';

    this.queryObserver = new InfiniteQueryObserver(queryClient, this.options);

    this.updateResult(this.queryObserver.getOptimisticResult(this.options));

    const subscription = this.queryObserver.subscribe(this.updateResult);

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
            this.update(getDynamicOptions ? getDynamicOptions(this) : {});
          }
        },
        {
          signal: this.abortController.signal,
        },
      );
    }

    if (onDone) {
      this.onDone(onDone);
    }
    if (onError) {
      this.onError(onError);
    }

    this.abortController.signal.addEventListener('abort', () => {
      subscription();

      this.queryObserver.getCurrentQuery().destroy();
      this.queryObserver.destroy();
      this.isResultRequsted = false;

      if (
        resetOnDispose ||
        (queryClient instanceof MobxQueryClient &&
          queryClient.queryFeatures.resetOnDispose)
      ) {
        this.reset();
      }
    });

    onInit?.(this);
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

  dispose() {
    this.abortController.abort();
  }
}

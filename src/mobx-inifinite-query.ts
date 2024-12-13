import {
  DefaultedInfiniteQueryObserverOptions,
  DefaultError,
  FetchNextPageOptions,
  FetchPreviousPageOptions,
  hashKey,
  InfiniteQueryObserver,
  InfiniteQueryObserverOptions,
  QueryClient,
  QueryKey,
  InfiniteQueryObserverResult,
  InfiniteData,
  RefetchOptions,
  SetDataOptions,
  Updater,
} from '@tanstack/query-core';
import { IDisposer } from 'disposer-util';
import { LinkedAbortController } from 'linked-abort-controller';
import {
  action,
  reaction,
  makeObservable,
  observable,
  runInAction,
} from 'mobx';

import { MobxQueryInvalidateParams, MobxQueryResetParams } from './mobx-query';

export interface MobxInfiniteQueryDynamicOptions<
  TData,
  TError = DefaultError,
  TQueryKey extends QueryKey = QueryKey,
  TPageParam = unknown,
> extends Partial<
    Omit<
      InfiniteQueryObserverOptions<
        TData,
        TError,
        InfiniteData<TData>,
        InfiniteData<TData>,
        TQueryKey,
        TPageParam
      >,
      'queryFn' | 'enabled' | 'queryKeyHashFn'
    >
  > {
  enabled?: boolean;
}

export interface MobxInfiniteQueryConfig<
  TData,
  TError = DefaultError,
  TQueryKey extends QueryKey = QueryKey,
  TPageParam = unknown,
> extends Partial<
    Omit<
      InfiniteQueryObserverOptions<
        TData,
        TError,
        InfiniteData<TData>,
        InfiniteData<TData>,
        TQueryKey,
        TPageParam
      >,
      'queryKey'
    >
  > {
  queryClient: QueryClient;
  /**
   * TanStack Query manages query caching for you based on query keys.
   * Query keys have to be an Array at the top level, and can be as simple as an Array with a single string, or as complex as an array of many strings and nested objects.
   * As long as the query key is serializable, and unique to the query's data, you can use it!
   *
   * **Important:** If you define it as a function then it will be reactively updates query origin key every time
   * when observable values inside the function changes
   *
   * @link https://tanstack.com/query/v4/docs/framework/react/guides/query-keys#simple-query-keys
   */
  queryKey?: TQueryKey | (() => TQueryKey);
  onInit?: (
    query: MobxInfiniteQuery<TData, TError, TQueryKey, TPageParam>,
  ) => void;
  /**
   * @deprecated use `abortSignal` instead
   */
  disposer?: IDisposer;
  abortSignal?: AbortSignal;
  onDone?: (data: InfiniteData<TData>, payload: void) => void;
  onError?: (error: TError, payload: void) => void;
  /**
   * Dynamic query parameters, when result of this function changed query will be updated
   * (reaction -> setOptions)
   */
  options?: (
    query: NoInfer<
      MobxInfiniteQuery<
        NoInfer<TData>,
        NoInfer<TError>,
        NoInfer<TQueryKey>,
        NoInfer<TPageParam>
      >
    >,
  ) => MobxInfiniteQueryDynamicOptions<TData, TError, TQueryKey, TPageParam>;

  /**
   * Reset query when dispose is called
   */
  resetOnDispose?: boolean;

  /**
   * Enable query only if result is requested
   */
  enableOnDemand?: boolean;
}

export class MobxInfiniteQuery<
  TData,
  TError = DefaultError,
  TQueryKey extends QueryKey = any,
  TPageParam = unknown,
> {
  protected abortController: AbortController;
  private queryClient: QueryClient;

  _result: InfiniteQueryObserverResult<InfiniteData<TData>, TError>;
  options: DefaultedInfiniteQueryObserverOptions<
    TData,
    TError,
    InfiniteData<TData>,
    InfiniteData<TData>,
    TQueryKey,
    TPageParam
  >;
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

    if (disposer) {
      disposer.add(() => this.dispose());
    }

    observable.ref(this, '_result');
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

    this.options = queryClient.defaultQueryOptions({
      ...mergedOptions,
      queryKey: (mergedOptions.queryKey ?? []) as TQueryKey,
    }) as DefaultedInfiniteQueryObserverOptions<
      TData,
      TError,
      InfiniteData<TData>,
      InfiniteData<TData>,
      TQueryKey,
      TPageParam
    >;

    this.options.queryHash = this.createQueryHash(this.options.queryKey);

    // Tracking props visit should be done in MobX, by default.
    this.options.notifyOnChangeProps =
      options.notifyOnChangeProps ??
      queryClient.getDefaultOptions().queries?.notifyOnChangeProps ??
      'all';

    this.queryObserver = new InfiniteQueryObserver(queryClient, this.options);

    this.updateResult();

    const subscription = this.queryObserver.subscribe(this.updateResult);

    this.abortController.signal.addEventListener('abort', () => {
      subscription();
      this.queryObserver.destroy();
    });

    if (getDynamicOptions) {
      reaction(
        () => getDynamicOptions(this),
        (options) => {
          this.update(options);
        },
        {
          signal: this.abortController.signal,
        },
      );
    }

    if (this.isEnabledOnResultDemand) {
      reaction(
        () => this.isResultRequsted,
        (isRequested) => {
          if (isRequested) {
            this.update(
              getDynamicOptions
                ? (getDynamicOptions(this) as Partial<
                    InfiniteQueryObserverOptions<
                      TData,
                      TError,
                      InfiniteData<TData>,
                      InfiniteData<TData>,
                      TQueryKey,
                      TPageParam
                    >
                  >)
                : {},
            );
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

    if (resetOnDispose) {
      this.abortController.signal.addEventListener('abort', () => {
        this.reset();
      });
    }

    onInit?.(this);
  }

  protected createQueryHash(queryKey: any) {
    if (this.options.queryKeyHashFn) {
      return this.options.queryKeyHashFn(queryKey);
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

  fetchNextPage(options?: FetchNextPageOptions | undefined) {
    return this.queryObserver.fetchNextPage(options);
  }

  fetchPreviousPage(options?: FetchPreviousPageOptions | undefined) {
    return this.queryObserver.fetchPreviousPage(options);
  }

  update(
    options: Partial<
      InfiniteQueryObserverOptions<
        TData,
        TError,
        InfiniteData<TData>,
        InfiniteData<TData>,
        TQueryKey,
        TPageParam
      >
    >,
  ) {
    this.options = this.queryClient.defaultQueryOptions({
      ...this.options,
      ...options,
    } as any) as DefaultedInfiniteQueryObserverOptions<
      TData,
      TError,
      InfiniteData<TData>,
      InfiniteData<TData>,
      TQueryKey,
      TPageParam
    >;
    this.options.enabled =
      (!this.isEnabledOnResultDemand || this.isResultRequsted) &&
      this.options.enabled;
    this.options.queryHash = this.createQueryHash(this.options.queryKey);
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
  private updateResult() {
    const nextResult = this.queryObserver.getOptimisticResult(this.options);

    this._result = nextResult || {};
  }

  async refetch(options?: RefetchOptions) {
    return await this.queryObserver.refetch(options);
  }

  async reset(params?: MobxQueryResetParams) {
    await this.queryClient.resetQueries({
      queryKey: this.options.queryKey,
      exact: true,
      ...params,
    });
  }

  async invalidate(options?: MobxQueryInvalidateParams) {
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

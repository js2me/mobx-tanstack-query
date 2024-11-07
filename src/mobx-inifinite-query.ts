import {
  DefaultedInfiniteQueryObserverOptions,
  DefaultError,
  FetchNextPageOptions,
  FetchPreviousPageOptions,
  InfiniteQueryObserver,
  InfiniteQueryObserverOptions,
  QueryClient,
  QueryFilters,
  QueryKey,
  QueryObserverResult,
} from '@tanstack/query-core';
import { Disposer, IDisposer } from 'disposer-util';
import {
  action,
  reaction,
  makeObservable,
  observable,
  runInAction,
} from 'mobx';

export interface MobxInfiniteQueryConfig<
  TData,
  TError = DefaultError,
  TQueryKey extends QueryKey = QueryKey,
> extends Partial<
    InfiniteQueryObserverOptions<TData, TError, TData, TData, TQueryKey>
  > {
  queryClient: QueryClient;
  onInit?: (query: MobxInfiniteQuery<TData, TError, TQueryKey>) => void;
  disposer?: IDisposer;
  onDone?: (data: TData, payload: void) => void;
  onError?: (error: TError, payload: void) => void;
  /**
   * Dynamic query parameters, when result of this function changed query will be updated
   * (reaction -> setOptions)
   */
  options?: (
    query: NoInfer<
      MobxInfiniteQuery<NoInfer<TData>, NoInfer<TError>, NoInfer<TQueryKey>>
    >,
  ) => Partial<
    InfiniteQueryObserverOptions<TData, TError, TData, TData, TQueryKey>
  >;

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
> {
  private disposer: IDisposer;
  private queryClient: QueryClient;

  _result!: QueryObserverResult<TData, TError>;
  options: DefaultedInfiniteQueryObserverOptions<
    TData,
    TError,
    TData,
    TData,
    TQueryKey
  >;
  queryObserver: InfiniteQueryObserver<TData, TError, TData, TData, TQueryKey>;

  isResultRequsted: boolean;

  private isEnabledOnResultDemand: boolean;

  constructor({
    queryClient,
    onInit,
    options: getDynamicOptions,

    onDone,
    onError,
    disposer,
    resetOnDispose,
    enableOnDemand,
    ...options
  }: MobxInfiniteQueryConfig<TData, TError, TQueryKey>) {
    this.queryClient = queryClient;
    this.disposer = disposer || new Disposer();
    this.isResultRequsted = false;
    this.isEnabledOnResultDemand = enableOnDemand ?? false;

    makeObservable<this, 'updateResult'>(this, {
      _result: observable.ref,
      setData: action.bound,
      update: action.bound,
      updateResult: action.bound,
    });

    const mergedOptions = {
      ...options,
      ...getDynamicOptions?.(this),
    };

    this.options = queryClient.defaultQueryOptions({
      ...mergedOptions,
      queryKey: (mergedOptions.queryKey ?? []) as TQueryKey,
    }) as DefaultedInfiniteQueryObserverOptions<
      TData,
      TError,
      TData,
      TData,
      TQueryKey
    >;

    this.options.queryHash = this.options.queryKeyHashFn!(
      this.options.queryKey,
    );

    // Tracking props visit should be done in MobX, by default.
    this.options.notifyOnChangeProps =
      options.notifyOnChangeProps ??
      queryClient.getDefaultOptions().queries?.notifyOnChangeProps ??
      'all';

    this.queryObserver = new InfiniteQueryObserver(queryClient, this.options);

    this.updateResult();

    this.disposer.add(this.queryObserver.subscribe(this.updateResult));

    if (getDynamicOptions) {
      this.disposer.add(
        reaction(
          () => getDynamicOptions(this),
          (options) => {
            this.update(options);
          },
        ),
      );
    }

    if (this.isEnabledOnResultDemand) {
      this.disposer.add(
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
                        TData,
                        TData,
                        TQueryKey
                      >
                    >)
                  : {},
              );
            }
          },
        ),
      );
    }

    if (onDone) {
      this.onDone(onDone);
    }
    if (onError) {
      this.onError(onError);
    }

    if (resetOnDispose) {
      this.disposer.add(() => {
        this.reset();
      });
    }

    onInit?.(this);
  }

  setData(data: TData) {
    this.queryClient.setQueryData<TData>(this.options.queryKey, data);
  }

  fetchNextPage(options?: FetchNextPageOptions | undefined) {
    return this.queryObserver.fetchNextPage(options);
  }

  fetchPreviousPage(options?: FetchPreviousPageOptions | undefined) {
    return this.queryObserver.fetchPreviousPage(options);
  }

  update(
    options: Partial<
      InfiniteQueryObserverOptions<TData, TError, TData, TData, TQueryKey>
    >,
  ) {
    this.options = this.queryClient.defaultQueryOptions({
      ...this.options,
      ...options,
    } as any) as DefaultedInfiniteQueryObserverOptions<
      TData,
      TError,
      TData,
      TData,
      TQueryKey
    >;
    this.options.enabled =
      (!this.isEnabledOnResultDemand || this.isResultRequsted) &&
      this.options.enabled;
    this.options.queryHash =
      this.options.queryKeyHashFn?.(this.options.queryKey) ??
      this.options.queryHash;
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

  async reset() {
    await this.queryClient.resetQueries({
      queryKey: this.options.queryKey,
      exact: true,
    });
  }

  async invalidate(filters: Omit<QueryFilters, 'queryKey' | 'exact'> = {}) {
    await this.queryClient.invalidateQueries({
      ...filters,
      queryKey: this.options.queryKey,
      exact: true,
    });
  }

  onDone(onDoneCallback: (data: TData, payload: void) => void): void {
    this.disposer.add(
      reaction(
        () => !this._result.error && this._result.isSuccess,
        (isDone) => {
          if (isDone) {
            onDoneCallback(this._result.data!, void 0);
          }
        },
      ),
    );
  }

  onError(onErrorCallback: (error: TError, payload: void) => void): void {
    this.disposer.add(
      reaction(
        () => this._result.error,
        (error) => {
          if (error) {
            onErrorCallback(error, void 0);
          }
        },
      ),
    );
  }

  dispose() {
    this.disposer.dispose();
    this.queryObserver.destroy();
  }
}

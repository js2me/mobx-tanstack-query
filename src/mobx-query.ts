import {
  DefaultedQueryObserverOptions,
  DefaultError,
  QueryClient,
  QueryFilters,
  QueryKey,
  QueryObserver,
  QueryObserverOptions,
  QueryObserverResult,
} from '@tanstack/query-core';
import { Disposer, IDisposer } from 'disposer-util';
import {
  action,
  makeObservable,
  observable,
  reaction,
  runInAction,
} from 'mobx';

export interface MobxQueryConfig<
  TData,
  TError = DefaultError,
  TQueryKey extends QueryKey = QueryKey,
> extends Partial<
    QueryObserverOptions<TData, TError, TData, TData, TQueryKey>
  > {
  queryClient: QueryClient;
  onInit?: (query: MobxQuery<TData, TError, TQueryKey>) => void;
  disposer?: IDisposer;
  onDone?: (data: TData, payload: void) => void;
  onError?: (error: TError, payload: void) => void;
  /**
   * Dynamic query parameters, when result of this function changed query will be updated
   * (reaction -> setOptions)
   */
  options?: (
    query: NoInfer<
      MobxQuery<NoInfer<TData>, NoInfer<TError>, NoInfer<TQueryKey>>
    >,
  ) => Partial<QueryObserverOptions<TData, TError, TData, TData, TQueryKey>>;

  /**
   * Reset query when dispose is called
   */
  resetOnDispose?: boolean;

  /**
   * Enable query only if result is requested
   */
  enableOnDemand?: boolean;
}

export class MobxQuery<
  TData,
  TError = DefaultError,
  TQueryKey extends QueryKey = any,
> {
  private disposer: IDisposer;
  private queryClient: QueryClient;

  private _result!: QueryObserverResult<TData, TError>;

  options: DefaultedQueryObserverOptions<
    TData,
    TError,
    TData,
    TData,
    TQueryKey
  >;
  queryObserver: QueryObserver<TData, TError, TData, TData, TQueryKey>;

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
  }: MobxQueryConfig<TData, TError, TQueryKey>) {
    this.queryClient = queryClient;
    this.disposer = disposer || new Disposer();
    this.isResultRequsted = false;
    this.isEnabledOnResultDemand = enableOnDemand ?? false;

    makeObservable<this, 'updateResult' | '_result'>(
      this,
      {
        _result: observable.ref,
        isResultRequsted: observable.ref,
        setData: action.bound,
        update: action.bound,
        updateResult: action.bound,
      },
      {
        deep: false,
      },
    );

    const mergedOptions = {
      ...options,
      ...getDynamicOptions?.(this),
    };

    this.options = queryClient.defaultQueryOptions({
      ...mergedOptions,
      queryKey: (mergedOptions.queryKey ?? []) as TQueryKey,
    });
    this.options.queryHash = this.options.queryKeyHashFn!(
      this.options.queryKey,
    );

    // Tracking props visit should be done in MobX, by default.
    this.options.notifyOnChangeProps =
      options.notifyOnChangeProps ??
      queryClient.getDefaultOptions().queries?.notifyOnChangeProps ??
      'all';

    this.queryObserver = new QueryObserver(queryClient, this.options);

    this.updateResult();

    this.disposer.add(this.queryObserver.subscribe(this.updateResult));

    if (getDynamicOptions) {
      this.disposer.add(
        reaction(
          () =>
            getDynamicOptions(this) as Partial<
              QueryObserverOptions<TData, TError, TQueryKey>
            >,
          (dynamicOptions) => {
            this.update(dynamicOptions);
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
                      QueryObserverOptions<TData, TError, TQueryKey>
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

  update(options: Partial<QueryObserverOptions<TData, TError, TQueryKey>>) {
    this.options = this.queryClient.defaultQueryOptions({
      ...this.options,
      ...options,
    } as any);
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

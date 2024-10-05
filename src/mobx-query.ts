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
import { action, autorun, makeObservable, observable, reaction } from 'mobx';

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
   * (autorun -> setOptions)
   */
  options?: () => Partial<
    QueryObserverOptions<TData, TError, TData, TData, TQueryKey>
  >;
  resetOnDispose?: boolean;
}

export class MobxQuery<
  TData,
  TError = DefaultError,
  TQueryKey extends QueryKey = any,
> {
  private disposer: IDisposer;
  private queryClient: QueryClient;

  result!: QueryObserverResult<TData, TError>;
  options: DefaultedQueryObserverOptions<
    TData,
    TError,
    TData,
    TData,
    TQueryKey
  >;
  queryObserver: QueryObserver<TData, TError, TData, TData, TQueryKey>;

  constructor({
    queryClient,
    onInit,
    options: getDynamicOptions,
    onDone,
    onError,
    disposer,
    resetOnDispose,
    ...options
  }: MobxQueryConfig<TData, TError, TQueryKey>) {
    this.queryClient = queryClient;
    this.disposer = disposer || new Disposer();

    makeObservable<this, 'updateResult'>(this, {
      result: observable.ref,
      setData: action.bound,
      update: action.bound,
      updateResult: action.bound,
    });

    const mergedOptions = {
      ...options,
      ...getDynamicOptions?.(),
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
        autorun(() =>
          this.update(
            getDynamicOptions() as Partial<
              QueryObserverOptions<TData, TError, TQueryKey>
            >,
          ),
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
    this.options.queryHash =
      this.options.queryKeyHashFn?.(this.options.queryKey) ??
      this.options.queryHash;
    this.queryObserver.setOptions(this.options);
  }

  /**
   * Modify this result so it matches the tanstack query result.
   */
  private updateResult() {
    const nextResult = this.queryObserver.getOptimisticResult(this.options);
    this.result = nextResult || {};
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
        () => !this.result.error && this.result.isSuccess,
        (isDone) => {
          if (isDone) {
            onDoneCallback(this.result.data!, void 0);
          }
        },
      ),
    );
  }

  onError(onErrorCallback: (error: TError, payload: void) => void): void {
    this.disposer.add(
      reaction(
        () => this.result.error,
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

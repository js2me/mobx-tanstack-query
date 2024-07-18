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
import { action, autorun, makeObservable, observable, reaction } from 'mobx';
import { Disposer } from 'mobx-disposer-util';

interface MobxQueryConfig<
  TData,
  TError = DefaultError,
  TQueryKey extends QueryKey = QueryKey,
> extends Partial<
    QueryObserverOptions<TData, TError, TData, TData, TQueryKey>
  > {
  queryClient: QueryClient;
  onInit?: (query: MobxQuery<TData, TError, TQueryKey>) => void;
  disposer?: Disposer;
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
  private disposer: Disposer;
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
    options: dynamicOptions,
    onDone,
    onError,
    disposer,
    resetOnDispose,
    ...options
  }: MobxQueryConfig<TData, TError, TQueryKey>) {
    this.queryClient = queryClient;
    this.disposer = disposer || new Disposer();

    const mergedOptions = {
      ...options,
      ...dynamicOptions?.(),
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

    makeObservable(this, {
      result: observable.ref,
    });

    if (dynamicOptions) {
      this.disposer.add(
        autorun(() =>
          this.update(
            dynamicOptions() as Partial<
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

  @action.bound
  setData(data: TData) {
    this.queryClient.setQueryData<TData>(this.options.queryKey, data);
  }

  @action.bound
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
  @action.bound
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

  dispose() {
    this.disposer.dispose();
    this.queryObserver.destroy();
  }

  async invalidate(filters: Omit<QueryFilters, 'queryKey' | 'exact'> = {}) {
    await this.queryClient.invalidateQueries({
      ...filters,
      queryKey: this.options.queryKey,
      exact: true,
    });
  }

  onDone(doneFn: (data: TData, payload: void) => void): void {
    this.disposer.add(
      reaction(
        () => !this.result.error && this.result.isSuccess,
        (isDone) => {
          if (isDone) {
            doneFn(this.result.data!, void 0);
          }
        },
      ),
    );
  }

  onError(errorFn: (error: TError, payload: void) => void): void {
    this.disposer.add(
      reaction(
        () => this.result.error,
        (error) => {
          if (error) {
            errorFn(error, void 0);
          }
        },
      ),
    );
  }
}

import {
  DefaultedQueryObserverOptions,
  DefaultError,
  hashKey,
  InvalidateQueryFilters,
  QueryClient,
  QueryKey,
  QueryObserver,
  QueryObserverOptions,
  QueryObserverResult,
  RefetchOptions,
} from '@tanstack/query-core';
import { IDisposer } from 'disposer-util';
import { LinkedAbortController } from 'linked-abort-controller';
import {
  action,
  makeObservable,
  observable,
  reaction,
  runInAction,
} from 'mobx';

export interface MobxQueryInvalidateParams
  extends Partial<Omit<InvalidateQueryFilters, 'queryKey' | 'exact'>> {}

export interface MobxQueryConfig<
  TData,
  TError = DefaultError,
  TQueryKey extends QueryKey = QueryKey,
> extends Partial<
    QueryObserverOptions<TData, TError, TData, TData, TQueryKey>
  > {
  queryClient: QueryClient;
  onInit?: (query: MobxQuery<TData, TError, TQueryKey>) => void;
  /**
   * @deprecated use `abortSignal` instead
   */
  disposer?: IDisposer;
  abortSignal?: AbortSignal;
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
  protected abortController: AbortController;
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
    // eslint-disable-next-line sonarjs/deprecation
    disposer,
    abortSignal: outerAbortSignal,
    resetOnDispose,
    enableOnDemand,
    ...options
  }: MobxQueryConfig<TData, TError, TQueryKey>) {
    this.abortController = new LinkedAbortController(outerAbortSignal);
    this.queryClient = queryClient;
    this.isResultRequsted = false;
    this.isEnabledOnResultDemand = enableOnDemand ?? false;

    if (disposer) {
      disposer.add(() => this.dispose());
    }

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

    this.options.queryHash = this.createQueryHash(this.options.queryKey);

    // Tracking props visit should be done in MobX, by default.
    this.options.notifyOnChangeProps =
      options.notifyOnChangeProps ??
      queryClient.getDefaultOptions().queries?.notifyOnChangeProps ??
      'all';

    this.queryObserver = new QueryObserver(queryClient, this.options);

    this.updateResult();

    const subscription = this.queryObserver.subscribe(this.updateResult);

    this.abortController.signal.addEventListener('abort', () => {
      subscription();
      this.queryObserver.destroy();
    });

    if (getDynamicOptions) {
      reaction(
        () =>
          getDynamicOptions(this) as Partial<
            QueryObserverOptions<TData, TError, TQueryKey>
          >,
        (dynamicOptions) => {
          this.update(dynamicOptions);
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
                    QueryObserverOptions<TData, TError, TQueryKey>
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

  async refetch(options?: RefetchOptions) {
    return await this.queryObserver.refetch(options);
  }

  protected createQueryHash(queryKey: any) {
    if (this.options.queryKeyHashFn) {
      return this.options.queryKeyHashFn(queryKey);
    }

    return hashKey(queryKey);
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

  async reset() {
    await this.queryClient.resetQueries({
      queryKey: this.options.queryKey,
      exact: true,
    });
  }

  invalidate(params?: MobxQueryInvalidateParams) {
    this.queryClient.invalidateQueries({
      exact: true,
      queryKey: this.options.queryKey,
      ...params,
    });
  }

  onDone(onDoneCallback: (data: TData, payload: void) => void): void {
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

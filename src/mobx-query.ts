import {
  DefaultedQueryObserverOptions,
  DefaultError,
  hashKey,
  InvalidateQueryFilters,
  QueryClient,
  QueryFilters,
  QueryKey,
  QueryObserver,
  QueryObserverOptions,
  QueryObserverResult,
  RefetchOptions,
  SetDataOptions,
  Updater,
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

export interface MobxQueryResetParams
  extends Partial<Omit<QueryFilters, 'queryKey' | 'exact'>> {}

export interface MobxQueryDynamicOptions<
  TData,
  TError = DefaultError,
  TQueryKey extends QueryKey = QueryKey,
> extends Partial<
    Omit<
      QueryObserverOptions<TData, TError, TData, TData, TQueryKey>,
      'queryFn' | 'enabled' | 'queryKeyHashFn'
    >
  > {
  enabled?: boolean;
}

export interface MobxQueryOptions<
  TData,
  TError = DefaultError,
  TQueryKey extends QueryKey = QueryKey,
> extends DefaultedQueryObserverOptions<
    TData,
    TError,
    TData,
    TData,
    TQueryKey
  > {}

export interface MobxQueryConfig<
  TData,
  TError = DefaultError,
  TQueryKey extends QueryKey = QueryKey,
> extends Partial<
    Omit<
      QueryObserverOptions<TData, TError, TData, TData, TQueryKey>,
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
  ) => MobxQueryDynamicOptions<TData, TError, TQueryKey>;

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

  private _result: QueryObserverResult<TData, TError>;

  options: MobxQueryOptions<TData, TError, TQueryKey>;
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
    queryKey: queryKeyOrDynamicQueryKey,
    ...options
  }: MobxQueryConfig<TData, TError, TQueryKey>) {
    this.abortController = new LinkedAbortController(outerAbortSignal);
    this.queryClient = queryClient;
    this._result = undefined as any;
    this.isResultRequsted = false;
    this.isEnabledOnResultDemand = enableOnDemand ?? false;

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

    this.updateResult(this.queryObserver.getOptimisticResult(this.options));

    const subscription = this.queryObserver.subscribe(this.updateResult);

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

    this.abortController.signal.addEventListener('abort', () => {
      subscription();
      this.queryObserver.destroy();

      if (resetOnDispose) {
        this.reset();
      }
    });

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
  private updateResult(result: QueryObserverResult<TData, TError>) {
    this._result = result;
  }

  async reset(params?: MobxQueryResetParams) {
    return await this.queryClient.resetQueries({
      queryKey: this.options.queryKey,
      exact: true,
      ...params,
    });
  }

  async invalidate(params?: MobxQueryInvalidateParams) {
    return await this.queryClient.invalidateQueries({
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

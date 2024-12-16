import {
  DefaultError,
  hashKey,
  QueryClient,
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

import {
  MobxQueryConfig,
  MobxQueryDynamicOptions,
  MobxQueryInvalidateParams,
  MobxQueryOptions,
  MobxQueryResetParams,
  MobxQueryUpdateOptions,
} from './mobx-query.types';

export class MobxQuery<
  TData,
  TError = DefaultError,
  TQueryKey extends QueryKey = any,
> {
  protected abortController: AbortController;
  private queryClient: QueryClient;

  protected _result: QueryObserverResult<TData, TError>;

  options: MobxQueryOptions<TData, TError, TQueryKey>;
  queryObserver: QueryObserver<TData, TError, TData, TData, TQueryKey>;

  isResultRequsted: boolean;

  private isEnabledOnResultDemand: boolean;

  private _originEnabled: MobxQueryOptions<TData, TError, TQueryKey>['enabled'];

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

    this.options = this.createOptions({
      ...mergedOptions,
      queryKey: (mergedOptions.queryKey ?? []) as TQueryKey,
    });

    // Tracking props visit should be done in MobX, by default.
    this.options.notifyOnChangeProps =
      options.notifyOnChangeProps ??
      queryClient.getDefaultOptions().queries?.notifyOnChangeProps ??
      'all';

    this.queryObserver = new QueryObserver(queryClient, this.options);

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
      this.queryObserver.destroy();
      this.isResultRequsted = false;

      if (resetOnDispose) {
        this.reset();
      }
    });

    onInit?.(this);
  }

  async refetch(options?: RefetchOptions) {
    return await this.queryObserver.refetch(options);
  }

  protected createQueryHash(
    queryKey: any,
    options: MobxQueryOptions<TData, TError, TQueryKey>,
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
    return this.queryClient.setQueryData<TData>(
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

  private createOptions(
    optionsUpdate:
      | Partial<MobxQueryOptions<TData, TError, TQueryKey>>
      | MobxQueryUpdateOptions<TData, TError, TQueryKey>
      | MobxQueryDynamicOptions<TData, TError, TQueryKey>,
  ) {
    const options = this.queryClient.defaultQueryOptions({
      ...this.options,
      ...optionsUpdate,
    } as any) as MobxQueryOptions<TData, TError, TQueryKey>;
    if ('enabled' in optionsUpdate) {
      this._originEnabled = options.enabled;
    }
    options.enabled = this.checkIsEnabled();
    options.queryHash = this.createQueryHash(options.queryKey, options);

    return options;
  }

  update(
    options:
      | MobxQueryUpdateOptions<TData, TError, TQueryKey>
      | MobxQueryDynamicOptions<TData, TError, TQueryKey>,
  ) {
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

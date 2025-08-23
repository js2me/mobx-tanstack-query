import {
  DefaultError,
  MutationObserver,
  MutationObserverOptions,
  MutationObserverResult,
  MutationOptions,
} from '@tanstack/query-core';
import { LinkedAbortController } from 'linked-abort-controller';
import {
  action,
  makeObservable,
  observable,
  onBecomeObserved,
  onBecomeUnobserved,
} from 'mobx';

import {
  MutationConfig,
  MutationDoneListener,
  MutationErrorListener,
  MutationFeatures,
  MutationInvalidateQueriesOptions,
  MutationSettledListener,
} from './mutation.types';
import { AnyQueryClient, QueryClientHooks } from './query-client.types';

export class Mutation<
  TData = unknown,
  TVariables = void,
  TError = DefaultError,
  TContext = unknown,
> implements Disposable
{
  protected abortController: LinkedAbortController;
  protected queryClient: AnyQueryClient;

  mutationOptions: MutationObserverOptions<TData, TError, TVariables, TContext>;
  mutationObserver: MutationObserver<TData, TError, TVariables, TContext>;

  result: MutationObserverResult<TData, TError, TVariables, TContext>;

  private isLazy?: boolean;
  private isResetOnDestroy?: MutationFeatures['resetOnDestroy'];

  private settledListeners: MutationSettledListener<
    TData,
    TError,
    TVariables,
    TContext
  >[];
  private errorListeners: MutationErrorListener<TError, TVariables, TContext>[];
  private doneListeners: MutationDoneListener<TData, TVariables, TContext>[];

  private _observerSubscription?: VoidFunction;
  private hooks?: QueryClientHooks;

  constructor(
    protected config: MutationConfig<TData, TVariables, TError, TContext>,
  ) {
    const {
      queryClient,
      invalidateQueries,
      invalidateByKey: providedInvalidateByKey,
      mutationFn,
      ...restOptions
    } = config;
    this.abortController = new LinkedAbortController(config.abortSignal);
    this.queryClient = queryClient;
    this.result = undefined as any;
    this.isLazy = this.config.lazy;
    this.settledListeners = [];
    this.errorListeners = [];
    this.doneListeners = [];
    this.isResetOnDestroy =
      this.config.resetOnDestroy ?? this.config.resetOnDispose;

    observable.deep(this, 'result');
    action.bound(this, 'updateResult');

    makeObservable(this);

    let invalidateByKey: MutationFeatures['invalidateByKey'] =
      providedInvalidateByKey;

    if ('mutationFeatures' in queryClient) {
      if (providedInvalidateByKey === undefined) {
        invalidateByKey = queryClient.mutationFeatures.invalidateByKey;
      }
      if (this.config.lazy === undefined) {
        this.isLazy = queryClient.mutationFeatures.lazy;
      }
      if (this.isResetOnDestroy === undefined) {
        this.isResetOnDestroy =
          queryClient.mutationFeatures.resetOnDestroy ??
          queryClient.mutationFeatures.resetOnDispose;
      }

      this.hooks = queryClient.hooks;
    }

    this.mutationOptions = this.queryClient.defaultMutationOptions(restOptions);

    this.mutationObserver = new MutationObserver<
      TData,
      TError,
      TVariables,
      TContext
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-expect-error
    >(queryClient, {
      ...this.mutationOptions,
      mutationFn: (variables) =>
        mutationFn?.(variables, { signal: this.abortController.signal }),
    });

    this.updateResult(this.mutationObserver.getCurrentResult());

    if (this.isLazy) {
      onBecomeObserved(this, 'result', () => {
        if (!this._observerSubscription) {
          this.updateResult(this.mutationObserver.getCurrentResult());
          this._observerSubscription = this.mutationObserver.subscribe(
            this.updateResult,
          );
        }
      });
      onBecomeUnobserved(this, 'result', () => {
        if (this._observerSubscription) {
          this._observerSubscription?.();
          this._observerSubscription = undefined;
        }
      });
    } else {
      this._observerSubscription = this.mutationObserver.subscribe(
        this.updateResult,
      );

      this.abortController.signal.addEventListener('abort', this.handleAbort);
    }

    if (invalidateQueries) {
      this.onDone((data, payload) => {
        let invalidateOptions:
          | MutationInvalidateQueriesOptions
          | null
          | undefined;

        if (typeof invalidateQueries === 'function') {
          invalidateOptions = invalidateQueries(data, payload);
        } else {
          invalidateOptions = invalidateQueries;
        }

        if (!invalidateOptions) {
          return;
        }

        if (invalidateOptions.allQueryKeys) {
          this.queryClient.invalidateQueries({
            ...invalidateOptions,
          });
        } else if (invalidateOptions.queryKeys?.length) {
          invalidateOptions.queryKeys?.forEach((queryKey) => {
            this.queryClient.invalidateQueries({
              ...invalidateOptions,
              queryKey,
            });
          });
        } else {
          this.queryClient.invalidateQueries(invalidateOptions);
        }
      });
    }

    if (invalidateByKey && this.mutationOptions.mutationKey) {
      this.onDone(() => {
        this.queryClient.invalidateQueries({
          ...(invalidateByKey === true ? {} : invalidateByKey),
          queryKey: this.mutationOptions.mutationKey,
        });
      });
    }

    config.onInit?.(this);
    this.hooks?.onMutationInit?.(this);
  }

  async mutate(
    variables: TVariables,
    options?: MutationOptions<TData, TError, TVariables, TContext>,
  ) {
    if (this.isLazy) {
      let error: any;

      try {
        await this.mutationObserver.mutate(variables, options);
      } catch (error_) {
        error = error_;
      }

      const result = this.mutationObserver.getCurrentResult();
      this.updateResult(result);

      if (error && this.mutationOptions.throwOnError) {
        throw error;
      }
    } else {
      await this.mutationObserver.mutate(variables, options);
    }

    return this.result;
  }

  async start(
    variables: TVariables,
    options?: MutationOptions<TData, TError, TVariables, TContext>,
  ) {
    return await this.mutate(variables, options);
  }

  /**
   * Modify this result so it matches the tanstack query result.
   */
  private updateResult(
    result: MutationObserverResult<TData, TError, TVariables, TContext>,
  ) {
    this.result = result || {};

    if (result.isSuccess && !result.error) {
      this.doneListeners.forEach((fn) =>
        fn(result.data!, result.variables!, result.context),
      );
    } else if (result.error) {
      this.errorListeners.forEach((fn) =>
        fn(result.error!, result.variables!, result.context),
      );
    }

    if (!result.isPending && (result.isError || result.isSuccess)) {
      this.settledListeners.forEach((fn) =>
        fn(result.data!, result.error, result.variables!, result.context),
      );
    }
  }

  onSettled(
    listener: MutationSettledListener<TData, TError, TVariables, TContext>,
  ): void {
    this.settledListeners.push(listener);
  }

  onDone(listener: MutationDoneListener<TData, TVariables, TContext>): void {
    this.doneListeners.push(listener);
  }

  onError(listener: MutationErrorListener<TError, TVariables, TContext>): void {
    this.errorListeners.push(listener);
  }

  reset() {
    this.mutationObserver.reset();
  }

  protected handleAbort = () => {
    this._observerSubscription?.();

    this.doneListeners = [];
    this.errorListeners = [];
    this.settledListeners = [];

    if (this.isResetOnDestroy) {
      this.reset();
    }

    delete this._observerSubscription;
    this.hooks?.onMutationDestroy?.(this);
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
 * @deprecated ⚠️ use `Mutation`. This export will be removed in next major release
 */
export class MobxMutation<
  TData = unknown,
  TVariables = void,
  TError = DefaultError,
  TContext = unknown,
> extends Mutation<TData, TVariables, TError, TContext> {}

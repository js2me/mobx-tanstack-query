import {
  DefaultError,
  MutationObserver,
  MutationObserverOptions,
  MutationObserverResult,
  MutationOptions,
  QueryClient,
} from '@tanstack/query-core';
import { LinkedAbortController } from 'linked-abort-controller';
import { action, makeObservable, observable, reaction } from 'mobx';

import { MobxMutationConfig } from './mobx-mutation.types';
import { MobxQueryClient } from './mobx-query-client';

export class MobxMutation<
  TData = unknown,
  TVariables = void,
  TError = DefaultError,
  TContext = unknown,
> {
  protected abortController: AbortController;
  protected queryClient: QueryClient | MobxQueryClient;

  mutationOptions: MutationObserverOptions<TData, TError, TVariables, TContext>;
  mutationObserver: MutationObserver<TData, TError, TVariables, TContext>;

  result: MutationObserverResult<TData, TError, TVariables, TContext>;

  private _observerSubscription?: VoidFunction;

  constructor(
    protected config: MobxMutationConfig<TData, TVariables, TError, TContext>,
  ) {
    const { queryClient, ...restOptions } = config;
    this.abortController = new LinkedAbortController(config.abortSignal);
    this.queryClient = queryClient;
    this.result = undefined as any;

    if (config.disposer) {
      config.disposer.add(() => this.dispose());
    }

    observable.deep(this, 'result');
    action.bound(this, 'updateResult');

    makeObservable(this);

    this.mutationOptions = this.queryClient.defaultMutationOptions(restOptions);

    this.mutationObserver = new MutationObserver<
      TData,
      TError,
      TVariables,
      TContext
    >(queryClient, this.mutationOptions);

    this.updateResult(this.mutationObserver.getCurrentResult());

    this._observerSubscription = this.mutationObserver.subscribe(
      this.updateResult,
    );

    this.abortController.signal.addEventListener('abort', () => {
      this._observerSubscription?.();

      if (
        config.resetOnDispose ||
        (queryClient instanceof MobxQueryClient &&
          queryClient.mutationFeatures.resetOnDispose)
      ) {
        this.reset();
      }
    });

    config.onInit?.(this);
  }

  async mutate(
    variables: TVariables,
    options?: MutationOptions<TData, TError, TVariables, TContext>,
  ) {
    await this.mutationObserver.mutate(variables, options);
    return this.result;
  }

  /**
   * Modify this result so it matches the tanstack query result.
   */
  private updateResult(
    nextResult: MutationObserverResult<TData, TError, TVariables, TContext>,
  ) {
    this.result = nextResult || {};
  }

  onDone(onDoneCallback: (data: TData, payload: TVariables) => void): void {
    reaction(
      () => !this.result.error && this.result.isSuccess,
      (isDone) => {
        if (isDone) {
          onDoneCallback(this.result.data!, this.result.variables!);
        }
      },
      {
        signal: this.abortController.signal,
      },
    );
  }

  onError(onErrorCallback: (error: TError, payload: TVariables) => void): void {
    reaction(
      () => this.result.error,
      (error) => {
        if (error) {
          onErrorCallback(error, this.result.variables!);
        }
      },
      {
        signal: this.abortController.signal,
      },
    );
  }

  reset() {
    this.mutationObserver.reset();
  }

  protected handleAbort = () => {
    this._observerSubscription?.();

    let isNeedToReset =
      this.config.resetOnDestroy || this.config.resetOnDispose;

    if (this.queryClient instanceof MobxQueryClient && !isNeedToReset) {
      isNeedToReset =
        this.queryClient.mutationFeatures.resetOnDestroy ||
        this.queryClient.mutationFeatures.resetOnDispose;
    }

    if (isNeedToReset) {
      this.reset();
    }

    delete this._observerSubscription;
  };

  dispose() {
    this.abortController.abort();
  }
}

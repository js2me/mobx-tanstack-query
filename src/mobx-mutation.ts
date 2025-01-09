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

  constructor({
    queryClient,
    onInit,
    // eslint-disable-next-line sonarjs/deprecation
    disposer,
    abortSignal: outerAbortSignal,
    resetOnDispose,
    ...options
  }: MobxMutationConfig<TData, TVariables, TError, TContext>) {
    this.abortController = new LinkedAbortController(outerAbortSignal);
    this.queryClient = queryClient;
    this.result = undefined as any;

    if (this.queryClient && disposer) {
      disposer.add(() => this.dispose());
    }

    observable.deep(this, 'result');
    action.bound(this, 'updateResult');

    makeObservable(this);

    this.mutationOptions = this.queryClient.defaultMutationOptions(options);

    this.mutationObserver = new MutationObserver<
      TData,
      TError,
      TVariables,
      TContext
    >(queryClient, this.mutationOptions);

    this.updateResult(this.mutationObserver.getCurrentResult());

    const subscription = this.mutationObserver.subscribe(this.updateResult);

    this.abortController.signal.addEventListener('abort', () => {
      subscription();

      if (
        resetOnDispose ||
        (queryClient instanceof MobxQueryClient &&
          queryClient.mutationFeatures.resetOnDispose)
      ) {
        this.reset();
      }
    });

    onInit?.(this);
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

  dispose() {
    this.abortController.abort();
  }
}

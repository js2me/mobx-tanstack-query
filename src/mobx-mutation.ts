import {
  DefaultError,
  MutationObserver,
  MutationObserverOptions,
  MutationObserverResult,
  MutationOptions,
  QueryClient,
} from '@tanstack/query-core';
import { IDisposer } from 'disposer-util';
import { action, makeObservable, observable, reaction } from 'mobx';

export interface MobxMutationConfig<
  TData = unknown,
  TVariables = void,
  TError = DefaultError,
  TContext = unknown,
> extends Omit<
    MutationObserverOptions<TData, TError, TVariables, TContext>,
    '_defaulted'
  > {
  queryClient: QueryClient;
  disposer?: IDisposer;
  abortController?: AbortController;
  resetOnDispose?: boolean;
  onInit?: (
    mutation: MobxMutation<TData, TVariables, TError, TContext>,
  ) => void;
}

export class MobxMutation<
  TData = unknown,
  TVariables = void,
  TError = DefaultError,
  TContext = unknown,
> {
  private abortController: AbortController;
  private queryClient: QueryClient;

  mutationOptions: MutationObserverOptions<TData, TError, TVariables, TContext>;
  mutationObserver: MutationObserver<TData, TError, TVariables, TContext>;

  result!: MutationObserverResult<TData, TError, TVariables, TContext>;

  constructor({
    queryClient,
    onInit,
    disposer,
    abortController: outerAbortController,
    resetOnDispose,
    ...options
  }: MobxMutationConfig<TData, TVariables, TError, TContext>) {
    this.abortController = new AbortController();
    this.queryClient = queryClient;

    if (disposer) {
      disposer.add(() => this.dispose());
    }

    if (outerAbortController) {
      outerAbortController?.signal.addEventListener('abort', () =>
        this.dispose(),
      );
    }

    makeObservable<this, 'updateResult'>(
      this,
      {
        result: observable.ref,
        updateResult: action.bound,
      },
      { deep: false },
    );

    this.mutationOptions = this.queryClient.defaultMutationOptions(options);

    this.mutationObserver = new MutationObserver<
      TData,
      TError,
      TVariables,
      TContext
    >(queryClient, this.mutationOptions);

    this.updateResult();

    const subscription = this.mutationObserver.subscribe(this.updateResult);

    this.abortController.signal.addEventListener('abort', subscription);

    if (resetOnDispose) {
      this.abortController.signal.addEventListener('abort', () => {
        this.reset();
      });
    }

    onInit?.(this);
  }

  async mutate(
    variables: TVariables,
    options?: MutationOptions<TData, TError, TVariables, TContext>,
  ) {
    await this.mutationObserver.mutate(variables, options);

    return this.result;
  }

  reset() {
    this.mutationObserver.reset();
  }

  /**
   * Modify this result so it matches the tanstack query result.
   */
  private updateResult() {
    const nextResult = this.mutationObserver.getCurrentResult();
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

  dispose() {
    this.abortController.abort();
  }
}

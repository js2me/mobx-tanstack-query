import {
  DefaultError,
  MutationObserver,
  MutationObserverOptions,
  MutationObserverResult,
  MutationOptions,
  QueryClient,
} from '@tanstack/query-core';
import { Disposer, IDisposer } from 'disposer-util';
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
  private disposer: IDisposer;
  private queryClient: QueryClient;

  mutationOptions: MutationObserverOptions<TData, TError, TVariables, TContext>;
  mutationObserver: MutationObserver<TData, TError, TVariables, TContext>;

  result!: MutationObserverResult<TData, TError, TVariables, TContext>;

  constructor({
    queryClient,
    onInit,
    disposer,
    resetOnDispose,
    ...options
  }: MobxMutationConfig<TData, TVariables, TError, TContext>) {
    this.queryClient = queryClient;
    this.disposer = disposer || new Disposer();

    this.mutationOptions = this.queryClient.defaultMutationOptions(options);

    this.mutationObserver = new MutationObserver<
      TData,
      TError,
      TVariables,
      TContext
    >(queryClient, this.mutationOptions);

    this.updateResult();

    this.disposer.add(this.mutationObserver.subscribe(this.updateResult));

    makeObservable<this, 'updateResult'>(
      this,
      {
        result: observable.ref,
        updateResult: action.bound,
      },
      { deep: false },
    );

    if (resetOnDispose) {
      this.disposer.add(() => {
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
    this.disposer.add(
      reaction(
        () => !this.result.error && this.result.isSuccess,
        (isDone) => {
          if (isDone) {
            onDoneCallback(this.result.data!, this.result.variables!);
          }
        },
      ),
    );
  }

  onError(onErrorCallback: (error: TError, payload: TVariables) => void): void {
    this.disposer.add(
      reaction(
        () => this.result.error,
        (error) => {
          if (error) {
            onErrorCallback(error, this.result.variables!);
          }
        },
      ),
    );
  }

  dispose() {
    this.disposer.dispose();
  }
}

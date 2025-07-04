import {
  DefaultError,
  MutationObserver,
  MutationObserverOptions,
  MutationObserverResult,
  MutationOptions,
} from '@tanstack/query-core';
import { LinkedAbortController } from 'linked-abort-controller';
import { action, makeObservable, observable, reaction } from 'mobx';

import {
  MutationConfig,
  MutationInvalidateQueriesOptions,
} from './mutation.types';
import { AnyQueryClient, QueryClientHooks } from './query-client.types';

export class Mutation<
  TData = unknown,
  TVariables = void,
  TError = DefaultError,
  TContext = unknown,
> implements Disposable
{
  protected abortController: AbortController;
  protected queryClient: AnyQueryClient;

  mutationOptions: MutationObserverOptions<TData, TError, TVariables, TContext>;
  mutationObserver: MutationObserver<TData, TError, TVariables, TContext>;

  result: MutationObserverResult<TData, TError, TVariables, TContext>;

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

    observable.deep(this, 'result');
    action.bound(this, 'updateResult');

    makeObservable(this);

    const invalidateByKey =
      providedInvalidateByKey ??
      ('mutationFeatures' in queryClient
        ? queryClient.mutationFeatures.invalidateByKey
        : null);

    this.mutationOptions = this.queryClient.defaultMutationOptions(restOptions);
    this.hooks =
      'hooks' in this.queryClient ? this.queryClient.hooks : undefined;

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

    this._observerSubscription = this.mutationObserver.subscribe(
      this.updateResult,
    );

    this.abortController.signal.addEventListener('abort', () => {
      this._observerSubscription?.();

      if (
        config.resetOnDispose ||
        ('mutationFeatures' in queryClient &&
          queryClient.mutationFeatures.resetOnDispose)
      ) {
        this.reset();
      }
    });

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
    await this.mutationObserver.mutate(variables, options);
    return this.result;
  }

  async start(
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

  onSettled(
    onSettledCallback: (
      data: TData | undefined,
      error: TError | null,
      variables: TVariables,
      context: TContext | undefined,
    ) => void,
  ): void {
    reaction(
      () => {
        const { isSuccess, isError, isPending } = this.result;
        return !isPending && (isSuccess || isError);
      },
      (isSettled) => {
        if (isSettled) {
          onSettledCallback(
            this.result.data,
            this.result.error,
            this.result.variables!,
            this.result.context,
          );
        }
      },
      {
        signal: this.abortController.signal,
      },
    );
  }

  onDone(
    onDoneCallback: (
      data: TData,
      payload: TVariables,
      context: TContext | undefined,
    ) => void,
  ): void {
    reaction(
      () => {
        const { error, isSuccess } = this.result;
        return isSuccess && !error;
      },
      (isDone) => {
        if (isDone) {
          onDoneCallback(
            this.result.data!,
            this.result.variables!,
            this.result.context,
          );
        }
      },
      {
        signal: this.abortController.signal,
      },
    );
  }

  onError(
    onErrorCallback: (
      error: TError,
      payload: TVariables,
      context: TContext | undefined,
    ) => void,
  ): void {
    reaction(
      () => this.result.error,
      (error) => {
        if (error) {
          onErrorCallback(error, this.result.variables!, this.result.context);
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

    if ('mutationFeatures' in this.queryClient && !isNeedToReset) {
      isNeedToReset =
        this.queryClient.mutationFeatures.resetOnDestroy ||
        this.queryClient.mutationFeatures.resetOnDispose;
    }

    if (isNeedToReset) {
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

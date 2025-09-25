import {
  DefaultError,
  MutationObserver,
  MutationObserverOptions,
  MutationObserverResult,
  MutationObserverBaseResult,
  MutationStatus,
  MutateOptions,
} from '@tanstack/query-core';
import { action, makeObservable, observable } from 'mobx';
import { lazyObserve } from 'yummies/mobx';

import {
  MutationConfig,
  MutationDoneListener,
  MutationErrorListener,
  MutationFeatures,
  MutationFunctionContext,
  MutationInvalidateQueriesOptions,
  MutationSettledListener,
} from './mutation.types';
import { QueryClient } from './query-client';
import { AnyQueryClient, QueryClientHooks } from './query-client.types';
import { Destroyable } from './utils/destroyable';

const originalMutationProperties = [
  'data',
  'variables',
  'error',
  'isError',
  'isIdle',
  'isPending',
  'isSuccess',
  'status',
  'context',
  'failureCount',
  'failureReason',
  'isPaused',
  'submittedAt',
] as const satisfies (keyof MutationObserverBaseResult)[];

export class Mutation<
    TData = unknown,
    TVariables = void,
    TError = DefaultError,
    TOnMutateResult = unknown,
  >
  extends Destroyable
  implements
    Disposable,
    Pick<
      MutationObserverBaseResult<TData, TError, TVariables, TOnMutateResult>,
      (typeof originalMutationProperties)[number]
    >
{
  protected queryClient: AnyQueryClient;

  mutationOptions: MutationObserverOptions<
    TData,
    TError,
    TVariables,
    TOnMutateResult
  >;
  mutationObserver: MutationObserver<
    TData,
    TError,
    TVariables,
    TOnMutateResult
  >;

  result: MutationObserverResult<TData, TError, TVariables, TOnMutateResult>;

  protected features: MutationFeatures;

  protected settledListeners: MutationSettledListener<
    TData,
    TError,
    TVariables,
    TOnMutateResult
  >[];
  protected errorListeners: MutationErrorListener<
    TError,
    TVariables,
    TOnMutateResult
  >[];
  protected doneListeners: MutationDoneListener<
    TData,
    TVariables,
    TOnMutateResult
  >[];

  private _observerSubscription?: VoidFunction;
  private hooks?: QueryClientHooks;

  /**
   * The last successfully resolved data for the mutation.
   */
  data!: TData | undefined;
  /**
   * The variables object passed to the `mutationFn`.
   */
  variables!: TVariables | undefined;
  /**
   * The error object for the mutation, if an error was encountered.
   * - Defaults to `null`.
   */
  error!: TError | null;
  /**
   * A boolean variable derived from `status`.
   * - `true` if the last mutation attempt resulted in an error.
   */
  isError!: boolean;
  /**
   * A boolean variable derived from `status`.
   * - `true` if the mutation is in its initial state prior to executing.
   */
  isIdle!: boolean;
  /**
   * A boolean variable derived from `status`.
   * - `true` if the mutation is currently executing.
   */
  isPending!: boolean;
  /**
   * A boolean variable derived from `status`.
   * - `true` if the last mutation attempt was successful.
   */
  isSuccess!: boolean;
  /**
   * The status of the mutation.
   * - Will be:
   *   - `idle` initial status prior to the mutation function executing.
   *   - `pending` if the mutation is currently executing.
   *   - `error` if the last mutation attempt resulted in an error.
   *   - `success` if the last mutation attempt was successful.
   */
  status!: MutationStatus;

  context!: TOnMutateResult | undefined;
  failureCount!: number;
  failureReason!: TError | null;
  isPaused!: boolean;
  submittedAt!: number;

  constructor(
    protected config: MutationConfig<
      TData,
      TVariables,
      TError,
      TOnMutateResult
    >,
  ) {
    super(config.abortSignal);

    const { queryClient, invalidateQueries, mutationFn, ...restOptions } =
      config;

    // simple type override to make typescript happy
    // and do less for javascript
    const qc = queryClient as unknown as Partial<
      Pick<QueryClient, 'mutationFeatures' | 'hooks'>
    >;

    this.queryClient = queryClient;
    this.result = undefined as any;

    this.features = {
      invalidateByKey:
        config.invalidateByKey ?? qc.mutationFeatures?.invalidateByKey,
      lazy: config.lazy ?? qc.mutationFeatures?.lazy,
      resetOnDestroy:
        config.resetOnDestroy ??
        config.resetOnDispose ??
        qc.mutationFeatures?.resetOnDestroy ??
        qc.mutationFeatures?.resetOnDispose,
      transformError:
        config.transformError ?? qc.mutationFeatures?.transformError,
    };

    this.hooks = qc.hooks;

    this.settledListeners = [];
    this.errorListeners = [];
    this.doneListeners = [];

    observable.deep(this, 'result');
    action.bound(this, 'updateResult');
    this.mutate = this.mutate.bind(this);
    this.start = this.start.bind(this);

    originalMutationProperties.forEach((property) => {
      Object.defineProperty(this, property, {
        get: () => this.result[property],
      });
    });

    makeObservable(this);

    this.mutationOptions = this.queryClient.defaultMutationOptions(restOptions);

    this.mutationObserver = new MutationObserver<
      TData,
      TError,
      TVariables,
      TOnMutateResult
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-expect-error
    >(queryClient, {
      ...this.mutationOptions,
      mutationFn: (variables, context) =>
        mutationFn?.(variables, {
          ...context,
          signal: this.abortController.signal,
        } satisfies MutationFunctionContext),
    });

    this.updateResult(this.mutationObserver.getCurrentResult());

    if (this.features.lazy) {
      const cleanup = lazyObserve({
        context: this,
        property: 'result',
        onStart: () => {
          if (!this._observerSubscription) {
            this.updateResult(this.mutationObserver.getCurrentResult());
            this._observerSubscription = this.mutationObserver.subscribe(
              this.updateResult,
            );
          }
        },
        onEnd: () => {
          if (this._observerSubscription) {
            this._observerSubscription?.();
            this._observerSubscription = undefined;
          }
        },
      });
      config.abortSignal?.addEventListener('abort', cleanup);
    } else {
      this._observerSubscription = this.mutationObserver.subscribe(
        this.updateResult,
      );
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

    if (this.features.invalidateByKey && this.mutationOptions.mutationKey) {
      this.onDone(() => {
        this.queryClient.invalidateQueries({
          ...(this.features.invalidateByKey === true
            ? {}
            : this.features.invalidateByKey),
          queryKey: this.mutationOptions.mutationKey,
        });
      });
    }

    config.onInit?.(this);
    this.hooks?.onMutationInit?.(this);
  }

  async mutate(
    variables: TVariables,
    options?: MutateOptions<TData, TError, TVariables, TOnMutateResult>,
  ) {
    if (this.features.lazy) {
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
    options?: MutateOptions<TData, TError, TVariables, TOnMutateResult>,
  ) {
    return await this.mutate(variables, options);
  }

  /**
   * Modify this result so it matches the tanstack query result.
   */
  private updateResult(
    result: MutationObserverResult<TData, TError, TVariables, TOnMutateResult>,
  ) {
    this.result = result || {};

    if (this.features.transformError && this.result.error) {
      this.result.error = this.features.transformError(this.result.error);
    }

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
    listener: MutationSettledListener<
      TData,
      TError,
      TVariables,
      TOnMutateResult
    >,
  ): void {
    this.settledListeners.push(listener);
  }

  onDone(
    listener: MutationDoneListener<TData, TVariables, TOnMutateResult>,
  ): void {
    this.doneListeners.push(listener);
  }

  onError(
    listener: MutationErrorListener<TError, TVariables, TOnMutateResult>,
  ): void {
    this.errorListeners.push(listener);
  }

  reset() {
    this.mutationObserver.reset();
  }

  protected handleDestroy() {
    this._observerSubscription?.();

    this.doneListeners = [];
    this.errorListeners = [];
    this.settledListeners = [];

    if (this.features.resetOnDestroy) {
      this.reset();
    }

    delete this._observerSubscription;
    this.hooks?.onMutationDestroy?.(this);
  }
}

/**
 * @deprecated ⚠️ use `Mutation`. This export will be removed in next major release
 */
export class MobxMutation<
  TData = unknown,
  TVariables = void,
  TError = DefaultError,
  TOnMutateResult = unknown,
> extends Mutation<TData, TVariables, TError, TOnMutateResult> {}

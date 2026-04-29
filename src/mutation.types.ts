import type {
  DefaultError,
  InvalidateQueryFilters,
  MutationFunctionContext as MutationFunctionContextCore,
  MutationObserverOptions,
} from '@tanstack/query-core';
import type { ObservableTypes } from 'yummies/mobx';
import type { Mutation } from './mutation.js';
import type { AnyQueryClient } from './query-client.types.js';

export interface MutationFeatures {
  /**
   * Invalidate queries by mutation key.
   *
   * - when `true`, invalidate all queries by mutation key (not exact)
   * - when `object`, invalidate all queries by mutation key with this additional filters
   */
  invalidateByKey?:
    | boolean
    | Omit<InvalidateQueryFilters, 'queryKey' | 'predicate'>;
  /**
   * Reset mutation when dispose is called
   *
   * @deprecated Please use 'resetOnDestroy'
   */
  resetOnDispose?: boolean;

  /**
   * Reset mutation when destroy or abort signal is called
   */
  resetOnDestroy?: boolean;
  /**
   * **EXPERIMENTAL**
   *
   * Make all mutation reactions and subscriptions lazy.
   * They exists only when mutation result is observed.
   */
  lazy?: boolean;

  /**
   * When `lazy` is enabled, delay in milliseconds before tearing down the `MutationObserver` subscription after the last MobX observer stops reading `result` (`lazyObserve` `endDelay` from `yummies/mobx`).
   *
   * [**Documentation**](https://js2me.github.io/mobx-tanstack-query/api/Mutation.html#lazydelay-option-mutationfeature)
   */
  lazyDelay?: number;

  transformError?: (error: any) => any;

  /**
   * MobX observable flavour for the mutation `result` property (`MutationObserverResult`), applied with
   * `annotation.observable()` from `yummies/mobx`. Unlike `Query` (which keeps the observer payload on `_result`
   * and exposes fields via getters), `Mutation` decorates the public `result` field directly. Convenience fields
   * (`data`, `isPending`, `isError`, …) read from that object, so this option controls how deeply updates propagate.
   *
   * - `'ref'` — default when omitted; tracks only the result reference.
   * - `'deep'` — deep observability for plain objects and arrays.
   * - `'shallow'` / `'struct'` — shallow or structural comparison for nested keys.
   * - `true` — base `observable` (same as omitting the option).
   * - `false` — skip decorating `result` (no automatic MobX tracking for the result; advanced use only).
   *
   * @default 'ref'
   *
   * [**Documentation**](https://js2me.github.io/mobx-tanstack-query/api/Mutation.html#resultobservable-mutationfeature)
   */
  resultObservable?: ObservableTypes | boolean;
}

/**
 * @deprecated ⚠️ use `MutationFeatures`. This type will be removed in next major release
 */
export type MobxMutationFeatures = MutationFeatures;

export interface MutationInvalidateQueriesOptions
  extends Omit<InvalidateQueryFilters, 'queryKey'> {
  queryKey?: InvalidateQueryFilters['queryKey'];
  queryKeys?: InvalidateQueryFilters['queryKey'][];
  allQueryKeys?: true;
}

/**
 * @deprecated ⚠️ use `MutationInvalidateQueriesOptions`. This type will be removed in next major release
 */
export type MobxMutationInvalidateQueriesOptions =
  MutationInvalidateQueriesOptions;

export type MutationFn<TData = unknown, TVariables = unknown> = (
  variables: TVariables,
  context: MutationFunctionContext,
) => Promise<TData>;

/**
 * @deprecated ⚠️ use `MutationFn`. This type will be removed in next major release
 */
export type MobxMutationFunction<
  TData = unknown,
  TVariables = unknown,
> = MutationFn<TData, TVariables>;

export type MutationSettledListener<
  TData = unknown,
  TError = DefaultError,
  TVariables = void,
  TContext = unknown,
> = (
  data: TData | undefined,
  error: TError | null,
  variables: TVariables,
  context: TContext | undefined,
) => void;

export type MutationErrorListener<
  TError = DefaultError,
  TVariables = void,
  TContext = unknown,
> = (error: TError, payload: TVariables, context: TContext | undefined) => void;

export type MutationDoneListener<
  TData = unknown,
  TVariables = void,
  TContext = unknown,
> = (data: TData, payload: TVariables, context: TContext | undefined) => void;

export interface MutationConfig<
  TData = unknown,
  TVariables = void,
  TError = DefaultError,
  TContext = unknown,
> extends Omit<
      MutationObserverOptions<TData, TError, TVariables, TContext>,
      '_defaulted' | 'mutationFn'
    >,
    MutationFeatures {
  mutationFn?: MutationFn<TData, TVariables>;
  queryClient: AnyQueryClient;
  abortSignal?: AbortSignal;
  invalidateQueries?:
    | MutationInvalidateQueriesOptions
    | ((
        data: TData,
        payload: TVariables,
      ) => MutationInvalidateQueriesOptions | null | undefined);
  onInit?: (mutation: Mutation<TData, TVariables, TError, TContext>) => void;
}
export interface MutationFunctionContext extends MutationFunctionContextCore {
  signal: AbortSignal;
}

/**
 * @deprecated ⚠️ use `MutationConfig`. This type will be removed in next major release
 */
export type MobxMutationConfig<
  TData = unknown,
  TVariables = void,
  TError = DefaultError,
  TContext = unknown,
> = MutationConfig<TData, TVariables, TError, TContext>;

export type MutationConfigFromFn<
  T extends (...args: any[]) => any,
  TError = DefaultError,
  TContext = unknown,
> = MutationConfig<
  ReturnType<T> extends Promise<infer TData> ? TData : ReturnType<T>,
  Parameters<T>[0],
  TError,
  TContext
>;

/**
 * @deprecated ⚠️ use `MutationConfigFromFn`. This type will be removed in next major release
 */
export type MobxMutationConfigFromFn<
  T extends (...args: any[]) => any,
  TError = DefaultError,
  TContext = unknown,
> = MutationConfigFromFn<T, TError, TContext>;

export type InferMutation<
  T extends MutationConfig | Mutation,
  TInferValue extends
    | 'data'
    | 'variables'
    | 'error'
    | 'context'
    | 'mutation'
    | 'config',
> =
  T extends MutationConfig<
    infer TData,
    infer TVariables,
    infer TError,
    infer TContext
  >
    ? TInferValue extends 'config'
      ? T
      : TInferValue extends 'data'
        ? TData
        : TInferValue extends 'variables'
          ? TVariables
          : TInferValue extends 'error'
            ? TError
            : TInferValue extends 'context'
              ? TContext
              : TInferValue extends 'mutation'
                ? Mutation<TData, TVariables, TError, TContext>
                : never
    : T extends Mutation<
          infer TData,
          infer TVariables,
          infer TError,
          infer TContext
        >
      ? TInferValue extends 'config'
        ? MutationConfig<TData, TVariables, TError, TContext>
        : TInferValue extends 'data'
          ? TData
          : TInferValue extends 'variables'
            ? TVariables
            : TInferValue extends 'error'
              ? TError
              : TInferValue extends 'context'
                ? TContext
                : TInferValue extends 'mutation'
                  ? T
                  : never
      : never;

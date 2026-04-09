import type {
  DefaultError,
  InvalidateQueryFilters,
  MutationFunctionContext as MutationFunctionContextCore,
  MutationObserverOptions,
} from '@tanstack/query-core';

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
  transformError?: (error: any) => any;
}

export interface MutationInvalidateQueriesOptions
  extends Omit<InvalidateQueryFilters, 'queryKey'> {
  queryKey?: InvalidateQueryFilters['queryKey'];
  queryKeys?: InvalidateQueryFilters['queryKey'][];
  allQueryKeys?: true;
}

export type MutationFn<TData = unknown, TVariables = unknown> = (
  variables: TVariables,
  context: MutationFunctionContext,
) => Promise<TData>;

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

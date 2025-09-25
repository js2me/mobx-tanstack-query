import {
  DefaultError,
  InvalidateQueryFilters,
  MutationObserverOptions,
  MutationFunctionContext as MutationFunctionContextCore,
} from '@tanstack/query-core';

import { Mutation } from './mutation';
import { AnyQueryClient } from './query-client.types';

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
  transformError?: (error: any) => any;
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

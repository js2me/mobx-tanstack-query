import {
  DefaultError,
  InvalidateQueryFilters,
  MutationObserverOptions,
} from '@tanstack/query-core';

import { MobxMutation } from './mobx-mutation';
import { AnyQueryClient } from './mobx-query-client.types';

export interface MobxMutationFeatures {
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
}

export interface MobxMutationInvalidateQueriesOptions
  extends Omit<InvalidateQueryFilters, 'queryKey'> {
  queryKey?: InvalidateQueryFilters['queryKey'];
  queryKeys?: InvalidateQueryFilters['queryKey'][];
}

export type MobxMutationFunction<TData = unknown, TVariables = unknown> = (
  variables: TVariables,
  options: { signal: AbortSignal },
) => Promise<TData>;

export interface MobxMutationConfig<
  TData = unknown,
  TVariables = void,
  TError = DefaultError,
  TContext = unknown,
> extends Omit<
      MutationObserverOptions<TData, TError, TVariables, TContext>,
      '_defaulted' | 'mutationFn'
    >,
    MobxMutationFeatures {
  mutationFn?: MobxMutationFunction<TData, TVariables>;
  queryClient: AnyQueryClient;
  abortSignal?: AbortSignal;
  invalidateQueries?:
    | MobxMutationInvalidateQueriesOptions
    | ((
        data: TData,
        payload: TVariables,
      ) => MobxMutationInvalidateQueriesOptions);
  onInit?: (
    mutation: MobxMutation<TData, TVariables, TError, TContext>,
  ) => void;
}

export type MobxMutationConfigFromFn<
  T extends (...args: any[]) => any,
  TError = DefaultError,
  TContext = unknown,
> = MobxMutationConfig<
  ReturnType<T> extends Promise<infer TData> ? TData : ReturnType<T>,
  Parameters<T>[0],
  TError,
  TContext
>;

export type InferMutation<
  T extends MobxMutationConfig | MobxMutation,
  TInferValue extends
    | 'data'
    | 'variables'
    | 'error'
    | 'context'
    | 'mutation'
    | 'config',
> =
  T extends MobxMutationConfig<
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
                ? MobxMutation<TData, TVariables, TError, TContext>
                : never
    : T extends MobxMutation<
          infer TData,
          infer TVariables,
          infer TError,
          infer TContext
        >
      ? TInferValue extends 'config'
        ? MobxMutationConfig<TData, TVariables, TError, TContext>
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

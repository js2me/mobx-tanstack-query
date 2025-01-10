import {
  DefaultError,
  MutationObserverOptions,
  QueryClient,
} from '@tanstack/query-core';
import { IDisposer } from 'disposer-util';

import type { MobxMutation } from './mobx-mutation';
import { MobxQueryClient } from './mobx-query-client';

export interface MobxMutationFeatures {
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

export interface MobxMutationConfig<
  TData = unknown,
  TVariables = void,
  TError = DefaultError,
  TContext = unknown,
> extends Omit<
      MutationObserverOptions<TData, TError, TVariables, TContext>,
      '_defaulted'
    >,
    MobxMutationFeatures {
  queryClient: QueryClient | MobxQueryClient;
  /**
   * @deprecated use `abortSignal` instead
   */
  disposer?: IDisposer;
  abortSignal?: AbortSignal;
  onInit?: (
    mutation: MobxMutation<TData, TVariables, TError, TContext>,
  ) => void;
}

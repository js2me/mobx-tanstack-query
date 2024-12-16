import {
  DefaultError,
  MutationObserverOptions,
  QueryClient,
} from '@tanstack/query-core';
import { IDisposer } from 'disposer-util';

import type { MobxMutation } from './mobx-mutation';

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
  /**
   * @deprecated use `abortSignal` instead
   */
  disposer?: IDisposer;
  abortSignal?: AbortSignal;
  resetOnDispose?: boolean;
  onInit?: (
    mutation: MobxMutation<TData, TVariables, TError, TContext>,
  ) => void;
}

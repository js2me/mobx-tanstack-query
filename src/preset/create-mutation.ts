import { DefaultError, QueryClient } from '@tanstack/query-core';

import { MobxMutation } from '../mobx-mutation';
import { MobxMutationConfig } from '../mobx-mutation.types';

import { queryClient } from './query-client';

export type CreateMutationParams<
  TData = unknown,
  TVariables = void,
  TError = DefaultError,
  TContext = unknown,
> = Omit<
  MobxMutationConfig<TData, TVariables, TError, TContext>,
  'queryClient' | 'mutationFn'
> & {
  queryClient?: QueryClient;
};

export const createMutation = <
  TData = unknown,
  TVariables = void,
  TError = DefaultError,
  TContext = unknown,
>(
  fn: MobxMutationConfig<TData, TVariables, TError, TContext>['mutationFn'],
  params?: CreateMutationParams<TData, TVariables, TError, TContext>,
) => {
  return new MobxMutation({
    ...params,
    queryClient: params?.queryClient ?? queryClient,
    mutationFn: fn,
    onInit: (mutation) => {
      queryClient.mount();
      params?.onInit?.(mutation);
    },
  });
};

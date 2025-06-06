import { DefaultError, QueryClient } from '@tanstack/query-core';

import { Mutation } from '../mobx-mutation';
import { MutationConfig } from '../mobx-mutation.types';

import { queryClient } from './query-client';

export type CreateMutationParams<
  TData = unknown,
  TVariables = void,
  TError = DefaultError,
  TContext = unknown,
> = Omit<
  MutationConfig<TData, TVariables, TError, TContext>,
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
  fn: MutationConfig<TData, TVariables, TError, TContext>['mutationFn'],
  params?: CreateMutationParams<TData, TVariables, TError, TContext>,
) => {
  return new Mutation({
    ...params,
    queryClient: params?.queryClient ?? queryClient,
    mutationFn: fn,
    onInit: (mutation) => {
      queryClient.mount();
      params?.onInit?.(mutation);
    },
  });
};

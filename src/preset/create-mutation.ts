import type { DefaultError, QueryClient } from '@tanstack/query-core';

import { Mutation, type MutationConfig } from 'mobx-tanstack-query';

import { queryClient } from './query-client.js';

export type CreateMutationParams<
  TData = unknown,
  TVariables = void,
  TError = DefaultError,
  TOnMutateResult = unknown,
> = Omit<
  MutationConfig<TData, TVariables, TError, TOnMutateResult>,
  'queryClient' | 'mutationFn'
> & {
  queryClient?: QueryClient;
};

export const createMutation = <
  TData = unknown,
  TVariables = void,
  TError = DefaultError,
  TOnMutateResult = unknown,
>(
  fn: MutationConfig<TData, TVariables, TError, TOnMutateResult>['mutationFn'],
  params?: CreateMutationParams<TData, TVariables, TError, TOnMutateResult>,
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

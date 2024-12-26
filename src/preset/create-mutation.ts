import { DefaultError } from '@tanstack/query-core';

import { MobxMutation } from '../mobx-mutation';
import { MobxMutationConfig } from '../mobx-mutation.types';

import { queryClient } from './query-client';

export const creatMutation = <
  TData = unknown,
  TVariables = void,
  TError = DefaultError,
  TContext = unknown,
>(
  fn: MobxMutationConfig<TData, TVariables, TError, TContext>['mutationFn'],
  params?: Omit<
    MobxMutationConfig<TData, TVariables, TError, TContext>,
    'queryClient' | 'mutationFn'
  >,
) => {
  return new MobxMutation({
    queryClient,
    ...params,
    mutationFn: fn,
    onInit: (mutation) => {
      queryClient.mount();
      params?.onInit?.(mutation);
    },
  });
};

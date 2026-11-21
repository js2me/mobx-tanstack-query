import type { DefaultError } from '@tanstack/query-core';

import type { MutationConfig } from './mutation.types.js';

export interface MutationOptionsParams<
  TData = unknown,
  TVariables = void,
  TError = DefaultError,
  TContext = unknown,
> extends Omit<
    MutationConfig<TData, TVariables, TError, TContext>,
    'queryClient'
  > {}

export function mutationOptions<
  TData = unknown,
  TVariables = void,
  TError = DefaultError,
  TContext = unknown,
>(
  options: MutationOptionsParams<TData, TVariables, TError, TContext>,
): MutationOptionsParams<TData, TVariables, TError, TContext>;

export function mutationOptions(options: unknown) {
  return options;
}

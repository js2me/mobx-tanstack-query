import {
  type AnyQueryClient,
  FetchQuery,
  type FetchQueryConfig,
} from 'mobx-tanstack-query';
import type { PartialKeys } from 'yummies/types';
import { createFetchQueryInstance } from './create-query-instance.js';

export type CreateFetchQueryFnConfig<
  TData = unknown,
  TOutputData = TData,
> = FetchQueryConfig<TData, TOutputData>;

export function createFetchQuery<TData = unknown, TOutputData = TData>(
  queryClient: AnyQueryClient,
  options:
    | Omit<Partial<CreateFetchQueryFnConfig<TData, TOutputData>>, 'queryClient'>
    | (() => Omit<
        Partial<CreateFetchQueryFnConfig<TData, TOutputData>>,
        'queryClient'
      >),
): FetchQuery<TData, TOutputData>;

export function createFetchQuery<TData = unknown, TOutputData = TData>(
  options: () => PartialKeys<
    CreateFetchQueryFnConfig<TData, TOutputData>,
    'queryClient'
  >,
): FetchQuery<TData, TOutputData>;

export function createFetchQuery<TData = unknown, TOutputData = TData>(
  options: PartialKeys<
    CreateFetchQueryFnConfig<TData, TOutputData>,
    'queryClient'
  >,
): FetchQuery<TData, TOutputData>;

export function createFetchQuery(...args: [any, any?]) {
  return createFetchQueryInstance(FetchQuery, args);
}

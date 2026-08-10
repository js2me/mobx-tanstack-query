import {
  type AnyQueryClient,
  FetchQuery,
  type FetchQueryConfig,
} from 'mobx-tanstack-query';
import type { PartialKeys } from 'yummies/types';
import { createFetchQueryInstance } from './create-query-instance.js';

export type CreateFetchQueryFnConfig<
  TData = unknown,
  TOutputData = any,
> = FetchQueryConfig<TData, TOutputData>;

export function createFetchQuery<TData = unknown, TOutputData = any>(
  queryClient: AnyQueryClient,
  options:
    | Omit<Partial<CreateFetchQueryFnConfig<TData, TOutputData>>, 'queryClient'>
    | (() => Omit<
        Partial<CreateFetchQueryFnConfig<TData, TOutputData>>,
        'queryClient'
      >),
): FetchQuery<TData, TOutputData>;

export function createFetchQuery<TData = unknown, TOutputData = any>(
  options: () => PartialKeys<
    CreateFetchQueryFnConfig<TData, TOutputData>,
    'queryClient'
  >,
): FetchQuery<TData, TOutputData>;

export function createFetchQuery<TData = unknown, TOutputData = any>(
  options: PartialKeys<
    CreateFetchQueryFnConfig<TData, TOutputData>,
    'queryClient'
  >,
): FetchQuery<TData, TOutputData>;

export function createFetchQuery(...args: [any, any?]) {
  return createFetchQueryInstance(FetchQuery, args);
}

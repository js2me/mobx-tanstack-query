import type { FetchQueryPositionalConfig } from 'mobx-tanstack-query';
import {
  type AnyQueryClient,
  FetchQuery,
  type FetchQueryConfig,
} from 'mobx-tanstack-query';
import { createFetchQueryInstance } from './create-query-instance.js';

export type CreateFetchQueryFnConfig<
  TRaw = unknown,
  TData = TRaw | null,
> = FetchQueryConfig<TRaw, TData>;

type PresetConfig<TRaw, TData> = FetchQueryPositionalConfig<TRaw, TData> & {
  queryClient?: AnyQueryClient;
};

export function createFetchQuery<TRaw = unknown, TData = TRaw | null>(
  queryClient: AnyQueryClient,
  options:
    | FetchQueryPositionalConfig<TRaw, TData>
    | (() => FetchQueryPositionalConfig<TRaw, TData>),
): FetchQuery<TRaw, TData>;

export function createFetchQuery<TRaw = unknown, TData = TRaw | null>(
  options: PresetConfig<TRaw, TData> | (() => PresetConfig<TRaw, TData>),
): FetchQuery<TRaw, TData>;

export function createFetchQuery(...args: [any, any?]) {
  return createFetchQueryInstance(FetchQuery, args);
}

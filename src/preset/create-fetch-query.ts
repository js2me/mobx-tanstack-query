import {
  type AnyQueryClient,
  FetchQuery,
  type FetchQueryConfig,
  getQueryClient,
  mountQueryClientOnce,
} from 'mobx-tanstack-query';
import type { PartialKeys } from 'yummies/types';
import { queryClient } from './query-client.js';

export interface CreateFetchQueryFnConfig<TData = unknown, TOutputData = any>
  extends FetchQueryConfig<TData, TOutputData> {}

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
  options: PartialKeys<
    CreateFetchQueryFnConfig<TData, TOutputData>,
    'queryClient'
  >,
): FetchQuery<TData, TOutputData>;

export function createFetchQuery(...args: [any, any?]) {
  let fetchQuery: FetchQuery;

  if (args.length === 2) {
    fetchQuery = new FetchQuery(
      args[0],
      typeof args[1] === 'function' ? args[1] : () => args[1],
    );
  } else {
    const options = args[0];
    fetchQuery = new FetchQuery({
      ...options,
      queryClient: options.queryClient ?? queryClient,
    });
  }

  mountQueryClientOnce(getQueryClient(fetchQuery));

  return fetchQuery;
}

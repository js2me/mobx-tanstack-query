import {
  type AnyQueryClient,
  FetchQuery,
  type FetchQueryConfig,
  getQueryClient,
  mountQueryClientOnce,
} from 'mobx-tanstack-query';
import type { PartialKeys } from 'yummies/types';
import { queryClient } from './query-client.js';

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
  let fetchQuery: FetchQuery;

  if (args.length === 2) {
    if (typeof args[1] === 'function') {
      const getOptions = args[1];
      fetchQuery = new FetchQuery(() => ({
        ...getOptions(),
        queryClient: args[0],
      }));
    } else {
      fetchQuery = new FetchQuery(args[0], args[1]);
    }
  } else if (typeof args[0] === 'function') {
    const getOptions = args[0];
    fetchQuery = new FetchQuery(() => {
      const options = getOptions();
      return {
        ...options,
        queryClient: options.queryClient ?? queryClient,
      };
    });
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

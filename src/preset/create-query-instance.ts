import { getQueryClient, mountQueryClientOnce } from 'mobx-tanstack-query';
import { queryClient as presetQueryClient } from './query-client.js';

/**
 * INTERNAL API. Not for public usage.
 *
 * Shared argument-dispatch for the `createFetchQuery`/`createFetchInfiniteQuery`
 * factories: resolves the overload variant (queryClient + options, options
 * object, or options function), falls back to the preset queryClient when it
 * is not provided and mounts the used queryClient once.
 */
export const createFetchQueryInstance = <TQuery>(
  QueryClass: new (...args: any[]) => TQuery,
  args: [any, any?],
): TQuery => {
  let query: TQuery;

  if (args.length === 2) {
    if (typeof args[1] === 'function') {
      const getOptions = args[1];
      query = new QueryClass(() => ({
        ...getOptions(),
        queryClient: args[0],
      }));
    } else {
      query = new QueryClass(args[0], args[1]);
    }
  } else if (typeof args[0] === 'function') {
    const getOptions = args[0];
    query = new QueryClass(() => {
      const options = getOptions();
      return {
        ...options,
        queryClient: options.queryClient ?? presetQueryClient,
      };
    });
  } else {
    const options = args[0];
    query = new QueryClass({
      ...options,
      queryClient: options.queryClient ?? presetQueryClient,
    });
  }

  mountQueryClientOnce(getQueryClient(query));

  return query;
};

/**
 * INTERNAL API. Not for public usage.
 *
 * Shared argument-dispatch for the `createQuery`/`createInfiniteQuery`
 * factories: resolves the overload variant (queryFn + options,
 * queryClient + options, or options object), falls back to the preset
 * queryClient when it is not provided and mounts the used queryClient once.
 */
export const createQueryInstance = <TQuery>(
  QueryClass: new (...args: any[]) => TQuery,
  args: [any, any?],
): TQuery => {
  let query: TQuery;

  if (typeof args[0] === 'function') {
    query = new QueryClass({
      ...args[1],
      queryClient: args[1]?.queryClient ?? presetQueryClient,
      queryFn: args[0],
    });
  } else if (args.length === 2) {
    query = new QueryClass(
      args[0],
      typeof args[1] === 'function' ? args[1] : () => args[1],
    );
  } else {
    const options = args[0];
    query = new QueryClass({
      ...options,
      queryClient: options.queryClient ?? presetQueryClient,
    });
  }

  mountQueryClientOnce(getQueryClient(query));

  return query;
};

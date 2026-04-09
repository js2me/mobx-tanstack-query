import type {
  DefaultOptions as DefaultCoreOptions,
  DefaultError,
  QueryClient as QueryClientCore,
  QueryClientConfig as QueryClientCoreConfig,
} from '@tanstack/query-core';

import type { InfiniteQuery } from './inifinite-query.js';
import type { Mutation } from './mutation.js';
import type { MutationFeatures } from './mutation.types.js';
import type { AnyQuery, QueryFeatures } from './query.types.js';
import type { QueryClient } from './query-client.js';

export type IQueryClientCore = {
  [K in keyof QueryClientCore]: QueryClientCore[K];
};

export type AnyQueryClient = QueryClient | IQueryClientCore | QueryClientCore;

export interface DefaultOptions<TError = DefaultError>
  extends Omit<DefaultCoreOptions<TError>, 'queries' | 'mutations'> {
  queries?: DefaultCoreOptions<TError>['queries'] & QueryFeatures;
  mutations?: DefaultCoreOptions<TError>['mutations'] & MutationFeatures;
}

export interface QueryClientHooks {
  onQueryInit?: (query: AnyQuery) => void;
  onInfiniteQueryInit?: (query: InfiniteQuery<any, any, any, any, any>) => void;
  onMutationInit?: (query: Mutation<any, any, any, any>) => void;
  onQueryDestroy?: (query: AnyQuery) => void;
  onInfiniteQueryDestroy?: (
    query: InfiniteQuery<any, any, any, any, any>,
  ) => void;
  onMutationDestroy?: (query: Mutation<any, any, any, any>) => void;
}

export interface QueryClientConfig
  extends Omit<QueryClientCoreConfig, 'defaultOptions'> {
  defaultOptions?: DefaultOptions;
  hooks?: QueryClientHooks;
}

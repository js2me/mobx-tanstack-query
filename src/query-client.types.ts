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

/**
 * @deprecated ⚠️ use `IQueryClientCore`. This type will be removed in next major release
 */
export type IQueryClient = IQueryClientCore;

/**
 * @deprecated renamed to `IQueryClient`. Will be removed in next major release.
 */
export type QueryClientInterface = IQueryClientCore;

export type AnyQueryClient = QueryClient | IQueryClientCore | QueryClientCore;

export interface DefaultOptions<TError = DefaultError>
  extends Omit<DefaultCoreOptions<TError>, 'queries' | 'mutations'> {
  queries?: DefaultCoreOptions<TError>['queries'] & QueryFeatures;
  mutations?: DefaultCoreOptions<TError>['mutations'] & MutationFeatures;
}

/**
 * @deprecated ⚠️ use `DefaultOptions`. This type will be removed in next major release
 */
export type MobxDefaultOptions<TError = DefaultError> = DefaultOptions<TError>;

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

/**
 * @deprecated ⚠️ use `QueryClientHooks`. This type will be removed in next major release
 */
export type MobxQueryClientHooks = QueryClientHooks;

export interface QueryClientConfig
  extends Omit<QueryClientCoreConfig, 'defaultOptions'> {
  defaultOptions?: DefaultOptions;
  hooks?: QueryClientHooks;
}

/**
 * @deprecated ⚠️ use `QueryClientConfig`. This type will be removed in next major release
 */
export type MobxQueryClientConfig = QueryClientConfig;

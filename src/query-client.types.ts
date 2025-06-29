import {
  DefaultError,
  DefaultOptions as DefaultCoreOptions,
  QueryClient as QueryClientCore,
  QueryClientConfig as QueryClientCoreConfig,
} from '@tanstack/query-core';

import { InfiniteQuery } from './inifinite-query';
import { Mutation } from './mutation';
import { MutationFeatures } from './mutation.types';
import type { QueryClient } from './query-client';
import { AnyQuery, QueryFeatures } from './query.types';

export type IQueryClientCore = {
  [K in keyof QueryClientCore]: QueryClientCore[K];
};

/**
 * @remarks ⚠️ use `IQueryClientCore`. This type will be removed in next major release
 */
export type IQueryClient = IQueryClientCore;

/**
 * @deprecated renamed to `IQueryClient`. Will be removed in next major release.
 */
export type QueryClientInterface = IQueryClientCore;

export type AnyQueryClient = QueryClient | IQueryClientCore;

export interface DefaultOptions<TError = DefaultError>
  extends Omit<DefaultCoreOptions<TError>, 'queries' | 'mutations'> {
  queries?: DefaultCoreOptions<TError>['queries'] & QueryFeatures;
  mutations?: DefaultCoreOptions<TError>['mutations'] & MutationFeatures;
}

/**
 * @remarks ⚠️ use `DefaultOptions`. This type will be removed in next major release
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
 * @remarks ⚠️ use `QueryClientHooks`. This type will be removed in next major release
 */
export type MobxQueryClientHooks = QueryClientHooks;

export interface QueryClientConfig
  extends Omit<QueryClientCoreConfig, 'defaultOptions'> {
  defaultOptions?: DefaultOptions;
  hooks?: QueryClientHooks;
}

/**
 * @remarks ⚠️ use `QueryClientConfig`. This type will be removed in next major release
 */
export type MobxQueryClientConfig = QueryClientConfig;

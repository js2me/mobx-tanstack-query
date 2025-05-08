import {
  DefaultError,
  DefaultOptions,
  QueryClient,
  QueryClientConfig,
} from '@tanstack/query-core';

import { MobxInfiniteQuery } from './mobx-inifinite-query';
import { MobxMutation } from './mobx-mutation';
import { MobxMutationFeatures } from './mobx-mutation.types';
import type { MobxQueryClient } from './mobx-query-client';
import { AnyMobxQuery, MobxQueryFeatures } from './mobx-query.types';

export type IQueryClient = {
  [K in keyof QueryClient]: QueryClient[K];
};

/**
 * @deprecated renamed to `IQueryClient`. Will be removed in next major release.
 */
// eslint-disable-next-line sonarjs/redundant-type-aliases
export type QueryClientInterface = IQueryClient;

export type AnyQueryClient = MobxQueryClient | IQueryClient;

export interface MobxDefaultOptions<TError = DefaultError>
  extends Omit<DefaultOptions<TError>, 'queries' | 'mutations'> {
  queries?: DefaultOptions<TError>['queries'] & MobxQueryFeatures;
  mutations?: DefaultOptions<TError>['mutations'] & MobxMutationFeatures;
}

export interface MobxQueryClientHooks {
  onQueryInit?: (query: AnyMobxQuery) => void;
  onInfiniteQueryInit?: (query: MobxInfiniteQuery<any, any, any, any>) => void;
  onMutationInit?: (query: MobxMutation<any, any, any, any>) => void;
  onQueryDestroy?: (query: AnyMobxQuery) => void;
  onInfiniteQueryDestroy?: (
    query: MobxInfiniteQuery<any, any, any, any>,
  ) => void;
  onMutationDestroy?: (query: MobxMutation<any, any, any, any>) => void;
}

export interface MobxQueryClientConfig
  extends Omit<QueryClientConfig, 'defaultOptions'> {
  defaultOptions?: MobxDefaultOptions;
  hooks?: MobxQueryClientHooks;
}

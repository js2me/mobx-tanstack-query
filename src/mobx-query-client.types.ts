import {
  DefaultError,
  DefaultOptions,
  QueryClient,
  QueryClientConfig,
} from '@tanstack/query-core';

import { MobxInfiniteQuery } from './mobx-inifinite-query';
import { MobxMutation } from './mobx-mutation';
import { MobxMutationFeatures } from './mobx-mutation.types';
import { MobxQuery } from './mobx-query';
import type { MobxQueryClient } from './mobx-query-client';
import { MobxQueryFeatures } from './mobx-query.types';

export type QueryClientInterface = {
  // eslint-disable-next-line @typescript-eslint/ban-types
  [K in keyof QueryClient]: QueryClient[K] extends Function
    ? QueryClient[K]
    : never;
};

export type AnyQueryClient = MobxQueryClient | QueryClientInterface;

export interface MobxDefaultOptions<TError = DefaultError>
  extends Omit<DefaultOptions<TError>, 'queries' | 'mutations'> {
  queries?: DefaultOptions<TError>['queries'] & MobxQueryFeatures;
  mutations?: DefaultOptions<TError>['mutations'] & MobxMutationFeatures;
}

export interface MobxQueryClientHooks {
  onQueryInit?: (query: MobxQuery<any, any, any>) => void;
  onInfiniteQueryInit?: (query: MobxInfiniteQuery<any, any, any, any>) => void;
  onMutationInit?: (query: MobxMutation<any, any, any, any>) => void;
  onQueryDestroy?: (query: MobxQuery<any, any, any>) => void;
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

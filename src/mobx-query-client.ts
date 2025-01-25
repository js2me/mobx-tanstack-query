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
import { MobxQueryFeatures } from './mobx-query.types';

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

export class MobxQueryClient extends QueryClient {
  constructor(private config: MobxQueryClientConfig = {}) {
    super(config);
  }

  setDefaultOptions(
    options: Exclude<MobxQueryClientConfig['defaultOptions'], undefined>,
  ): void {
    super.setDefaultOptions(options);
    this.config.defaultOptions = options;
  }

  getDefaultOptions(): Exclude<
    MobxQueryClientConfig['defaultOptions'],
    undefined
  > {
    return super.getDefaultOptions();
  }

  get queryFeatures(): MobxQueryFeatures {
    return this.getDefaultOptions().queries ?? {};
  }

  get hooks(): MobxQueryClientHooks | undefined {
    return this.config.hooks;
  }

  get mutationFeatures(): MobxMutationFeatures {
    return this.getDefaultOptions().mutations ?? {};
  }
}

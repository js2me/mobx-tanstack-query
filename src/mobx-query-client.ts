import {
  DefaultError,
  DefaultOptions,
  QueryClient,
  QueryClientConfig,
} from '@tanstack/query-core';

import { MobxMutationFeatures } from './mobx-mutation.types';
import { MobxQueryFeatures } from './mobx-query.types';

interface MobxDefaultOptions<TError = DefaultError>
  extends Omit<DefaultOptions<TError>, 'queries' | 'mutations'> {
  queries?: DefaultOptions<TError>['queries'] & MobxQueryFeatures;
  mutations?: DefaultOptions<TError>['mutations'] & MobxMutationFeatures;
}

export interface MobxQueryClientConfig
  extends Omit<QueryClientConfig, 'defaultOptions'> {
  defaultOptions?: MobxDefaultOptions;
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

  get mutationFeatures(): MobxMutationFeatures {
    return this.getDefaultOptions().mutations ?? {};
  }
}

import { QueryClient } from '@tanstack/query-core';

import { MobxMutationFeatures } from './mobx-mutation.types';
import {
  MobxQueryClientConfig,
  MobxQueryClientHooks,
} from './mobx-query-client.types';
import { MobxQueryFeatures } from './mobx-query.types';

export class MobxQueryClient extends QueryClient {
  hooks?: MobxQueryClientHooks;

  constructor(private config: MobxQueryClientConfig = {}) {
    super(config);
    this.hooks = config.hooks;
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

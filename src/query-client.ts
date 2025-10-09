import { QueryClient as QueryClientCore } from '@tanstack/query-core';

import type { MutationFeatures } from './mutation.types.js';
import type { QueryFeatures } from './query.types.js';
import type {
  IQueryClientCore,
  QueryClientConfig,
  QueryClientHooks,
} from './query-client.types.js';

export class QueryClient extends QueryClientCore implements IQueryClientCore {
  hooks?: QueryClientHooks;

  constructor(private config: QueryClientConfig = {}) {
    super(config);
    this.hooks = config.hooks;
  }

  setDefaultOptions(
    options: Exclude<QueryClientConfig['defaultOptions'], undefined>,
  ): void {
    super.setDefaultOptions(options);
    this.config.defaultOptions = options;
  }

  getDefaultOptions(): Exclude<QueryClientConfig['defaultOptions'], undefined> {
    return super.getDefaultOptions();
  }

  get queryFeatures(): QueryFeatures {
    return this.getDefaultOptions().queries ?? {};
  }

  get mutationFeatures(): MutationFeatures {
    return this.getDefaultOptions().mutations ?? {};
  }
}

/**
 * @deprecated ⚠️ use `QueryClient`. This export will be removed in next major release
 */
export class MobxQueryClient extends QueryClient {}

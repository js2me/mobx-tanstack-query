import { QueryClient } from 'mobx-tanstack-query';

import { defaultQueryClientConfig } from './configs/index.js';

export const queryClient = new QueryClient(defaultQueryClientConfig);

import { QueryClient } from '@tanstack/query-core';

import { defaultQueryClientConfig } from './configs';

export const queryClient = new QueryClient(defaultQueryClientConfig);

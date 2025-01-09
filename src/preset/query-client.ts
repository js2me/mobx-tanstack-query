import { MobxQueryClient } from '../mobx-query-client';

import { defaultQueryClientConfig } from './configs';

export const queryClient = new MobxQueryClient(defaultQueryClientConfig);

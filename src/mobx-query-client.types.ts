import type { QueryClient } from '@tanstack/query-core';

import type { MobxQueryClient } from './mobx-query-client';

export type AnyQueryClient = MobxQueryClient | QueryClient;

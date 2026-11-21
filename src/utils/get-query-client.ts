import type { AnyQueryClient } from '../query-client.types.js';

/**
 * INTERNAL API. Not for public usage
 */
export const getQueryClient = (queryOrMutation: any): AnyQueryClient => {
  return queryOrMutation.config.queryClient;
};

import type { AnyQueryClient } from '../query-client.types.js';

const mountedQcs = new WeakSet<AnyQueryClient>();

/**
 * INTERNAL API. Not for public usage
 */
export const mountQueryClientOnce = (queryClient: AnyQueryClient) => {
  if (!mountedQcs.has(queryClient)) {
    mountedQcs.add(queryClient);
    queryClient.mount();
  }
};

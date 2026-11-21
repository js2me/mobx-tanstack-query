// Run pnpm build, then NODE_ENV=production node --expose-gc scripts/bench-lifecycle.mjs
import { performance } from 'node:perf_hooks';
import { Mutation, Query, QueryClient } from '../dist/index.js';

const size = 4000;
const queryFn = async () => 1;
const mutationFn = async () => 1;

function sample(kind, count) {
  const client = new QueryClient({
    defaultOptions: { queries: { gcTime: Infinity } },
  });
  const instances = [];
  global.gc();
  const initialHeap = process.memoryUsage().heapUsed;
  const start = performance.now();
  for (let i = 0; i < count; i++) {
    if (kind === 'Query') {
      const query = new Query({
        queryClient: client,
        queryKey: [i],
        queryFn,
        enabled: false,
      });
      void query.result;
      instances.push(query);
    } else {
      instances.push(new Mutation({ queryClient: client, mutationFn }));
    }
  }
  const createMs = performance.now() - start;
  global.gc();
  const bytesEach = (process.memoryUsage().heapUsed - initialHeap) / count;
  const beforeDestroy = performance.now();
  for (const instance of instances) instance.destroy();
  const destroyMs = performance.now() - beforeDestroy;
  client.clear();
  return { createMs, bytesEach, destroyMs };
}

for (const kind of ['Query', 'Mutation']) {
  sample(kind, 1000);
  const sampleResult = sample(kind, size);
  console.log(JSON.stringify({ kind, size, ...sampleResult }));
}

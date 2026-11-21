---
"mobx-tanstack-query": major
---

`structuralSharing` is now on by default, unless `resultObservable` is `'deep'` or `true`. With the default, a refetch that returns equal data keeps the same `data` reference, so reactions on `data` don't fire. An explicit `structuralSharing: false` uses whatever the query function returns.

If `data` holds MobX observables or cyclic objects, set `structuralSharing: false`. TanStack's `replaceEqualDeep` copies observables into plain objects and breaks self-references. `@tanstack/query-core` before 5.90.17 also overflows the stack on cyclic data.

To keep the 7.x behavior for one query, set `structuralSharing: false` on it. The same option works on `InfiniteQuery`, `createQuery`, and `createInfiniteQuery`.

```ts
const query = new Query({
  queryClient,
  queryKey: ['todos'],
  queryFn: fetchTodos,
  structuralSharing: false,
});
```

To keep it for every query, set it in the `QueryClient` defaults.

```ts
const queryClient = new QueryClient({
  defaultOptions: {
    queries: { structuralSharing: false },
  },
});
```

The preset's `queryClient` is already created, so update its defaults. `setDefaultOptions` replaces them all, so spread in the current ones.

```ts
import { queryClient } from 'mobx-tanstack-query/preset';

const defaults = queryClient.getDefaultOptions();
queryClient.setDefaultOptions({
  ...defaults,
  queries: { ...defaults.queries, structuralSharing: false },
});
```

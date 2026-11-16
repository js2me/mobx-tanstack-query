---
"mobx-tanstack-query": minor
---

`structuralSharing` is on by default again, unless `resultObservable` is `'deep'` or `true`. With the default, a refetch that returns equal data keeps the same `data` reference, so reactions on `data` don't fire. An explicit `structuralSharing: false` uses whatever the query function returns.

If `data` can hold cyclic plain objects, set `structuralSharing: false`. `@tanstack/query-core` before 5.90.17 overflows the stack comparing them.

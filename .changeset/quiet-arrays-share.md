---
"mobx-tanstack-query": major
---

`structuralSharing` is on by default again, unless `resultObservable` is `'deep'` or `true`. With the default, a refetch that returns equal data keeps the same `data` reference, so reactions on `data` don't fire. An explicit `structuralSharing: false` uses whatever the query function returns.

If `data` holds MobX observables or cyclic objects, set `structuralSharing: false`. TanStack's `replaceEqualDeep` copies observables into plain objects and breaks self-references. `@tanstack/query-core` before 5.90.17 also overflows the stack on cyclic data.

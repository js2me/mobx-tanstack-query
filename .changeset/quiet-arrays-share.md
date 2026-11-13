---
"mobx-tanstack-query": minor
---

`structuralSharing` is on by default again, unless `resultObservable` is `'deep'` or `true`. With the default, a refetch that returns equal data keeps the same `data` reference, so reactions on `data` don't fire. Data that holds a MobX observable or a cycle is used as-is, same as with `structuralSharing: false`.

An explicit `structuralSharing: true` runs TanStack's `replaceEqualDeep` on all data. It copies observables into plain objects and breaks self-references in cyclic data.

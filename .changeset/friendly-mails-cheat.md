---
"mobx-tanstack-query": major
---

Changed the global default for `resultObservable` from `'deep'` to `'ref'` for both `Query` and `Mutation`.

If your app relies on deep MobX tracking of nested fields inside query or mutation results, set `resultObservable: 'deep'` explicitly (locally or via `QueryClient` defaults).

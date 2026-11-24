---
"mobx-tanstack-query": minor
---

`Query` and `InfiniteQuery` result properties like `data` and `isFetching` are MobX computeds now. A derivation that reads `query.data` reruns when `data` changes, and no longer on every fetch-state change. With `structuralSharing`, a refetch that returns equal data doesn't rerun a computed that maps `data`.

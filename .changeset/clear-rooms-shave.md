---
"mobx-tanstack-query": minor
---

Expose `promise` property on Query and InfiniteQuery for Suspense integration (#28)

The `promise` property is already provided by TanStack Query's `QueryObserverResult` but was not proxied by the library. It can be used to wait for the query to complete, or with `React.use(query.promise)` for Suspense integration when `experimental_prefetchInRender: true` is enabled.

---
"mobx-tanstack-query": minor
---

`structuralSharing` is on by default again, unless `resultObservable` is `'deep'` or `true`. A refetch that returns equal data keeps the same `data` reference, so reactions on `data` don't fire

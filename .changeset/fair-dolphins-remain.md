---
"mobx-tanstack-query": major
---

Changed the `result` behavior after `destroy()` / abort.

Previously, a destroyed query instance kept returning its last locally observed `_result`.
Now, when `result` is read after destroy/abort, it is computed via `queryObserver.getOptimisticResult(this.options)`, so it reflects the latest cache snapshot for the last `queryKey` without restoring subscriptions.

This is a breaking change for consumers and tests that relied on the old "frozen result after destroy" behavior.

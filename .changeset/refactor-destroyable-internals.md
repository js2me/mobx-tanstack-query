---
"mobx-tanstack-query": major
---

### Breaking changes

- **Removed `protected abortController`** from `Query`, `InfiniteQuery`, and `Mutation`. Use `this._abortSignal` (can be `undefined`) and `this._destroyed` instead.

- **Removed `handleDestroy()`**. Override `destroy()` and guard against repeated calls before calling `super.destroy()`:

  ```ts
  // Before
  protected handleDestroy() { ... }

  // After
  destroy() {
    if (this._destroyed) return;
    super.destroy();
    // your cleanup
  }
  ```

- **`Destroyable` no longer calls `makeObservable(this)`**. Call it explicitly in your subclass constructor if needed.

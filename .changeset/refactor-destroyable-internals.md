---
"mobx-tanstack-query": major
---

### Breaking changes

- **Removed `protected abortController`** from `Query`, `InfiniteQuery`, and `Mutation`. Use `this._abortSignal` (can be `undefined`) and `this._destroyed` instead.

- **Removed `handleDestroy()`**. Override `destroy()` and call `super.destroy()` at the top:

  ```ts
  // Before
  protected handleDestroy() { ... }

  // After
  destroy() {
    super.destroy();
    // your cleanup
  }
  ```

- **`Destroyable` no longer calls `makeObservable(this)`**. Call it explicitly in your subclass constructor if needed.

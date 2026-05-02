---
"mobx-tanstack-query": major
---

### Breaking changes

- Removed deprecated `Destroyable.dispose()` — use `destroy()` or `Symbol.dispose` / `using` where supported.
- Removed `Mobx*` type aliases and `MobxQuery` / `MobxMutation` / `MobxInfiniteQuery` class aliases; import the canonical names (`Query`, `Mutation`, `InfiniteQuery`, `QueryOptions`, `DefaultOptions`, etc.).
- Removed deprecated query client aliases: `IQueryClient`, `QueryClientInterface`, `MobxDefaultOptions`, `MobxQueryClientHooks`, `MobxQueryClientConfig`.
- Removed `resetOnDispose` from query features and mutation options / defaults — use `resetOnDestroy` only.

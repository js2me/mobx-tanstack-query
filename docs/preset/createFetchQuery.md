# createFetchQuery

This is alternative for [`new FetchQuery()`](/api/FetchQuery#usage).

## API Signature

```ts
createFetchQuery(queryClient, options)
createFetchQuery(queryClient, () => options)
createFetchQuery(options)
createFetchQuery(() => options)
```

## Usage

```ts
import { createFetchQuery } from "mobx-tanstack-query/preset";

const query = createFetchQuery({
  params: {
    path: "/pets",
  },
});
```

### Config as a function

The whole `options` object can also be a function. MobX observables read inside it are tracked, so the query refetches when they change — just like [`new FetchQuery(() => ({ ... }))`](/api/FetchQuery#config-as-a-function). The `queryClient` is optional and defaults to the preset [`queryClient`](/preset/queryClient).

```ts
const query = createFetchQuery(() => ({
  params: { path: `/pets/${activePetId.get()}` },
}));
```

## QueryClient `mount()`

TanStack Query expects the [`QueryClient`](/api/QueryClient) to be **mounted** so observers, refetch scheduling, and related behavior work as intended.

After the `FetchQuery` is constructed, preset `createFetchQuery` calls `mountQueryClientOnce` for the **effective client** attached to that query (the default [`queryClient`](/preset/queryClient) from the preset, or the `queryClient` you pass in options). Each client instance is only mounted once across the process (`WeakSet` inside [`mountQueryClientOnce`](/src/utils/mount-query-client-once.ts)), so many `createFetchQuery` calls against the same client do not stack `mount()` work.

If you use [`new FetchQuery(...)`](/api/FetchQuery#usage) without this preset, you must arrange `queryClient.mount()` yourself when your setup requires it, as described in the [`Query`](/api/Query) docs.

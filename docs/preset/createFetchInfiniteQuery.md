# createFetchInfiniteQuery

This is alternative for [`new FetchInfiniteQuery()`](/api/FetchInfiniteQuery#usage).

## API Signature

```ts
createFetchInfiniteQuery(queryClient, options)
createFetchInfiniteQuery(options)
```

## Usage

```ts
import { createFetchInfiniteQuery } from "mobx-tanstack-query/preset";

const query = createFetchInfiniteQuery({
  params: ({ pageParam }) => ({
    path: "/pets",
    query: { page: pageParam ?? 1 },
  }),
  initialPageParam: 1,
  getNextPageParam: (lastPage, _, lastPageParam) => {
    return lastPage.length ? lastPageParam + 1 : null;
  },
});
```

## QueryClient `mount()`

TanStack Query expects the [`QueryClient`](/api/QueryClient) to be **mounted** so observers, refetch scheduling, and related behavior work as intended.

After the `FetchInfiniteQuery` is constructed, preset `createFetchInfiniteQuery` calls `mountQueryClientOnce` for the **effective client** attached to that query (the default [`queryClient`](/preset/queryClient) from the preset, or the `queryClient` you pass in options). Each client instance is only mounted once across the process (`WeakSet` inside [`mountQueryClientOnce`](/src/utils/mount-query-client-once.ts)), so many `createFetchInfiniteQuery` calls against the same client do not stack `mount()` work.

If you use [`new FetchInfiniteQuery(...)`](/api/FetchInfiniteQuery#usage) without this preset, you must arrange `queryClient.mount()` yourself when your setup requires it, as described in the [`Query`](/api/Query) docs.

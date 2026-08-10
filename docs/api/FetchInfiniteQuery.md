# FetchInfiniteQuery

A [`FetchQuery`](/api/FetchQuery) for paginated data — same declarative `params` API, but with built-in page navigation.

Like [`FetchQuery`](/api/FetchQuery), it auto-generates `queryKey` from `params` and handles the HTTP request for you. The difference is that `params` receives a `pageParam` argument, and you control pagination via `getNextPageParam`.

**All properties and methods** (`data`, `isLoading`, `error`, `fetchNextPage`, `hasNextPage`, etc.) are inherited from [`InfiniteQuery`](/api/InfiniteQuery).

[Reference to source code](/src/fetch-infinite-query.ts)

## Usage

```ts
const starsQuery = new FetchInfiniteQuery({
  queryClient,
  params: ({ pageParam }) => ({
    path: '/stars',
    query: {
      count: 20,
      page: pageParam,
    },
  }),
  initialPageParam: 1,
  getNextPageParam: (lastPage, _, lastPageParam) => {
    return lastPage.length ? lastPageParam + 1 : null;
  },
});
```

### Manual control with `start()`

Create a `FetchInfiniteQuery` without `params` (disabled by default), then fetch manually:

```ts
const starsQuery = new FetchInfiniteQuery({
  queryClient,
  initialPageParam: 1,
  getNextPageParam: (lastPage, _, lastPageParam) => {
    return lastPage.length ? lastPageParam + 1 : null;
  },
});

const result = await starsQuery.start({
  params: ({ pageParam }) => ({
    path: '/stars',
    query: { count: 20, page: pageParam },
  }),
});
```

### How it works

1. `params` is a function that receives `{ pageParam }` — the current page parameter (starts at `initialPageParam`)
2. Each page request uses the same `params` logic with a different `pageParam`
3. After each page loads, `getNextPageParam` determines the next page parameter — return `null` to indicate no more pages
4. `data` is an array of all fetched pages, and `fetchNextPage()` triggers the next request

### Config as a function

Like [`FetchQuery`](/api/FetchQuery), the whole config object can be a function. MobX observables read inside it are tracked, so the query reacts to their changes.

```ts
const starsQuery = new FetchInfiniteQuery(() => ({
  queryClient,
  params: ({ pageParam }) => ({
    path: '/stars',
    query: { count: 20, page: pageParam },
  }),
  initialPageParam: 1,
  getNextPageParam: (lastPage, _, lastPageParam) =>
    lastPage.length ? lastPageParam + 1 : null,
}));
```

### Example: cursor-based pagination

```ts
const commentsQuery = new FetchInfiniteQuery({
  queryClient,
  params: ({ pageParam }) => ({
    path: '/comments',
    query: { cursor: pageParam },
  }),
  initialPageParam: undefined as string | undefined,
  getNextPageParam: (lastPage) => lastPage.nextCursor ?? null,
});
```

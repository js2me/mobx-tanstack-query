# FetchInfiniteQuery

Class wrapper for HTTP fetch-based infinite queries with **MobX** reactivity, extending [`InfiniteQuery`](/api/InfiniteQuery)

[_See docs for Query_](/api/Query)

**All documentation about properties and methods of infinite fetch query can be found in the original documentation [here](https://tanstack.com/query/latest/docs/framework/react/reference/useInfiniteQuery)**

[Reference to source code](/src/fetch-infinite-query.ts)

## Usage

Create an instance of `FetchInfiniteQuery` with `params` parameter instead of `queryFn` and `queryKey`

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

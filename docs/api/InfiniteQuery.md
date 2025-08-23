# InfiniteQuery  

Class wrapper for [@tanstack-query/core infinite queries](https://tanstack.com/query/latest/docs/framework/react/guides/infinite-queries) with **MobX** reactivity  

[_See docs for Query_](/api/Query)  

**All documentation about properties and methods of infinite query can be found in the original documentation [here](https://tanstack.com/query/latest/docs/framework/react/reference/useInfiniteQuery)**  

[Reference to source code](/src/infinite-query.ts)  

## Usage  

Create an instance of `InfiniteQuery` with [`queryKey`](https://tanstack.com/query/latest/docs/framework/react/guides/query-keys) and [`queryFn`](https://tanstack.com/query/latest/docs/framework/react/guides/query-functions) parameters

```ts
const query = new InfiniteQuery({
  queryClient,
  abortSignal: this.abortSignal,
  queryKey: ['stars']
  queryFn: async ({ signal, pageParam }) => {
    const response = await starsApi.fetchStarsList(
      {
        count: 20,
        page: pageParam,
      },
      {
        signal,
      },
    );

    return response.data;
  },
  initialPageParam: 1,
  onError: (e) => {
    notify({
      type: 'danger',
      title: 'Failed to load stars',
    });
  },
  getNextPageParam: (lastPage, _, lastPageParam) => {
    return lastPage.length ? lastPageParam + 1 : null;
  },
});  
```  

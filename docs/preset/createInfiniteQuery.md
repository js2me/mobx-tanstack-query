# createInfiniteQuery  

This is alternative for `new InfiniteQuery()`.  

## API Signature  

```ts
createInfiniteQuery(queryFn, otherOptionsWithoutFn?)
```

## Usage  
```ts
import { createInfiniteQuery } from "mobx-tanstack-query/preset";

const query = createInfiniteQuery(async ({
  signal,
  queryKey,
  pageParam,
}) => {
  const response = await petsApi.fetchPetsApi({ signal, pageParam })
  return response.data;
}, {
  initialPageParam: 1,
  queryKey: ['pets'],
  getNextPageParam: (lastPage, _, lastPageParam) => {
    return lastPage.length ? lastPageParam + 1 : null;
  },
});
```

# createQuery  

This is alternative for [`new Query()`](/api/Query#usage).  

## API Signature  

```ts
createQuery(queryFn, otherOptionsWithoutFn?)
createQuery(queryOptions?)
createQuery(queryClient, options: () => QueryOptions)
```  

## Usage  
```ts
import { createQuery } from "mobx-tanstack-query/preset";

const query = createQuery(async ({ signal, queryKey }) => {
  const response = await petsApi.fetchPets({ signal });
  return response.data;
}, {
  queryKey: ['pets'],
})
```

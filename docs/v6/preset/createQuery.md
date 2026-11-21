# createQuery  

This is alternative for [`new Query()`](/v6/api/Query#usage).  

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

## QueryClient `mount()`

TanStack Query expects the [`QueryClient`](/v6/api/QueryClient) to be **mounted** so observers, refetch scheduling, and related behavior work as intended.

After the `Query` is constructed, preset `createQuery` calls `mountQueryClientOnce` for the **effective client** attached to that query (the default [`queryClient`](/v6/preset/queryClient) from the preset, or the `queryClient` you pass in options). Each client instance is only mounted once across the process (`WeakSet` inside [`mountQueryClientOnce`](/src/utils/mount-query-client-once.ts)), so many `createQuery` calls against the same client do not stack `mount()` work.

If you use [`new Query(...)`](/v6/api/Query#usage) without this preset, you must arrange `queryClient.mount()` yourself when your setup requires it, as described in the [`Query`](/v6/api/Query) docs.

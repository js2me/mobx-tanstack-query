# Query  

Class wrapper for [@tanstack-query/core queries](https://tanstack.com/query/latest/docs/framework/react/guides/queries) with **MobX** reactivity  

[Reference to source code](/src/query.ts)  

## Usage  

Create an instance of `Query` with [`queryKey`](https://tanstack.com/query/latest/docs/framework/react/guides/query-keys) and [`queryFn`](https://tanstack.com/query/latest/docs/framework/react/guides/query-functions) parameters

```ts
const query = new Query({
  queryClient,
  abortSignal, // Helps you to automatically clean up query  
  queryKey: ['pets'],
  queryFn: async ({ signal, queryKey }) => {
    const response = await petsApi.fetchPets({ signal });
    return response.data;
  },
});  
```  


## Features  

### `enableOnDemand` option  
Query will be disabled until you request result for this query  
Example:  
```ts
const query = new Query({
  //...
  enableOnDemand: true
});
// happens nothing
query.result.data; // from this code line query starts fetching data
```

This option works as is if query will be "enabled", otherwise you should enable this query.   
```ts
const query = new Query({
  enabled: false,
  enableOnDemand: true, 
  queryFn: () => {},
});
query.result.data; // nothing happened because query is disabled.   
```
But if you set `enabled` as `true` and option `enableOnDemand` will be `true` too then query will be fetched only after user will try to get access to result.    
```ts
const query = new Query({
  enabled: true,
  enableOnDemand: true, 
  queryFn: () => {},
});
...
// query is not fetched
...
// query is not fetched
query.result.data; // query starts execute the queryFn
```

### dynamic `options`   
Options which can be dynamically updated for this query   

```ts
const query = new Query({
  // ...
  options: () => ({
    enabled: this.myObservableValue > 10,
    queryKey: ['foo', 'bar', this.myObservableValue] as const,
  }),
  queryFn: ({ queryKey }) => {
    const myObservableValue = queryKey[2];
  }
});
```

### dynamic `queryKey`  
Works the same as dynamic `options` option but only for `queryKey`   
```ts
const query = new Query({
  // ...
  queryKey: () => ['foo', 'bar', this.myObservableValue] as const,
  queryFn: ({ queryKey }) => {
    const myObservableValue = queryKey[2];
  }
});
```  
P.S. you can combine it with dynamic (out of box) `enabled` property   
```ts
const query = new Query({
  // ...
  queryKey: () => ['foo', 'bar', this.myObservableValue] as const,
  enabled: ({ queryKey }) => queryKey[2] > 10,
  queryFn: ({ queryKey }) => {
    const myObservableValue = queryKey[2];
  }
});
```  

### method `start(params)`   

Enable query if it is disabled then fetch the query.    

### method `update()`   

Update options for query (Uses [QueryObserver](https://tanstack.com/query/latest/docs/reference/QueriesObserver).setOptions)  

### hook `onDone()`  

Subscribe when query has been successfully fetched data  

### hook `onError()`  

Subscribe when query has been failed fetched data  

### method `invalidate()`  

Invalidate current query  (Uses [queryClient.invalidateQueries](https://tanstack.com/query/latest/docs/reference/QueryClient/#queryclientinvalidatequeries))  

### method `reset()`  

Reset current query  (Uses [queryClient.resetQueries](https://tanstack.com/query/latest/docs/reference/QueryClient#queryclientresetqueries))  

### method `setData()`  

Set data for current query  (Uses [queryClient.setQueryData](https://tanstack.com/query/latest/docs/reference/QueryClient#queryclientsetquerydata))  

### property `isResultRequsted`  
Any time when you trying to get access to `result` property this field sets as `true`  
This field is needed for `enableOnDemand` option    
This property if **observable**  

### property `result`  

**Observable** query result (The same as returns the [`useQuery` hook](https://tanstack.com/query/latest/docs/framework/react/reference/useQuery))   




## About `enabled`  
All queries are `enabled` (docs can be found [here](https://tanstack.com/query/latest/docs/framework/react/reference/useQuery)) by default, but you can set `enabled` as `false` or use dynamic value like `({ queryKey }) => !!queryKey[1]`   
You can use `update` method to update value for this property or use dynamic options construction (`options: () => ({ enabled: !!this.observableValue })`)   


## About `refetchOnWindowFocus` and `refetchOnReconnect`  

They **will not work if** you will not call `mount()` method manually of your `QueryClient` instance which you send for your queries, all other cases dependents on query `stale` time and `enabled` properties.  
Example:  

```ts
import { hashKey, QueryClient } from '@tanstack/query-core';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      throwOnError: true,
      queryKeyHashFn: hashKey,
      refetchOnWindowFocus: 'always',
      refetchOnReconnect: 'always',
      staleTime: 5 * 60 * 1000,
      retry: (failureCount, error) => {
        if ('status' in error && Number(error.status) >= 500) {
          return failureCount < 3;
        }
        return false;
      },
    },
    mutations: {
      throwOnError: true,
    },
  },
});

queryClient.mount(); // enable all subscriptions for online\offline and window focus/blur
```

If you work with [`QueryClient`](/api/QueryClient) then calling `mount()` is not needed.     
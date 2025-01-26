<img src="assets/logo.png" align="right" height="156" alt="logo" />

# mobx-tanstack-query  

[![NPM version][npm-image]][npm-url] [![test status][github-test-actions-image]][github-actions-url] [![build status][github-build-actions-image]][github-actions-url] [![npm download][download-image]][download-url] [![bundle size][bundlephobia-image]][bundlephobia-url]


[npm-image]: http://img.shields.io/npm/v/mobx-tanstack-query.svg
[npm-url]: http://npmjs.org/package/mobx-tanstack-query
[github-test-actions-image]: https://github.com/js2me/mobx-tanstack-query/workflows/Test/badge.svg
[github-build-actions-image]: https://github.com/js2me/mobx-tanstack-query/workflows/Build/badge.svg
[github-actions-url]: https://github.com/js2me/mobx-tanstack-query/actions
[download-image]: https://img.shields.io/npm/dm/mobx-tanstack-query.svg
[download-url]: https://npmjs.org/package/mobx-tanstack-query
[bundlephobia-url]: https://bundlephobia.com/result?p=mobx-tanstack-query
[bundlephobia-image]: https://badgen.net/bundlephobia/minzip/mobx-tanstack-query


_**MobX** wrapper for [**Tanstack Query Core**](https://tanstack.com/query/latest) package_


## What package supports    

# [**Queries**](https://tanstack.com/query/latest/docs/framework/react/guides/queries) -> [**MobxQuery**](src/mobx-query.ts)  

Class wrapper for [@tanstack-query/core queries](https://tanstack.com/query/latest/docs/framework/react/guides/queries) with MobX reactivity  

#### Usage  

Create an instance of MobxQuery with [`queryKey`](https://tanstack.com/query/latest/docs/framework/react/guides/query-keys) and [`queryFn`](https://tanstack.com/query/latest/docs/framework/react/guides/query-functions) parameters
```ts
const query = new MobxQuery({
  queryClient,
  abortSignal, // Helps you to automatically clean up query  
  queryKey: ['pets'],
  queryFn: async ({ signal, queryKey }) => {
    const response = await petsApi.fetchPets({ signal });
    return response.data;
  },
});  
```  

### Features  

#### `enableOnDemand` option  
Query will be disabled until you request result for this query  
Example:  
```ts
const query = new MobxQuery({
  //...
  enableOnDemand: true
});
// happens nothing
query.result.data; // from this code line query starts fetching data
```

#### dynamic `options`   
Options which can be dynamically updated for this query   

```ts
const query = new MobxQuery({
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

#### dynamic `queryKey`  
Works the same as dynamic `options` option but only for `queryKey`   
```ts
const query = new MobxQuery({
  // ...
  queryKey: () => ['foo', 'bar', this.myObservableValue] as const,
  queryFn: ({ queryKey }) => {
    const myObservableValue = queryKey[2];
  }
});
```  
P.S. you can combine it with dynamic (out of box) `enabled` property   
```ts
const query = new MobxQuery({
  // ...
  queryKey: () => ['foo', 'bar', this.myObservableValue] as const,
  enabled: ({ queryKey }) => queryKey[2] > 10,
  queryFn: ({ queryKey }) => {
    const myObservableValue = queryKey[2];
  }
});
```  

#### method `update()`   

Update options for query (Uses [QueryObserver](https://tanstack.com/query/latest/docs/reference/QueriesObserver).setOptions)  

#### hook `onDone()`  

Subscribe when query has been successfully fetched data  

#### hook `onError()`  

Subscribe when query has been failed fetched data  

#### method `invalidate()`  

Invalidate current query  (Uses [queryClient.invalidateQueries](https://tanstack.com/query/latest/docs/reference/QueryClient/#queryclientinvalidatequeries))  

#### method `reset()`  

Reset current query  (Uses [queryClient.resetQueries](https://tanstack.com/query/latest/docs/reference/QueryClient#queryclientresetqueries))  

#### method `setData()`  

Set data for current query  (Uses [queryClient.setQueryData](https://tanstack.com/query/latest/docs/reference/QueryClient#queryclientsetquerydata))  

#### property `isResultRequsted`  
Any time when you trying to get access to `result` property this field sets as `true`  
This field is needed for `enableOnDemand` option    
This property if **observable**  

#### property `result`  

**Observable** query result (The same as returns the [`useQuery` hook](https://tanstack.com/query/latest/docs/framework/react/reference/useQuery))   



### About `enabled`  
All queries are `enabled` (docs can be found [here](https://tanstack.com/query/latest/docs/framework/react/reference/useQuery)) by default, but you can set `enabled` as `false` or use dynamic value like `({ queryKey }) => !!queryKey[1]`   
You can use `update` method to update value for this property or use dynamic options construction (`options: () => ({ enabled: !!this.observableValue })`)   


### About `refetchOnWindowFocus` and `refetchOnReconnect`  

They **will not work if** you will not call `mount()` method manually of your `QueryClient` instance which you send for your queries, all other cases dependents on query `stale` time and `enabled` properties.  
Example:  

```ts
import { hashKey, QueryClient } from '@tanstack/query-core';

const MAX_FAILURE_COUNT = 3;

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
          return MAX_FAILURE_COUNT - failureCount > 0;
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

















































# [**Mutations**](https://tanstack.com/query/latest/docs/framework/react/guides/mutations) -> [**MobxMutation**](src/mobx-mutation.ts)  

Class wrapper for [@tanstack-query/core mutations](https://tanstack.com/query/latest/docs/framework/react/guides/mutations) with MobX reactivity  

#### Usage  

Create an instance of MobxMutation with [`mutationFn`](https://tanstack.com/query/latest/docs/framework/react/guides/mutations) parameter
```ts
const mutation = new MobxMutation({
  queryClient,
  abortSignal, // Helps you to automatically clean up mutation  
  mutationFn: async ({ signal, queryKey }) => {
    const response = await petsApi.createPet({ name: 'Fluffy' }, { signal });
    return response.data;
  },
});  
```  

### Features

### method `mutate(variables, options?)`  

Runs the mutation. (Works the as `mutate` function in [`useMutation` hook](https://tanstack.com/query/latest/docs/framework/react/reference/useMutation))  

#### hook `onDone()`  

Subscribe when mutation has been successfully finished  

#### hook `onError()`  

Subscribe when mutation has been finished with failure  

#### method `reset()`  

Reset current mutation  

#### property `result`  

**Observable** mutation result (The same as returns the [`useMutation` hook](https://tanstack.com/query/latest/docs/framework/react/reference/useMutation))   

































# [**InfiniteQueries**](https://tanstack.com/query/latest/docs/framework/react/guides/infinite-queries) -> [**MobxInfiniteQuery**](src/mobx-infinite-query.ts)  

# [**QueryClient**](https://tanstack.com/query/latest/docs/reference/QueryClient) -> [**MobxQueryClient**](src/mobx-query-client.ts)   

This is the same entity as `QueryClient` from **@tanstack-query/core** package, but has a bit improvenments like `hooks` and configurations for Mobx* like entities   


[_See docs for MobxQuery_](https://github.com/js2me/mobx-tanstack-query?tab=readme-ov-file#queries---mobxquery)  




# `InferQuery`, `InferMutation`, `InferInfiniteQuery` types   

This types are needed to infer some other types from mutations\configs.   

```ts
type MyData = InferMutation<typeof myMutation, 'data'>
type MyVariables = InferMutation<typeof myMutation, 'variables'>
type MyConfig = InferMutation<typeof myMutation, 'config'>
```

# `MobxQueryConfigFromFn`, `MobxMutationConfigFromFn`, `MobxInfiniteQueryConfigFromFn`   

This types are needed to create configuration types from your functions of your http client  

```ts
const myApi = {
  createApple: (name: string): Promise<AppleDC> => ... 
}

type Config = MobxMutationConfigFromFn<typeof myApi.createApple>
```


# Usage   

1. **Install dependencies**  

```bash
pnpm add @tanstack/query-core mobx-tanstack-query
```

2. **Create** [**QueryClient instance**](https://tanstack.com/query/v5/docs/reference/QueryClient)  

```ts
// @/shared/lib/tanstack-query/query-client.ts
import { hashKey, QueryClient } from '@tanstack/query-core';

const MAX_FAILURE_COUNT = 3;

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
          return MAX_FAILURE_COUNT - failureCount > 0;
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

3. **Use it**  
```ts
const petsListQuery = new MobxQuery({
  queryClient,
  queryKey: ['pets'],
  queryFn: async ({ signal, queryKey }) => {
    const response = await petsApi.fetchPets({ signal });
    return response.data;
  },
});

const addPetsMutation = new MobxMutation({
  queryClient,
  mutationFn: async (payload: { petName: string }) => {
    const response = await petsApi.createPet(payload);
    return response.data;
  },

  onSuccess: (data) => {
    rootStore.notifications.push({
      type: 'success',
      title: `Pet created successfully with name ${data.name}`,
    });
    petsListQuery.invalidate();
  },
  onError: (error) => {
    rootStore.notifications.push({
      type: 'danger',
      title: 'Failed to create pet',
    });
  }
});

addPetsMutation.mutate({ petName: 'fluffy' });
```


# Another usage or `mobx-tanstack-query/preset`  

This sub folder is contains already configured [instance of QueryClient](src/preset/query-client.ts) with [this configuration](src/preset/configs/default-query-client-config.ts) and needed to reduce your boilerplate with more compact way.  
Every parameter in configuration you can override using this construction  
```ts
import { queryClient } from "mobx-tanstack-query/preset";

const defaultOptions = queryClient.getDefaultOptions();
defaultOptions.queries!.refetchOnMount = true;
queryClient.setDefaultOptions({ ...defaultOptions })
```


P.S. Overriding default options should be written before start whole application  


### `createQuery(queryFn, otherOptionsWithoutFn?)`  

This is alternative for `new MobxQuery()`. Example:  

```ts
import { createQuery } from "mobx-tanstack-query/preset";

const query = createQuery(async ({ signal, queryKey }) => {
  const response = await petsApi.fetchPets({ signal });
  return response.data;
}, {
  queryKey: ['pets'],
})
```

### `createMutation(mutationFn, otherOptionsWithoutFn?)`  

This is alternative for `new MobxMutation()`. Example:  

```ts
import { createMutation } from "mobx-tanstack-query/preset";

const mutation = createMutation(async (payload: { petName: string }) => {
  const response = await petsApi.createPet(payload);
  return response.data;
})
```


### `createInfiniteQuery(queryFn, otherOptionsWithoutFn?)`  

This is alternative for `new MobxInfiniteQuery()`. Example:  

```ts
import { createInfiniteQuery } from "mobx-tanstack-query/preset";

const query = createInfiniteQuery(async ({ signal, queryKey }) => {
  const response = await petsApi.fetchPets({ signal });
  return response.data;
})
```


## Project examples  

- **HTTP Status Codes**  
Simple usage `MobX` Tanstack queries to fetch JSON data from GitHub  
_Links_:  
  - Source: https://github.com/js2me/http-status-codes  
  - GitHub Pages: https://js2me.github.io/http-status-codes/#/  


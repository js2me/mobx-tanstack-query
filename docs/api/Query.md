# Query

Class wrapper for [@tanstack-query/core queries](https://tanstack.com/query/latest/docs/framework/react/guides/queries) with **MobX** reactivity

**All documentation about properties and methods of query can be found in the original documentation [here](https://tanstack.com/query/latest/docs/framework/react/reference/useQuery)**

[Reference to source code](/src/query.ts)

## Usage

There are two ways to use queries:

### 1. Automatic enabling\disabling of queries

This approach is suitable when we want the query to automatically make a request and process the data  
depending on the availability of the necessary data.

Example:

```ts
const petName = observable.box<string>();

const petQuery = new Query(queryClient, () => ({
  queryKey: ["pets", petName.get()] as const,
  enabled: !!petName.get(), // dynamic
  queryFn: async ({ queryKey }) => {
    const petName = queryKey[1]!;
    const response = await petsApi.getPetByName(petName);
    return await response.json();
  },
}));

// petQuery is not enabled
petQuery.options.enabled;

petName.set("Fluffy");

// petQuery is enabled
petQuery.options.enabled;
```

### 2. Manual control of query fetching

This approach is suitable when we need to manually load data using a query.

Example:

```ts
const petQuery = new Query({
  queryClient,
  queryKey: ["pets", undefined as string | undefined] as const,
  enabled: false,
  queryFn: async ({ queryKey }) => {
    const petName = queryKey[1]!;
    const response = await petsApi.getPetByName(petName);
    return await response.json();
  },
});

const result = await petQuery.start({
  queryKey: ["pets", "Fluffy"],
});

console.log(result.data);
```

### Another examples

Create an instance of `Query` with [`queryKey`](https://tanstack.com/query/latest/docs/framework/react/guides/query-keys) and [`queryFn`](https://tanstack.com/query/latest/docs/framework/react/guides/query-functions) parameters

```ts
const petsQuery = new Query({
  queryClient,
  abortSignal, // Helps you to automatically clean up query or use `lazy` option
  queryKey: ['pets'],
  queryFn: async ({ signal, queryKey }) => {
    const response = await petsApi.fetchPets({ signal });
    return await response.json();
  },
});

...

console.log(
  petsQuery.data,
  petsQuery.isLoading
)
```

::: info This query is enabled by default!
This means that the query will immediately call the `queryFn` function,  
i.e., make a request to `fetchPets`  
This is the default behavior of queries according to the [**query documtation**](https://tanstack.com/query/latest/docs/framework/react/guides/queries)  
:::

## Properties and methods

#### `data: TData | undefined`

The last successfully resolved data for the query.

Example:

```ts
const query = new Query(queryClient, () => ({
  queryKey: ["pets"],
  queryFn: async () => api.fetchPets(),
}));

console.log(query.data);
```

#### `dataUpdatedAt: number`

The timestamp for when the query most recently returned the `status` as `"success"`.

#### `error: TError | null`

The error object for the query, if an error was thrown.

- Defaults to `null`.

Example:

```ts
const query = new Query(queryClient, () => ({
  queryKey: ["pets"],
  queryFn: async () => api.fetchPets(),
}));

console.log(query.error);
```

::: info You can transform output of this property using `transformError` option
:::

#### `errorUpdatedAt: number`

The timestamp for when the query most recently returned the `status` as `"error"`.

#### `failureCount: number`

The failure count for the query.

- Incremented every time the query fails.
- Reset to `0` when the query succeeds.

#### `failureReason: TError | null`

The failure reason for the query retry.

- Reset to `null` when the query succeeds.

#### `errorUpdateCount: number`

The sum of all errors.

#### `isError: boolean`

A derived boolean from the `status` variable, provided for convenience.

- `true` if the query attempt resulted in an error.

#### `isFetched: boolean`

Will be `true` if the query has been fetched.

#### `isFetching: boolean`

A derived boolean from the `fetchStatus` variable, provided for convenience.

- `true` whenever the `queryFn` is executing, which includes initial `pending` as well as background refetch.

#### `isLoading: boolean`

Is `true` whenever the first fetch for a query is in-flight.

- Is the same as `isFetching && isPending`.

#### `isLoadingError: boolean`

Will be `true` if the query failed while fetching for the first time.

#### `isPaused: boolean`

A derived boolean from the `fetchStatus` variable, provided for convenience.

- The query wanted to fetch, but has been `paused`.

#### `isPlaceholderData: boolean`

Will be `true` if the data shown is the placeholder data.

#### `isRefetchError: boolean`

Will be `true` if the query failed while refetching.

#### `isRefetching: boolean`

Is `true` whenever a background refetch is in-flight, which _does not_ include initial `pending`.

- Is the same as `isFetching && !isPending`.

#### `isStale: boolean`

Will be `true` if the data in the cache is invalidated or if the data is older than the given `staleTime`.

#### `isSuccess: boolean`

A derived boolean from the `status` variable, provided for convenience.

- `true` if the query has received a response with no errors and is ready to display its data.

#### `status: QueryStatus`

The status of the query.

- Will be:
  - `pending` if there's no cached data and no query attempt was finished yet.
  - `error` if the query attempt resulted in an error.
  - `success` if the query has received a response with no errors and is ready to display its data.

Example:

```ts
const query = new Query(queryClient, () => ({
  queryKey: ["pets"],
  queryFn: async () => api.fetchPets(),
}));

console.log(query.status); // "pending" initially
// After some time when the query resolves:
console.log(query.status); // "success" if successful
// Or:
console.log(query.status); // "error" if there was an error
```

#### `fetchStatus: FetchStatus`

The fetch status of the query.

- `fetching`: Is `true` whenever the queryFn is executing, which includes initial `pending` as well as background refetch.
- `paused`: The query wanted to fetch, but has been `paused`.
- `idle`: The query is not fetching.
- See [Network Mode](https://tanstack.com/query/latest/docs/framework/react/guides/network-mode) for more information.

Example:

```ts
const query = new Query(queryClient, () => ({
  queryKey: ["pets"],
  queryFn: async () => api.fetchPets(),
}));

console.log(query.fetchStatus); // "idle" initially
// During fetch:
console.log(query.fetchStatus); // "fetching" when query is executing
// When fetch is paused:
console.log(query.fetchStatus); // "paused" when query is paused
```

Explanation of difference between `fetchStatus` and `status`:
- `status` indicates the overall result state of the query: "pending", "error", or "success"
- `fetchStatus` indicates the current fetching state of the query: "fetching", "paused", or "idle"
- A query can be in "fetching" state while still having a "pending" status, or it can be in "idle" state while having an "error" or "success" status

#### `options: QueryOptions<TQueryFnData, TError, TData, TQueryData, TQueryKey>`

The options used to configure the query.

#### `queryObserver: QueryObserver<TQueryFnData, TError, TData, TQueryData, TQueryKey>`

The underlying query observer instance.

#### `isResultRequsted: boolean` <Badge type="info" text="observable.ref" />

Any time when you trying to get access to `result` property this field sets as `true`  
This field is needed for `enableOnDemand` option  

#### `result: QueryObserverResult<TData, TError>`

**Observable** query result (The same as returns the [`useQuery` hook](https://tanstack.com/query/latest/docs/framework/react/reference/useQuery))

#### `setData(updater: Updater<NoInfer<TQueryFnData> | undefined, NoInfer<TQueryFnData> | undefined>, options?: SetDataOptions): TQueryFnData | undefined`

Set data for current query (Uses [queryClient.setQueryData](https://tanstack.com/query/latest/docs/reference/QueryClient#queryclientsetquerydata))

Example:

```ts
const query = new Query(queryClient, () => ({
  queryKey: ["pets"],
  queryFn: async () => api.fetchPets(),
}));

// Update data with a function
query.setData((oldData) => ({
  ...oldData,
  name: "Fluffy"
}));

// Update data with a new value
query.setData({
  id: 1,
  name: "Fluffy"
});
```

#### `update(optionsUpdate: QueryUpdateOptionsAllVariants<TQueryFnData, TError, TData, TQueryData, TQueryKey>): void`

Update options for query (Uses [QueryObserver](https://tanstack.com/query/latest/docs/reference/QueriesObserver).setOptions)

Example:

```ts
const query = new Query(queryClient, () => ({
  queryKey: ["pets"],
  queryFn: async () => api.fetchPets(),
}));

// Update query options
query.update({
  enabled: false,
  staleTime: 10000
});
```

#### `refetch(options?: RefetchOptions): Promise<QueryObserverResult<TData, TError>>`

Refetch the query data.

Example:

```ts
const query = new Query(queryClient, () => ({
  queryKey: ["pets"],
  queryFn: async () => api.fetchPets(),
}));

// Refetch the query
const result = await query.refetch();
console.log(result.data);
```

#### `reset(params?: QueryResetParams): Promise<void>`

Reset current query (Uses [queryClient.resetQueries](https://tanstack.com/query/latest/docs/reference/QueryClient#queryclientresetqueries))

Example:

```ts
const query = new Query(queryClient, () => ({
  queryKey: ["pets"],
  queryFn: async () => api.fetchPets(),
}));

// Reset the query
await query.reset();
```

#### `invalidate(params?: QueryInvalidateParams): Promise<void>`

Invalidate current query (Uses [queryClient.invalidateQueries](https://tanstack.com/query/latest/docs/reference/QueryClient/#queryclientinvalidatequeries))

Example:

```ts
const query = new Query(queryClient, () => ({
  queryKey: ["pets"],
  queryFn: async () => api.fetchPets(),
}));

// Invalidate the query
await query.invalidate();
```

#### `onDone(doneListener: QueryDoneListener<TData>): void`

Subscribe when query has been successfully fetched data

Example:

```ts
const query = new Query(queryClient, () => ({
  queryKey: ["pets"],
  queryFn: async () => api.fetchPets(),
}));

// Subscribe to successful fetch
query.onDone((data) => {
  console.log('Query completed successfully:', data);
});
```

#### `onError(errorListener: QueryErrorListener<TError>): void`

Subscribe when query has been failed fetched data

Example:

```ts
const query = new Query(queryClient, () => ({
  queryKey: ["pets"],
  queryFn: async () => api.fetchPets(),
}));

// Subscribe to fetch errors
query.onError((error) => {
  console.log('Query failed:', error);
});
```

#### `start(params?: QueryStartParams<TQueryFnData, TError, TData, TQueryData, TQueryKey>): Promise<QueryObserverResult<TData, TError>>`

Enable query if it is disabled then fetch the query.  
This method is helpful if you want manually control fetching your query

Example:

```ts
const query = new Query({
  queryClient,
  queryKey: ["pets", undefined as string | undefined] as const,
  enabled: false,
  queryFn: async ({ queryKey }) => {
    const petName = queryKey[1]!;
    const response = await petsApi.getPetByName(petName);
    return await response.json();
  },
});

// Manually start the query
const result = await query.start({
  queryKey: ["pets", "Fluffy"],
});
console.log(result.data);
```

#### `destroy(): void`

This method is necessary to kill all reactions and subscriptions that are created during the creation of an instance of the `Query` class

This is alternative for `abortSignal` option

Example:

```ts
const query = new Query(queryClient, () => ({
  queryKey: ["pets"],
  queryFn: async () => api.fetchPets(),
}));

// Clean up the query
query.destroy();
```


## Recommendations

### Don't forget about `abortSignal`s or `lazy` option

When creating a query, subscriptions to the original queries and reactions are created.  
If you don't clean up subscriptions and reactions - memory leaks can occur.

### Use `queryKey` to pass data to `queryFn`

`queryKey` is not only a cache key but also a way to send necessary data for our API requests!

Example

```ts
const petQuery = new Query(queryClient, () => ({
  queryKey: ["pets", "Fluffy"] as const,
  queryFn: async ({ queryKey }) => {
    const petName = queryKey[1]!;
    const response = await petsApi.getPetByName(petName);
    return await response.json();
  },
}));
```

## Built-in Features

### `abortSignal` option

This field is necessary to kill all reactions and subscriptions that are created during the creation of an instance of the `Query` class

```ts
const abortController = new AbortController();

const petsQuery = new Query({
  queryClient,
  abortSignal: abortController.signal,
  queryKey: ['pets'] as const,
  queryFn: async ({ signal }) => {
    const response = await petsApi.getAllPets({ signal });
    return await response.json();
  },
});

...
abortController.abort()
```

This is alternative for `destroy` method

### `destroy()` method

This method is necessary to kill all reactions and subscriptions that are created during the creation of an instance of the `Query` class

This is alternative for `abortSignal` option

### `enableOnDemand` option

Query will be disabled until you request result for this query  
Example:

```ts
const query = new Query({
  //...
  enableOnDemand: true,
});
// happens nothing
query.data; // from this code line query starts fetching data
```

This option works as is if query will be "enabled", otherwise you should enable this query.

```ts
const query = new Query({
  enabled: false,
  enableOnDemand: true,
  queryFn: () => {},
});
query.data; // nothing happened because query is disabled.
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
query.data; // query starts execute the queryFn
```

### dynamic `options`

Options which can be dynamically updated for this query

```ts
const query = new Query({
  // ...
  options: () => ({
    enabled: this.myObservableValue > 10,
    queryKey: ["foo", "bar", this.myObservableValue] as const,
  }),
  queryFn: ({ queryKey }) => {
    const myObservableValue = queryKey[2];
  },
});
```

### dynamic `queryKey`

Works the same as dynamic `options` option but only for `queryKey`

```ts
const query = new Query({
  // ...
  queryKey: () => ["foo", "bar", this.myObservableValue] as const,
  queryFn: ({ queryKey }) => {
    const myObservableValue = queryKey[2];
  },
});
```

P.S. you can combine it with dynamic (out of box) `enabled` property

```ts
const query = new Query({
  // ...
  queryKey: () => ["foo", "bar", this.myObservableValue] as const,
  enabled: ({ queryKey }) => queryKey[2] > 10,
  queryFn: ({ queryKey }) => {
    const myObservableValue = queryKey[2];
  },
});
```

### `lazy` option

This option enables "lazy" mode of the query. That means that all subscriptions and reaction will be created only when you request result for this query.

Example:

```ts
const query = createQuery(queryClient, () => ({
  lazy: true,
  queryKey: ["foo", "bar"] as const,
  queryFn: async () => {
    // api call
  },
}));

// happens nothing
// no reactions and subscriptions will be created
```

### method `start(params)`

Enable query if it is disabled then fetch the query.  
This method is helpful if you want manually control fetching your query

Example:

```ts

```

### method `update()`

Update options for query (Uses [QueryObserver](https://tanstack.com/query/latest/docs/reference/QueriesObserver).setOptions)

### hook `onDone()`

Subscribe when query has been successfully fetched data

### hook `onError()`

Subscribe when query has been failed fetched data

### method `invalidate()`

Invalidate current query (Uses [queryClient.invalidateQueries](https://tanstack.com/query/latest/docs/reference/QueryClient/#queryclientinvalidatequeries))

### method `reset()`

Reset current query (Uses [queryClient.resetQueries](https://tanstack.com/query/latest/docs/reference/QueryClient#queryclientresetqueries))

### method `setData()`

Set data for current query (Uses [queryClient.setQueryData](https://tanstack.com/query/latest/docs/reference/QueryClient#queryclientsetquerydata))

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
import { hashKey, QueryClient } from "@tanstack/query-core";

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      throwOnError: true,
      queryKeyHashFn: hashKey,
      refetchOnWindowFocus: "always",
      refetchOnReconnect: "always",
      staleTime: 5 * 60 * 1000,
      retry: (failureCount, error) => {
        if ("status" in error && Number(error.status) >= 500) {
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

// enable all subscriptions for online\offline and window focus/blur
queryClient.mount();
```

If you work with [`QueryClient`](/api/QueryClient) then calling `mount()` is not needed.

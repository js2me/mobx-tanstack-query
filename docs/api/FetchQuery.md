# FetchQuery

A [`Query`](/api/Query) that makes HTTP requests for you — no need to write `queryFn` or `queryKey` manually.

Instead of describing **how** to fetch data, you describe **what** to fetch using `params`:

```ts
// Query — you write the fetch logic yourself
new Query({
  queryClient,
  queryKey: ['/pets'],
  queryFn: () => fetch('/pets').then(r => r.json()),
})

// FetchQuery — just describe the request
new FetchQuery({
  queryClient,
  params: { path: '/pets' },
})
```

`FetchQuery` auto-generates `queryKey` from your `params`, so the cache stays consistent automatically.

**All properties and methods** (`data`, `isLoading`, `error`, `refetch`, etc.) are inherited from [`Query`](/api/Query).

[Reference to source code](/src/fetch-query.ts)

## Usage

### Basic GET request

```ts
const petsQuery = new FetchQuery({
  queryClient,
  params: {
    path: '/pets',
  },
});

console.log(petsQuery.data, petsQuery.isLoading);
```

### Dynamic params

`params` can be a function — when MobX observables inside it change, the query automatically refetches with new parameters. Return a falsy value to disable the query.

```ts
const petId = observable.box<string>();

const petQuery = new FetchQuery({
  queryClient,
  params: () => petId.get()
    ? { path: `/pets/${petId.get()}` }
    : null, // query is disabled while petId is empty
});
```

### Config as a function

The whole config object can also be a function. MobX observables read inside it are tracked, so the query refetches when they change — handy when `queryClient` or `params` depend on reactive state.

```ts
const petQuery = new FetchQuery(() => ({
  queryClient,
  params: { path: `/pets/${activePetId.get()}` },
}));
```

This is equivalent to passing the object form, but the function is re-evaluated reactively. `params` can still be a function on top of it for finer-grained reactivity.

### POST request with body

```ts
const createPetQuery = new FetchQuery({
  queryClient,
  params: () => ({
    path: '/pets',
    method: 'POST',
    body: { name: 'Fluffy', type: 'cat' },
  }),
});
```

### Full fetch configuration

```ts
const petQuery = new FetchQuery({
  queryClient,
  params: {
    baseUrl: 'https://api.example.com',
    path: '/pets',
    query: { limit: 10, sort: 'name' },
    method: 'GET',
    headers: { 'X-Custom-Header': 'value' },
    notFoundAsNull: true,
  },
});
```

## `FetchQueryParams`

- `path: string` — **Required.** The URL path for the request
- `baseUrl?: string` — Base URL prepended to `path`. Can also be set globally via [`QueryClient.fetchQueries`](/api/QueryClient#fetchqueries)
- `query?: Record<string, string | number | boolean | null | undefined>` — Query parameters to be serialized and appended to the URL
- `method?: string` — HTTP method. Defaults to `"GET"` (or `"POST"` when `body` is provided)
- `headers?: Record<string, string>` — Request headers. Merged with global headers from `QueryClient.fetchQueries`
- `body?: BodyInit | Record<string, unknown>` — Request body. Objects are JSON-serialized with `Content-Type: application/json`; native `BodyInit` (Blob, FormData, etc.) is passed through as-is
- `request?: Partial<RequestInit>` — Additional `RequestInit` options (except `signal`, `method`, `headers`, `body`)
- `notFoundAsNull?: boolean` — If `true`, a 404 response returns `null` instead of throwing
- `responseType?: ResponseType` — Method to read the response body (e.g. `"json"`, `"text"`, `"blob"`). Defaults to `"json"`
- `transformResponse?: TransformResponseFn` — Custom function to transform the `Response` object before data is returned
- `throwOnError?: boolean` — Whether to throw the raw `Response` on non-ok status. Defaults to `true`
- `meta?: QueryMeta` — Metadata attached to the query

## Manual control with `start()`

Create a `FetchQuery` without `params` (disabled by default), then fetch manually:

```ts
const petQuery = new FetchQuery({
  queryClient,
  // no params — query is disabled
});

const result = await petQuery.start({
  params: { path: '/pets/123' },
});

console.log(result.data);
```

## Request behavior

- Per-request `params` are **merged** with global defaults from [`QueryClient.fetchQueries`](/api/QueryClient#fetchqueries) (per-request values take precedence)
- The full URL is built as `baseUrl + path` with `query` params serialized and appended
- `queryKey` is auto-generated from `params` — you never set it manually

## Recommendations

### Use `QueryClient.fetchQueries` for global configuration

Instead of repeating `baseUrl`, `headers`, and other options in every `FetchQuery`, set them once on the `QueryClient`:

```ts
const queryClient = new QueryClient({
  fetchQueries: {
    baseUrl: 'https://api.example.com',
    headers: {
      Authorization: 'Bearer my-token',
    },
    throwOnError: true,
    timeout: 30_000,
  },
});
```

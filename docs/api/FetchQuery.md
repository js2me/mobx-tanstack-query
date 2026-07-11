# FetchQuery

Class wrapper for HTTP fetch-based queries with **MobX** reactivity, extending [`Query`](/api/Query)

[_See docs for Query_](/api/Query)

**All documentation about properties and methods of fetch query can be found in the [`Query`](/api/Query) documentation**

[Reference to source code](/src/fetch-query.ts)

## Usage

Create an instance of `FetchQuery` with `params` parameter instead of `queryFn` and `queryKey`

```ts
const petsQuery = new FetchQuery({
  queryClient,
  params: {
    path: '/pets',
  },
});

...

console.log(
  petsQuery.data,
  petsQuery.isLoading
)
```

`params` can be a function for dynamic queries. When `params` returns a falsy value, the query is automatically disabled.

```ts
const petId = observable.box<string>();

const petQuery = new FetchQuery({
  queryClient,
  params: () => petId.get()
    ? { path: `/pets/${petId.get()}` }
    : null,
});
```

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
- `headers?: Record<string>` — Request headers. Merged with global headers from `QueryClient.fetchQueries`
- `body?: BodyInit | Record<string, unknown>` — Request body. Objects are JSON-serialized with `Content-Type: application/json`; native `BodyInit` (Blob, FormData, etc.) is passed through as-is
- `request?: Partial<RequestInit>` — Additional `RequestInit` options (except `signal`, `method`, `headers`, `body`)
- `notFoundAsNull?: boolean` — If `true`, a 404 response returns `null` instead of throwing
- `responseType?: ResponseType` — Method to read the response body (e.g. `"json"`, `"text"`, `"blob"`). Defaults to `"json"`
- `transformResponse?: TransformResponseFn` — Custom function to transform the `Response` object before data is returned
- `throwOnError?: boolean` — Whether to throw the raw `Response` on non-ok status. Defaults to `true`
- `meta?: QueryMeta` — Metadata attached to the query

## How the request is made

`FetchQuery` uses `makeFetchRequest` under the hood which:

1. Reads global defaults from [`QueryClient.fetchQueries`](/api/QueryClient#fetchqueries) (`baseUrl`, `headers`, `throwOnError`, `transformResponse`, `credentials`, `mode`, `customFetch`, `timeout`)
2. Merges per-request `params` with global defaults
3. Serializes query params and builds the full URL
4. Handles body serialization (JSON for objects, passthrough for native `BodyInit`)
5. Supports request timeout via `AbortSignal.timeout()` (merged with the query's own abort signal)
6. Returns `null` on 404 when `notFoundAsNull` is set
7. Throws the raw `Response` on non-ok responses when `throwOnError` is `true` (default)
8. Applies `transformResponse` if provided, otherwise reads the response using `responseType`

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

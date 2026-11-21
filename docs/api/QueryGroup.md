# QueryGroup

Reactive aggregation over multiple [`Query`](/api/Query) and [`InfiniteQuery`](/api/InfiniteQuery) instances with **MobX** reactivity.

[Reference to source code](/src/group-queries.ts)

## Usage

Use the `groupQueries` utility to create a `QueryGroup`:

```ts
import { autorun } from "mobx";
import { groupQueries } from "mobx-tanstack-query";

const petsGroup = groupQueries([catsQuery, dogsQuery]);

autorun(() => {
  if (petsGroup.isSuccess) {
    console.log(petsGroup.data); // [cats, dogs]
  }
});
```

::: tip Similar to `useQueries` + `combine`
Unlike [`useQueries`](https://tanstack.com/query/latest/docs/framework/react/reference/useQueries) from the React adapter, `QueryGroup` does not create or subscribe queries — it aggregates **already created** `Query` / `InfiniteQuery` instances into a single reactive view.
:::

### Reactive queries list

The argument can be a function returning the list of queries.  
All observable values inside this function are tracked by **MobX**, so the group is recalculated when the list changes:

```ts{4}
const petsGroup = groupQueries(() => [
  catsQuery,
  // dogsQuery will be included into aggregation
  // only when withDogs becomes true
  settings.withDogs && dogsQuery,
]);
```

Falsy entries (`undefined`, `null`, `false`, ...) are ignored by the aggregated flags ([`isFetching`](#isfetching-boolean), [`isSuccess`](#issuccess-boolean), etc.), but keep their positions in [`data`](#data-querygroupdata) and [`errors`](#errors-querygrouperrors):

```ts
const group = groupQueries([catsQuery, null, dogsQuery]);

group.data; // [catsData, undefined, dogsData]
```

### Creating via class

`groupQueries` is just a shortcut for the `QueryGroup` constructor:

```ts
import { QueryGroup } from "mobx-tanstack-query";

const group = new QueryGroup(() => [catsQuery, dogsQuery]);
```

## Properties and methods

### `queries: QueryGroupItem[]`

All non-falsy queries in the group.

### `data: QueryGroupData`

Data of all queries in the group.  
Keeps positions of the input list, falsy entries are represented as `undefined`.

```ts
const group = groupQueries([catsQuery, dogsQuery]);

group.data; // [catsData | undefined, dogsData | undefined]
```

### `error: QueryGroupError`

The first non-null [`error`](/api/Query#error-terror-null) of the queries in the group, otherwise `null`.

### `errors: QueryGroupErrors`

Errors of all queries in the group.  
Keeps positions of the input list, falsy entries are represented as `null`.

### `isPending: boolean`

`true` if any query in the group is [`pending`](/api/Query#ispending-boolean).

### `isLoading: boolean`

`true` if any query in the group is [`loading`](/api/Query#isloading-boolean) (first fetch is in-flight).

### `isFetching: boolean`

`true` if any query in the group is [`fetching`](/api/Query#isfetching-boolean).

### `isRefetching: boolean`

`true` if any query in the group is [`refetching`](/api/Query#isrefetching-boolean).

### `isPaused: boolean`

`true` if any query in the group is [`paused`](/api/Query#ispaused-boolean).

### `isError: boolean`

`true` if any query in the group has an [`error`](/api/Query#iserror-boolean).

### `isSuccess: boolean`

`true` if **all** queries in the group are [`successfully fetched`](/api/Query#issuccess-boolean).

### `status: QueryStatus`

Aggregated [`status`](/api/Query#status-querystatus) of the group:

- `success` if all queries are succeeded
- `error` if any query has an error
- `pending` otherwise

### `fetchStatus: FetchStatus`

Aggregated [`fetchStatus`](/api/Query#fetchstatus-fetchstatus) of the group:

- `fetching` if any query is fetching
- `paused` if any query is paused
- `idle` otherwise

### `refetch(options?)`

[Refetches](/api/Query#refetch-options) all queries in the group.

```ts
await group.refetch();
```

---
title: Getting started
---

# Getting started

## Installation

::: warning Peer Dependency
@tanstack/query-core is a required peer dependency
:::

::: code-group

```bash [npm]
npm install @tanstack/query-core {packageJson.name}
```

```bash [pnpm]
pnpm add @tanstack/query-core {packageJson.name}
```

```bash [yarn]
yarn add @tanstack/query-core {packageJson.name}
```

:::

## React Integration

This library is architecturally decoupled from React and doesn't provide React-specific hooks.
For projects using React, we recommend leveraging the official [@tanstack/react-query](https://npmjs.com/package/@tanstack/react-query) package instead.
It offers first-class support for React hooks and follows modern React patterns.

The current React integration is implemented via `MobX` React bindings.

## Creating instance of [`QueryClient`](/api/QueryClient)

This is extended version of original [`QueryClient`](https://tanstack.com/query/v5/docs/reference/QueryClient)

```ts
import { QueryClient } from "mobx-tanstack-query";
import { hashKey } from "@tanstack/query-core";

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      throwOnError: true,
      queryKeyHashFn: hashKey,
      refetchOnWindowFocus: true,
      refetchOnReconnect: true,
      staleTime: 10 * 60 * 1000,
      retry: (failureCount, error) => {
        if (error instanceof Response && error.status >= 500) {
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
```

## Writing first queries

```ts
import { Query } from "mobx-tanstack-query";

const fruitQuery = new Query({
  queryClient,
  queryFn: async ({ queryKey }) => {
    const response = await fetch(`/api/fruits/${queryKey[1]}`);
    return await response.json();
  },
  queryKey: ["fruits", "apple"],
});
```

## Using with classes

```ts
import { observable, action } from "mobx";
import { Query } from "mobx-tanstack-query";

class MyViewModel {
  abortController = new AbortController();

  @observable
  accessor fruitName = "apple";

  fruitQuery = new Query({
    queryClient,
    abortSignal: this.abortController.signal, // Don't forget about that!
    queryFn: async ({ queryKey }) => {
      const response = await fetch(`/api/fruits/${queryKey[1]}`);
      return await response.json();
    },
    options: () => ({
      enabled: !!this.fruitName,
      queryKey: ["fruits", this.fruitName],
    }),
  });

  @action
  setFruitName(fruitName: string) {
    this.fruitName = fruitName;
  }

  destroy() {
    this.abortController.abort();
  }
}
```

## Using in React

```tsx
import { observer } from "mobx-react-lite";

const App = observer(() => {
  return <div>{fruitQuery.data?.name}</div>;
});
```

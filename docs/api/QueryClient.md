# QueryClient


An enhanced version of [TanStack's Query QueryClient](https://tanstack.com/query/v5/docs/reference/QueryClient).  
Adds specialized configurations for library entities like [`Query`](/api/Query) or [`Mutation`](/api/Mutation).  

[Reference to source code](/src/mobx-query-client.ts)  

## API Signature  
```ts
import { QueryClient } from "@tanstack/query-core";

class QueryClient extends QueryClient {
  constructor(config?: QueryClientConfig);
}
```

## Configuration   
When creating an instance, you can provide:
```ts
import { DefaultOptions } from '@tanstack/query-core';

interface QueryClientConfig {
  defaultOptions?: DefaultOptions & {
    queries: QueryFeatures;
    mutations: MobxMutatonFeatures;
  };
  hooks?: QueryClientHooks;
}
```

## Key methods and properties   

### `queryFeatures`  
Features configurations exclusively for [`Query`](/api/Query)/[`InfiniteQuery`](/api/InfiniteQuery)  

### `mutationFeatures`  
Features configurations exclusively for [`Mutation`](/api/Mutation)  

### `hooks`  
Entity lifecycle events. Available hooks:   

| Hook | Description |
|---|---|
| onQueryInit  | Triggered when a [`Query`](/api/Query) is created  |
| onInfiniteQueryInit | Triggered when a [`InfiniteQuery`](/api/InfiniteQuery) is created |
| onMutationInit  | Triggered when a [`Mutation`](/api/Mutation) is created |
| onQueryDestroy  | Triggered when a [`Query`](/api/Query) is destroyed |
| onInfiniteQueryDestroy  | Triggered when a [`InfiniteQuery`](/api/InfiniteQuery) is destroyed |
| onMutationDestroy  | Triggered when a [`Mutation`](/api/Mutation) is destroyed |

## Inheritance  
`QueryClient` inherits all methods and properties from [QueryClient](https://tanstack.com/query/v5/docs/reference/QueryClient), including:  
- [`getQueryData()`](https://tanstack.com/query/v5/docs/reference/QueryClient#queryclientgetquerydata)  
- [`setQueryData()`](https://tanstack.com/query/v5/docs/reference/QueryClient#queryclientsetquerydata)
- [`invalidateQueries()`](https://tanstack.com/query/v5/docs/reference/QueryClient#queryclientinvalidatequeries)
- [`prefetchQuery()`](https://tanstack.com/query/v5/docs/reference/QueryClient#queryclientprefetchquery)
- [`cancelQueries()`](https://tanstack.com/query/v5/docs/reference/QueryClient#queryclientcancelqueries)
- And others ([see official documentation](https://tanstack.com/query/v5/docs/reference/QueryClient))  

## Usage Example

```ts
import { QueryClient } from 'mobx-tanstack-query';

// Create a client with custom hooks
const client = new QueryClient({
  hooks: {
    onQueryInit: (query) => {
      console.log('[Init] Query:', query.queryKey);
    },
    onMutationDestroy: (mutation) => {
      console.log('[Destroy] Mutation:', mutation.options.mutationKey);
    }
  },
  defaultOptions: {
    queries: {
      enableOnDemand: true,
    },
    mutations: {
      invalidateByKey: true,
    }
  },
});

// Use standard QueryClient methods
const data = client.getQueryData(['todos']);
```

## When to Use?
Use `QueryClient` if you need:  
- Customization of query/mutation lifecycle
- Tracking entity initialization/destruction events
- Advanced configuration for `MobX`-powered queries and mutations.
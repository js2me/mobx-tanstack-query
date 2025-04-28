# MobxQueryClient


An enhanced version of [TanStack's Query QueryClient](https://tanstack.com/query/v5/docs/reference/QueryClient).  
Adds specialized configurations for library entities like [`MobxQuery`](/api/MobxQuery) or [`MobxMutation`](/api/MobxMutation).  

[Reference to source code](/src/mobx-query-client.ts)  

## API Signature  
```ts
import { QueryClient } from "@tanstack/query-core";

class MobxQueryClient extends QueryClient {
  constructor(config?: MobxQueryClientConfig);
}
```

## Configuration   
When creating an instance, you can provide:
```ts
import { DefaultOptions } from '@tanstack/query-core';

interface MobxQueryClientConfig {
  defaultOptions?: DefaultOptions & {
    queries: MobxQueryFeatures;
    mutations: MobxMutatonFeatures;
  };
  hooks?: MobxQueryClientHooks;
}
```

## Key methods and properties   

### `queryFeatures`  
Features configurations exclusively for [`MobxQuery`](/api/MobxQuery)/[`MobxInfiniteQuery`](/api/MobxInfiniteQuery)  

### `mutationFeatures`  
Features configurations exclusively for [`MobxMutation`](/api/MobxMutation)  

### `hooks`  
Entity lifecycle events. Available hooks:   

| Hook | Description |
|---|---|
| onQueryInit  | Triggered when a [`MobxQuery`](/api/MobxQuery) is created  |
| onInfiniteQueryInit | Triggered when a [`MobxInfiniteQuery`](/api/MobxInfiniteQuery) is created |
| onMutationInit  | Triggered when a [`MobxMutation`](/api/MobxMutation) is created |
| onQueryDestroy  | Triggered when a [`MobxQuery`](/api/MobxQuery) is destroyed |
| onInfiniteQueryDestroy  | Triggered when a [`MobxInfiniteQuery`](/api/MobxInfiniteQuery) is destroyed |
| onMutationDestroy  | Triggered when a [`MobxMutation`](/api/MobxMutation) is destroyed |

## Inheritance  
`MobxQueryClient` inherits all methods and properties from [QueryClient](https://tanstack.com/query/v5/docs/reference/QueryClient), including:  
- [`getQueryData()`](https://tanstack.com/query/v5/docs/reference/QueryClient#queryclientgetquerydata)  
- [`setQueryData()`](https://tanstack.com/query/v5/docs/reference/QueryClient#queryclientsetquerydata)
- [`invalidateQueries()`](https://tanstack.com/query/v5/docs/reference/QueryClient#queryclientinvalidatequeries)
- [`prefetchQuery()`](https://tanstack.com/query/v5/docs/reference/QueryClient#queryclientprefetchquery)
- [`cancelQueries()`](https://tanstack.com/query/v5/docs/reference/QueryClient#queryclientcancelqueries)
- And others ([see official documentation](https://tanstack.com/query/v5/docs/reference/QueryClient))  

## Usage Example

```ts
import { MobxQueryClient } from 'mobx-tanstack-query';

// Create a client with custom hooks
const client = new MobxQueryClient({
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
Use `MobxQueryClient` if you need:  
- Customization of query/mutation lifecycle
- Tracking entity initialization/destruction events
- Advanced configuration for `MobX`-powered queries and mutations.
# Preset API   

_Or_ **mobx-tanstack-query/preset**  

This is additional api to work with this package, which contains factory functions for `mobx-tanstack-query` entities and already configured [`QueryClient`](/api/QueryClient)   

Here is [link for built-in configuration of `QueryClient`](/src/preset/configs/default-query-client-config.ts)   


## Usage  

```ts
import {
  createQuery,
  createMutation
} from "mobx-tanstack-query/preset";


const query = createQuery(async ({ signal }) => {
  const response = await fetch('/fruits', { signal });
  return await response.json();
}, {
  enabled: false,
  queryKey: ['fruits']
});

await query.start();

const mutation = createMutation(async (fruitName: string) => {
  await fetch('/fruits', { 
    method: "POST",
    data: {
      fruitName
    }
  })
}, {
  onDone: () => {
    query.invalidate();
  }
});

await mutation.mutate('Apple');
```


## Override configuration  

Every parameter in configuration you can override using this construction:  

```ts
import { queryClient } from "mobx-tanstack-query/preset";

const defaultOptions = queryClient.getDefaultOptions();
defaultOptions.queries!.refetchOnMount = true;
queryClient.setDefaultOptions({ ...defaultOptions })
```

::: tip
Override QueryClient parameters before all queries\mutations initializations
:::

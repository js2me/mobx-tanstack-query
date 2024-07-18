# MobX wrapper for [Tanstack Query Core](https://tanstack.com/query/latest) package  


Current supporting [Queries](https://tanstack.com/query/latest/docs/framework/react/guides/queries) and [Mutations](https://tanstack.com/query/latest/docs/framework/react/guides/mutations)  


# Usage  

## MobxQuery  

```ts
import { MobxQuery } from "mobx-tanstack-query";  


const query = new MobxQuery({
  queryClient,
  disposer?,
  ...options, // TanstackQuery.Query options  
  // Dynamic query parameters, when result of this function changed query will be updated
  // (autorun -> setOptions)
  options: () => ({
    ...options // TanstackQuery.Query options  
  })
})
```


## MobxMutation  

```ts
import { MobxMutation } from "mobx-tanstack-query";  


const query = new MobxQuery({
  queryClient,
  disposer?,
  ...options, // TanstackQuery.Mutation options  
})
```

# Other


## `InferQuery`, `InferMutation`, `InferInfiniteQuery` types   

This types are needed to infer some other types from mutations\configs.   

```ts
type MyData = InferMutation<typeof myMutation, 'data'>
type MyVariables = InferMutation<typeof myMutation, 'variables'>
type MyConfig = InferMutation<typeof myMutation, 'config'>
```


## `QueryConfigFromFn`, `MutationConfigFromFn`, `InfiniteQueryConfigFromFn`   

This types are needed to create configuration types from your functions of your http client  

```ts
const myApi = {
  createApple: (name: string): Promise<AppleDC> => ... 
}

type Config = MutationConfigFromFn<typeof myApi.createApple>
```


## `using` keyword   

`Query`, `InfiniteQuery`, `Mutation` supports out-of-box [`using` keyword](https://github.com/tc39/proposal-explicit-resource-management).   

In your project you need to install babel plugin [`@babel/plugin-proposal-explicit-resource-management`](https://www.npmjs.com/package/@babel/plugin-proposal-explicit-resource-management) to add this support.   

How it looks:   

```ts
import { createQuery } from "mobx-tanstack-query/preset";

class DataModel {
  async getData() {
    using query = createQuery(() => yourApi.getData(), { queryKey: ['data']});
    await when(() => !query.isLoading);
    return query.result.data!;
  }
}

const dataModel = new DataModel();
const data = await dataModel.getData();
// after call getData() created Query
// will be destroyed
```



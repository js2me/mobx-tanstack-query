# Other


## `InferQuery`, `InferMutation`, `InferInfiniteQuery` types   

This types are needed to infer some other types from mutations\configs.   

```ts
type MyData = InferMutation<typeof myMutation, 'data'>
type MyVariables = InferMutation<typeof myMutation, 'variables'>
type MyConfig = InferMutation<typeof myMutation, 'config'>
```


## `MobxQueryConfigFromFn`, `MobxMutationConfigFromFn`, `MobxInfiniteQueryConfigFromFn`   

This types are needed to create configuration types from your functions of your http client  

```ts
const myApi = {
  createApple: (name: string): Promise<AppleDC> => ... 
}

type Config = MobxMutationConfigFromFn<typeof myApi.createApple>
```

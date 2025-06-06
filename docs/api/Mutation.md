# Mutation  

Class wrapper for [@tanstack-query/core mutations](https://tanstack.com/query/latest/docs/framework/react/guides/mutations) with **MobX** reactivity   

[Reference to source code](/src/mutation.ts)  

## Usage  

Create an instance of `Mutation` with [`mutationFn`](https://tanstack.com/query/latest/docs/framework/react/guides/mutations) parameter

```ts
import { Mutation } from "mobx-tanstack-query";
import { petsApi } from "@/shared/apis"
import { queryClient } from "@/shared/config"

const petCreateMutation = new Mutation({
  queryClient,
  mutationFn: async (petName: string) => {
    const response = await petsApi.createPet(petName);
    return await response.json();
  },
  onMutate: () => {
    console.log('Start creating pet');
  },
  onSuccess: (newPet) => {
    // Invalidate cache after succeed mutation
    queryClient.invalidateQueries({ queryKey: ['pets'] });
    console.log('Pet has been created:', newPet);
  },
  onError: (error) => {
    console.error('Failed to create pet:', error.message);
  },
});

...
const result = await petCreateMutation.mutate('Fluffy');
console.info(result.data, result.isPending, result.isError);

```  

## Built-in Features  

### `abortSignal` option   
This field is necessary to kill all reactions and subscriptions that are created during the creation of an instance of the `Mutation` class   

```ts
const abortController = new AbortController();

const randomPetCreateMutation = new Mutation({
  queryClient,
  mutationFn: async (_, { signal }) => {
    const response = await petsApi.createRandomPet({ signal });
    return await response.json();
  },
});

...
randomPetCreateMutation.mutate();
abortController.abort();
```

This is alternative for `destroy` method

### `destroy()` method   
This method is necessary to kill all reactions and subscriptions that are created during the creation of an instance of the `Mutation` class   

This is alternative for `abortSignal` option   

### method `mutate(variables, options?)`  
Runs the mutation. (Works the as `mutate` function in [`useMutation` hook](https://tanstack.com/query/latest/docs/framework/react/reference/useMutation))  

### hook `onDone()`  
Subscribe when mutation has been successfully finished  

### hook `onError()`  
Subscribe when mutation has been finished with failure  

### method `reset()`  
Reset current mutation  

### property `result` <Badge type="info" text="observable.deep" />  
Mutation result (The same as returns the [`useMutation` hook](https://tanstack.com/query/latest/docs/framework/react/reference/useMutation))   






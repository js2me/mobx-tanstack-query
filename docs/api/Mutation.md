# Mutation  

Class wrapper for [@tanstack-query/core mutations](https://tanstack.com/query/latest/docs/framework/react/guides/mutations) with **MobX** reactivity   

[Reference to source code](/src/mutation.ts)  

## Usage  

Create an instance of `Mutation` with [`mutationFn`](https://tanstack.com/query/latest/docs/framework/react/guides/mutations) parameter

```ts
const mutation = new Mutation({
  queryClient,
  abortSignal, // Helps you to automatically clean up mutation  
  mutationFn: async ({ signal, queryKey }) => {
    const response = await petsApi.createPet({ name: 'Fluffy' }, { signal });
    return response.data;
  },
});  
```  

## Features

### method `mutate(variables, options?)`  
Runs the mutation. (Works the as `mutate` function in [`useMutation` hook](https://tanstack.com/query/latest/docs/framework/react/reference/useMutation))  

### hook `onDone()`  
Subscribe when mutation has been successfully finished  

### hook `onError()`  
Subscribe when mutation has been finished with failure  

### method `reset()`  
Reset current mutation  

### property `result`  
**Observable** mutation result (The same as returns the [`useMutation` hook](https://tanstack.com/query/latest/docs/framework/react/reference/useMutation))   






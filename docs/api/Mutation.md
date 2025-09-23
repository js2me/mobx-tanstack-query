# Mutation

Class wrapper for [@tanstack-query/core mutations](https://tanstack.com/query/latest/docs/framework/react/guides/mutations) with **MobX** reactivity

**All documentation about properties and methods of mutation can be found in the original documentation [here](https://tanstack.com/query/latest/docs/framework/react/reference/useMutation)**

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

## Properties and methods

#### `data: TData | undefined`

The last successfully resolved data for the mutation.   

Example:

```ts
const mutation = new Mutation({
  queryClient,
  mutationFn: async () => api.updatePet(),
});

mutation.data; // updated pet or undefined
```

#### `error: TError | null`  

The error object for the mutation, if an error was encountered. 

#### `variables`   

The last variables that were passed to the mutation function.   

#### `isError`
A boolean variable derived from `status`. Will be `true` if the last mutation attempt resulted in an error.

#### `isIdle`
A boolean variable derived from `status`. Will be `true` if the mutation is in its initial state prior to executing.

#### `isPending`
A boolean variable derived from `status`. Will be `true` if the mutation is currently executing.

#### `isSuccess`
A boolean variable derived from `status`. Will be `true` if the last mutation attempt was successful.

#### `status`
The status of the mutation.  
- Will be:  
  - `idle` initial status prior to the mutation function executing.
  - `pending` if the mutation is currently executing.
  - `error` if the last mutation attempt resulted in an error.
  - `success` if the last mutation attempt was successful.

#### `failureCount`
The failure count for the mutation. Incremented every time the mutation fails.

#### `failureReason`
The failure reason for the mutation retry.

#### `isPaused`
will be `true` if the mutation has been paused. See [Network Mode](https://tanstack.com/query/v5/docs/framework/react/guides/network-mode) for more information.  

#### `submittedAt`
The timestamp for when the mutation was submitted.  

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

### `lazy` option

This option enables "lazy" mode of the mutation. That means that all subscriptions and reaction will be created only when you request result for this mutation.

Example:

```ts
const mutation = createMutation(queryClient, () => ({
  lazy: true,
  mutationFn: async () => {
    // api call
  },
}));

// happens nothing
// no reactions and subscriptions will be created
```

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

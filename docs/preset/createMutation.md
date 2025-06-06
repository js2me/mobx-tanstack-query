# createMutation  

This is alternative for `new Mutation()`.  

## API Signature  

```ts
createMutation(mutationFn, otherOptionsWithoutFn?)
```

## Usage  
```ts
import { createMutation } from "mobx-tanstack-query/preset";

const mutation = createMutation(async (petName) => {
  const response = await petsApi.createPet(petName);
  return response.data;
});

await mutation.mutate();
```

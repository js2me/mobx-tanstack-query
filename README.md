<img src="assets/logo.png" align="right" height="156" alt="logo" />

# mobx-tanstack-query  

[![NPM version][npm-image]][npm-url] [![build status][github-actions-image]][github-actions-url] [![npm download][download-image]][download-url] [![bundle size][bundlephobia-image]][bundlephobia-url]


[npm-image]: http://img.shields.io/npm/v/mobx-tanstack-query.svg
[npm-url]: http://npmjs.org/package/mobx-tanstack-query
[github-actions-image]: https://github.com/js2me/mobx-tanstack-query/workflows/Build/badge.svg
[github-actions-url]: https://github.com/js2me/mobx-tanstack-query/actions
[download-image]: https://img.shields.io/npm/dm/mobx-tanstack-query.svg
[download-url]: https://npmjs.org/package/mobx-tanstack-query
[bundlephobia-url]: https://bundlephobia.com/result?p=mobx-tanstack-query
[bundlephobia-image]: https://badgen.net/bundlephobia/minzip/mobx-tanstack-query


_**MobX** wrapper for [**Tanstack Query Core**](https://tanstack.com/query/latest) package_


## What package supports    

### [**Queries**](https://tanstack.com/query/latest/docs/framework/react/guides/queries) -> [**MobxQuery**](src/mobx-query.ts)  

### [**Mutations**](https://tanstack.com/query/latest/docs/framework/react/guides/mutations) -> [**MobxMutation**](src/mobx-mutation.ts)  

### [**InfiniteQueries**](https://tanstack.com/query/latest/docs/framework/react/guides/infinite-queries) -> [**MobxInfiniteQuery**](src/mobx-infinite-query.ts)  




## Usage  

1. **Install dependencies**  

```bash
pnpm add @tanstack/query-core mobx-tanstack-query
```

2. **Create** [**QueryClient instance**](https://tanstack.com/query/v5/docs/reference/QueryClient)  

```ts
// @/shared/lib/tanstack-query/query-client.ts
import { hashKey, QueryClient } from '@tanstack/query-core';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      throwOnError: true,
      staleTime: Infinity,
      queryKeyHashFn: hashKey,
    },
    mutations: {
      throwOnError: true,
    },
  },
});
```

3. **Use it**  
```ts
const petsListQuery = new MobxQuery({
  queryClient,
  queryKey: ['pets'],
  queryFn: async ({ signal, queryKey }) => {
    const response = await petsApi.fetchPets({ signal });
    return response.data;
  },
});

const addPetsMutation = new MobxMutation({
  queryClient,
  mutationFn: async (payload: { petName: string }) => {
    const response = await petsApi.createPet(payload);
    return response.data;
  },
  onSuccess: (data) => {
    rootStore.notifications.push({
      type: 'success',
      title: `Pet created successfully with name ${data.name}`,
    });
    petsListQuery.invalidate();
  },
  onError: (error) => {
    rootStore.notifications.push({
      type: 'danger',
      title: 'Failed to create pet',
    });
  }
});

addPetsMutation.mutate({ petName: 'fluffy' });
```


[![npm](https://img.shields.io/npm/v/mobx-tanstack-query)](https://www.npmjs.com/package/mobx-tanstack-query) 
[![license](https://img.shields.io/npm/l/mobx-tanstack-query)](https://github.com/js2me/mobx-tanstack-queryblob/master/LICENSE)  

# MobX wrapper for [Tanstack Query Core](https://tanstack.com/query/latest) package  



Current supporting [Queries](https://tanstack.com/query/latest/docs/framework/react/guides/queries) and [Mutations](https://tanstack.com/query/latest/docs/framework/react/guides/mutations)  


# Usage  

First of needs to create `queryClient` using `tanstack-query` core package   

```ts
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


class YammyModel {
  listQuery = new MobxQuery({
    queryClient,
    disposer: this.disposer,
    enabled: false,
    queryKey: ['yammy'],
    queryFn: async () => {
      const response = await yammiApi.list(this.params);
      return response.data;
    },
    onInit: (query) => {
      this.disposer.add(
        reaction(
          () => this.params,
          debounce(() => {
            query.result.refetch();
          }, 200),
        ),
      );
    },
  });
}

yammyModel.listQuery.update({ enabled: true })
```


## MobxMutation  

```ts
import { MobxMutation } from "mobx-tanstack-query";  

class YammyModel {
  createMutation = new MobxMutation({
    queryClient,
    disposer: this.disposer,
    mutationFn: async ({ kek }: { kek: string }) => {
      const response = await yammyApi.create(kek);
      return response.data;
    },
    onMutate: () => {
      // on start actions
    },
    onError: (error) => {
      // on error actions
      this.rootStore.notifications.push({
        type: 'alert',
        title: 'Failed to create yammy',
        description: apiLib.getResponseErrorDetailedText(error),
      });
    },
    onSuccess: (_, payload) => {
      // on success actions
      this.rootStore.notifications.push({
        type: 'success',
        title: 'Yammy created successfully',
      });
      queryClient.resetQueries({
        queryKey: ['yammy'],
        exact: false,
      });
    },
    onSettled: () => {
      // on finished actions
    },
  });
}

yammyModel.createMutation.mutate({ kek: 'M&M' })
```


## MobxInfiniteQuery  

```ts
import { MobxInfiniteQuery } from "mobx-tanstack-query";  


const query = new MobxInfiniteQuery({
  queryClient,
  disposer?,
  ...options, // TanstackInfiniteQuery.Query options  
  // Dynamic query parameters, when result of this function changed query will be updated
  // (autorun -> setOptions)
  options: () => ({
    ...options // TanstackInfiniteQuery.Query options  
  })
})

```

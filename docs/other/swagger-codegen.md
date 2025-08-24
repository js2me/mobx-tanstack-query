# Swagger Codegen

## `mobx-tanstack-query-api`

This project is based on [`swagger-typescript-api`](https://github.com/acacode/swagger-typescript-api)

Github: https://github.com/js2me/mobx-tanstack-query-api  
NPM: http://npmjs.org/package/mobx-tanstack-query-api

::: warning
Currently `mobx-tanstack-query-api` is a WIP project.  
This is not production ready.  
:::

### Steps to use

#### Install

::: code-group

```bash [npm]
npm install mobx-tanstack-query-api
```

```bash [pnpm]
pnpm add mobx-tanstack-query-api
```

```bash [yarn]
yarn add mobx-tanstack-query-api
```

:::

#### Create configuration file

Create a codegen configuration file with file name `api-codegen.config.(js|mjs)` at root of your project.  
Add configuration using `defineConfig`

```ts
import { defineConfig } from "mobx-tanstack-query-api/cli";
import { fileURLToPath } from "url";
import path from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default defineConfig({
  // input: path.resolve(__dirname, './openapi.yaml'),
  input: "http://yourapi.com/url/openapi.yaml",
  output: path.resolve(__dirname, "src/shared/api/__generated__"),
  httpClient: "builtin",
  queryClient: "builtin",
  endpoint: "builtin",
  // namespace: 'collectedName',
  groupBy: "tag",
  // groupBy: 'tag-1',
  // groupBy: 'path-segment',
  // groupBy: 'path-segment-1',
  filterEndpoints: () => true,
  // groupBy:  route => {
  //   const api = apis.find(api => api.urls.some(url => route.raw.route.startsWith(url)))
  //   return api?.name ?? 'other'
  // },
  formatExportGroupName: (groupName) => `${groupName}Api`,
});
```

#### Add script to `package.json`

```json
...
"scripts": {
  ...
  "dev:api-codegen": "mobx-tanstack-query-api"
  ...
}
...
```

#### Run codegen

::: code-group

```bash [npm]
npm run dev:api-codegen
```

```bash [pnpm]
pnpm dev:api-codegen
```

```bash [yarn]
yarn dev:api-codegen
```

:::

#### Use queries and mutations

```ts
import { getFruits, createFruit, Tag } from "@/shared/api/__generated__";

export const fruitsQuery = getFruits.toQuery({
  enableOnDemand: true,
  params: {},
});

export const fruitCreateMutation = createFruit.toMutation({
  invalidateEndpoints: {
    tag: [Tag.Fruits],
  },
});
```

Another example with classes

```ts
import { getFruits } from "@/shared/api/__generated__";

export class Fruits {
  private abortController = new AbortController();

  @observable
  private accessor params = {
    search: "",
  };

  private fruitsQuery = getFruits.toQuery({
    abortSignal: this.abortController.signal,
    enableOnDemand: true,
    params: () => ({
      query: {
        search: this.params.search,
      },
    }),
  });

  constructor(abortSignal?: AbortSignal) {
    // or you can use linked-abort-controller package
    abortSignal.addEventListener("abort", () => {
      this.abortController.abort();
    });
  }

  @computed.struct
  get data() {
    return this.fruitsQuery.data || [];
  }

  @computed.struct
  get isLoading() {
    return this.fruitsQuery.isLoading;
  }

  destroy() {
    this.abortController.abort();
  }
}

const fruits = new FruitsModel();

console.log(fruits.data); // enable query
```

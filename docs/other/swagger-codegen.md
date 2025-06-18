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

```bash [yarn]
yarn add mobx-tanstack-query-api
```

```bash [pnpm]
pnpm add mobx-tanstack-query-api
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
  output: path.resolve(__dirname, 'src/shared/api/__generated__'),
  httpClient: 'builtin',
  queryClient: 'builtin',
  endpoint: 'builtin',
  // namespace: 'collectedName',
  groupBy: 'tag',
  // groupBy: 'tag-1',
  // groupBy: 'path-segment',
  // groupBy: 'path-segment-1',
  filterEndpoints: () => true,
  // groupBy:  route => {
  //   const api = apis.find(api => api.urls.some(url => route.raw.route.startsWith(url)))
  //   return api?.name ?? 'other'
  // },
  formatExportGroupName: (groupName) => `${groupName}Api`,
})
```

#### Add script to `package.json`  

```json
...
"scripts": {
  ...
  "api-codegen": "mobx-tanstack-query-api"
  ...
}
...
```

#### Run   

```bash
npm run api-codegen
```
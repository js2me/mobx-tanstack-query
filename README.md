<img src="assets/logo.png" align="right" height="156" alt="logo" />

# mobx-tanstack-query  

[![NPM version][npm-image]][npm-url] [![test status][github-test-actions-image]][github-actions-url] [![build status][github-build-actions-image]][github-actions-url] [![npm download][download-image]][download-url] [![bundle size][bundlephobia-image]][bundlephobia-url]


[npm-image]: http://img.shields.io/npm/v/mobx-tanstack-query.svg
[npm-url]: http://npmjs.org/package/mobx-tanstack-query
[github-test-actions-image]: https://github.com/js2me/mobx-tanstack-query/workflows/Test/badge.svg
[github-build-actions-image]: https://github.com/js2me/mobx-tanstack-query/workflows/Build/badge.svg
[github-actions-url]: https://github.com/js2me/mobx-tanstack-query/actions
[download-image]: https://img.shields.io/npm/dm/mobx-tanstack-query.svg
[download-url]: https://npmjs.org/package/mobx-tanstack-query
[bundlephobia-url]: https://bundlephobia.com/result?p=mobx-tanstack-query
[bundlephobia-image]: https://badgen.net/bundlephobia/minzip/mobx-tanstack-query


_**MobX** wrapper for [**Tanstack Query Core**](https://tanstack.com/query/latest) package_  

## Documentation is [here](https://js2me.github.io/mobx-tanstack-query)  

```ts
import { Query } from "mobx-tanstack-query";

const query = new Query({
  queryClient,
  queryKey: ['hello', 'world'],
  queryFn: async () => {
    const response = await fetch('/hello/world');
    return await response.json();
  }
})
```


## Contributing Guide    

1. Fork repository   
2. Switch to `master` branch
3. Fix bugs or create features
4. Use command `pnpm changeset` to describe what you do   
5. Commit with message using [Conventional commits](https://www.conventionalcommits.org/)  
6. Open PR!   
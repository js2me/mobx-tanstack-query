<img src="docs/publi/logo.png" align="right" width="156" alt="logo" />

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

### [Read the docs →](https://js2me.github.io/mobx-tanstack-query/)

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

reaction(
  () => query.isLoading,
  isLoading => {
    if (isLoading) {
      console.log('Loading...');
    }
  }
)
```


## Contribution Guide    

Want to contribute ? [Follow this guide](https://github.com/js2me/mobx-tanstack-query/blob/master/CONTRIBUTING.md)  
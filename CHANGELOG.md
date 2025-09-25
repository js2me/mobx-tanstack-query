# mobx-tanstack-query

## 6.8.2

### Patch Changes

- [`ba30553`](https://github.com/js2me/mobx-tanstack-query/commit/ba305532889d196fdc5c4a12f438c8504225b4f8) Thanks [@js2me](https://github.com/js2me)! - fixed typings of `mutationFn` (second argument)

## 6.8.1

### Patch Changes

- [`d00661c`](https://github.com/js2me/mobx-tanstack-query/commit/d00661ca4d57f1167c54e44ca626c0a447aefc19) Thanks [@js2me](https://github.com/js2me)! - fix missing hooks use in mutation

- [`d00661c`](https://github.com/js2me/mobx-tanstack-query/commit/d00661ca4d57f1167c54e44ca626c0a447aefc19) Thanks [@js2me](https://github.com/js2me)! - fix missing pass second arg for `mutationFn` (`MutationContext`)

## 6.8.0

### Minor Changes

- [`afacc73`](https://github.com/js2me/mobx-tanstack-query/commit/afacc73606f546cab257fcbf1c19ac4973c01739) Thanks [@js2me](https://github.com/js2me)! - support new version `@tanstack/query-core` (`5.90.2`)

- [`969228b`](https://github.com/js2me/mobx-tanstack-query/commit/969228b44492224af73cbec8eb8954ff666973ac) Thanks [@js2me](https://github.com/js2me)! - improved documentation for `Query`

### Patch Changes

- [`afacc73`](https://github.com/js2me/mobx-tanstack-query/commit/afacc73606f546cab257fcbf1c19ac4973c01739) Thanks [@js2me](https://github.com/js2me)! - fixed `transformError` query/mutation feature

## 6.7.0

### Minor Changes

- [`24a8a41`](https://github.com/js2me/mobx-tanstack-query/commit/24a8a41b65ebb03d29a88a6e3fd5dedf40a58cb7) Thanks [@js2me](https://github.com/js2me)! - added `autoRemovePreviousQuery` query feature

- [`24a8a41`](https://github.com/js2me/mobx-tanstack-query/commit/24a8a41b65ebb03d29a88a6e3fd5dedf40a58cb7) Thanks [@js2me](https://github.com/js2me)! - added value `"safe"` for `removeOnDestroy` option for query

- [`b626ab4`](https://github.com/js2me/mobx-tanstack-query/commit/b626ab46d38fa17c1685d26c97dcc869012d17ff) Thanks [@js2me](https://github.com/js2me)! - rework query/mutation features code (refactor and clean code inside queries and mutations)

- [`24a8a41`](https://github.com/js2me/mobx-tanstack-query/commit/24a8a41b65ebb03d29a88a6e3fd5dedf40a58cb7) Thanks [@js2me](https://github.com/js2me)! - `safe` option for `remove()` method for queries

### Patch Changes

- [`87005aa`](https://github.com/js2me/mobx-tanstack-query/commit/87005aab2dc62ea007bf6fe5456939fb8353ddb6) Thanks [@js2me](https://github.com/js2me)! - refactored unify destroy and aborts inside package entities

- [`87005aa`](https://github.com/js2me/mobx-tanstack-query/commit/87005aab2dc62ea007bf6fe5456939fb8353ddb6) Thanks [@js2me](https://github.com/js2me)! - fixed preset exports

## 6.6.4

### Patch Changes

- [`17ff372`](https://github.com/js2me/mobx-tanstack-query/commit/17ff37237cce50869ea7f2587b4b80484c3a6520) Thanks [@js2me](https://github.com/js2me)! - fixed typings in `setData` of `InfiniteQuery`

## 6.6.3

### Patch Changes

- [`d5b2a12`](https://github.com/js2me/mobx-tanstack-query/commit/d5b2a12d4585787ac797c70ad8cb75feae180534) Thanks [@js2me](https://github.com/js2me)! - fix zshy bundle

## 6.6.2

### Patch Changes

- [`78f531e`](https://github.com/js2me/mobx-tanstack-query/commit/78f531e7cfc94b819dd08c96deac2ef84966cdc6) Thanks [@js2me](https://github.com/js2me)! - update docs

## 6.6.1

### Patch Changes

- [`f3816be`](https://github.com/js2me/mobx-tanstack-query/commit/f3816be4840645f4d27a3d5385f2a4bf13e41684) Thanks [@js2me](https://github.com/js2me)! - fixed cumulativeQueryHash work

## 6.6.0

### Minor Changes

- [`91da4e2`](https://github.com/js2me/mobx-tanstack-query/commit/91da4e2d3fdb4cfd67641d8d47d8149ac76d47e4) Thanks [@js2me](https://github.com/js2me)! - added `cumulativeQueryHash` option for queries

## 6.5.0

### Minor Changes

- [`317f725`](https://github.com/js2me/mobx-tanstack-query/commit/317f725b6b827213566539a2e1892ba5b6eb5d72) Thanks [@js2me](https://github.com/js2me)! - added `removeOnDestroy` to remove query after destroy or abortSignal aborted

- [`317f725`](https://github.com/js2me/mobx-tanstack-query/commit/317f725b6b827213566539a2e1892ba5b6eb5d72) Thanks [@js2me](https://github.com/js2me)! - added `remove()` method for `Query/InfiniteQuery` to remove query

## 6.4.0

### Minor Changes

- [`85b8ea6`](https://github.com/js2me/mobx-tanstack-query/commit/85b8ea6a2fe3c768e318121056fdc870d9e96f85) Thanks [@js2me](https://github.com/js2me)! - `cancel()` method for `Query` (-> `queryClient.cancelQueries`)

## 6.3.1

### Patch Changes

- [`43f1870`](https://github.com/js2me/mobx-tanstack-query/commit/43f1870d6f6d60a983bb4b794fef2c8223d9a0f1) Thanks [@js2me](https://github.com/js2me)! - fixed mixing static query key pass for queries

## 6.3.0

### Minor Changes

- [`5b0af46`](https://github.com/js2me/mobx-tanstack-query/commit/5b0af46ad5d834a75d14e77ffde7c4c42c363821) Thanks [@js2me](https://github.com/js2me)! - make `mutate` method in Mutation as bounded method

- [`5b0af46`](https://github.com/js2me/mobx-tanstack-query/commit/5b0af46ad5d834a75d14e77ffde7c4c42c363821) Thanks [@js2me](https://github.com/js2me)! - make `start` as bounded method for queries

- [`5b0af46`](https://github.com/js2me/mobx-tanstack-query/commit/5b0af46ad5d834a75d14e77ffde7c4c42c363821) Thanks [@js2me](https://github.com/js2me)! - make `refetch` as bounded method for queries

- [`5b0af46`](https://github.com/js2me/mobx-tanstack-query/commit/5b0af46ad5d834a75d14e77ffde7c4c42c363821) Thanks [@js2me](https://github.com/js2me)! - make `start` method in Mutation as bounded method

### Patch Changes

- [`5b0af46`](https://github.com/js2me/mobx-tanstack-query/commit/5b0af46ad5d834a75d14e77ffde7c4c42c363821) Thanks [@js2me](https://github.com/js2me)! - fixed query `start()` method (duplicate request calls) and ignoring updating query params

## 6.2.2

### Patch Changes

- [`3a10696`](https://github.com/js2me/mobx-tanstack-query/commit/3a10696883a9fd5515c4db2681651e32066319e9) Thanks [@js2me](https://github.com/js2me)! - [internal] move lazyObserve util to yummies/mobx package

## 6.2.1

### Patch Changes

- [`537ac91`](https://github.com/js2me/mobx-tanstack-query/commit/537ac91df47a34df675708c706783820849a9b1d) Thanks [@js2me](https://github.com/js2me)! - add small docs for `transformError` option

- [`537ac91`](https://github.com/js2me/mobx-tanstack-query/commit/537ac91df47a34df675708c706783820849a9b1d) Thanks [@js2me](https://github.com/js2me)! - added docs for `Query` properties

## 6.2.0

### Minor Changes

- [`9ef86a1`](https://github.com/js2me/mobx-tanstack-query/commit/9ef86a1e3cf45af6e62cfb9479ba31143c6ef10e) Thanks [@js2me](https://github.com/js2me)! - ability to get access to query\mutation result properties using query._ or mutation._ properties access

- [`9ef86a1`](https://github.com/js2me/mobx-tanstack-query/commit/9ef86a1e3cf45af6e62cfb9479ba31143c6ef10e) Thanks [@js2me](https://github.com/js2me)! - `transformError` option for queries and mutations

## 6.1.2

### Patch Changes

- [`534042e`](https://github.com/js2me/mobx-tanstack-query/commit/534042eea27055262942d084841bbd94b36f07b4) Thanks [@js2me](https://github.com/js2me)! - fixed lazy queries cleanup functions

## 6.1.1

### Patch Changes

- [`602366a`](https://github.com/js2me/mobx-tanstack-query/commit/602366aedba8b9ad8a2b20ddac8b1263054b3969) Thanks [@js2me](https://github.com/js2me)! - make isLazy as protected property

## 6.1.0

### Minor Changes

- [#30](https://github.com/js2me/mobx-tanstack-query/pull/30) [`bee7713`](https://github.com/js2me/mobx-tanstack-query/commit/bee77135d9879250f4221a3c23696ead6753852b) Thanks [@js2me](https://github.com/js2me)! - added `lazy` option for queries and mutations which work on lazy observables from mobx

### Patch Changes

- [#30](https://github.com/js2me/mobx-tanstack-query/pull/30) [`bee7713`](https://github.com/js2me/mobx-tanstack-query/commit/bee77135d9879250f4221a3c23696ead6753852b) Thanks [@js2me](https://github.com/js2me)! - remove a lot of useless reactions (replaced it by more simple callbacks)

## 6.0.11

### Patch Changes

- [`35e255b`](https://github.com/js2me/mobx-tanstack-query/commit/35e255b5ac81ef7125a452625e12a9202ceadc93) Thanks [@js2me](https://github.com/js2me)! - fix is result requested change mobx warning due to abort

## 6.0.10

### Patch Changes

- [`99cc685`](https://github.com/js2me/mobx-tanstack-query/commit/99cc685f6c11181e9e042458bd93a664ae1e1bc7) Thanks [@js2me](https://github.com/js2me)! - docs: fix logo size

## 6.0.9

### Patch Changes

- [`65f9338`](https://github.com/js2me/mobx-tanstack-query/commit/65f933830a75e505991036f256644bb070e2bd5c) Thanks [@js2me](https://github.com/js2me)! - ci gh release

## 6.0.8

### Patch Changes

- [`75a8e1d`](https://github.com/js2me/mobx-tanstack-query/commit/75a8e1d3da3649813bceecc595f7cd15c773f022) Thanks [@js2me](https://github.com/js2me)! - ci: gh release try

## 6.0.7

### Patch Changes

- [`424d4e5`](https://github.com/js2me/mobx-tanstack-query/commit/424d4e567229f25914a4a8dcbdbdee835562e225) Thanks [@js2me](https://github.com/js2me)! - ci: gh release try

## 6.0.6

### Patch Changes

- [`f4c1628`](https://github.com/js2me/mobx-tanstack-query/commit/f4c1628a1df74828445531da31c0fa2397e17afb) Thanks [@js2me](https://github.com/js2me)! - ci: fix publish gh release

## 6.0.5

### Patch Changes

- [`55b1873`](https://github.com/js2me/mobx-tanstack-query/commit/55b1873f39831b2bc3cf3ad0dd229c048b0cae79) Thanks [@js2me](https://github.com/js2me)! - ci: better publish gh release (try)

## 6.0.4

### Patch Changes

- [`ca0ce21`](https://github.com/js2me/mobx-tanstack-query/commit/ca0ce2100c8263851c7b87b3e7f610787e7f9bf7) Thanks [@js2me](https://github.com/js2me)! - add dynamicOptionsUpdateDelay Query feature

## 6.0.3

### Patch Changes

- [`88718fb`](https://github.com/js2me/mobx-tanstack-query/commit/88718fbc1820efc4f7d6ec9ba2cec1510881e3b4) Thanks [@js2me](https://github.com/js2me)! - docs: add contributing guide for README

## 6.0.2

### Patch Changes

- [`cbb5fd0`](https://github.com/js2me/mobx-tanstack-query/commit/cbb5fd04469a4bde4f7f85d7fe0e9a9d5a329d1a) Thanks [@js2me](https://github.com/js2me)! - ci/cd: better github workflows

## 6.0.1

### Patch Changes

- [`99abe23`](https://github.com/js2me/mobx-tanstack-query/commit/99abe233be600eaefd3754ad9258b717753364fa) Thanks [@js2me](https://github.com/js2me)! - ci/cd: github workflows

## 6.0.0

### Major Changes

- [`aa4e9df`](https://github.com/js2me/mobx-tanstack-query/commit/aa4e9dfb525c47932a1d89375ce358a363c15fdb) Thanks [@js2me](https://github.com/js2me)! - add deprecation jsdoc for all deprecated types and runtime

import type {
  FetchStatus,
  QueryStatus,
  RefetchOptions,
} from '@tanstack/query-core';
import { computed, makeObservable } from 'mobx';
import type { MaybeFalsy, MaybeFn } from 'yummies/types';
import type { AnyInfiniteQuery } from './inifinite-query.types.js';
import type { AnyQuery } from './query.types.js';

export type QueryGroupItem = AnyQuery | AnyInfiniteQuery;

export type QueryGroupItems = readonly MaybeFalsy<QueryGroupItem>[];

export type QueryGroupItemData<TItem extends MaybeFalsy<QueryGroupItem>> =
  TItem extends QueryGroupItem ? TItem['data'] : undefined;

export type QueryGroupItemError<TItem extends MaybeFalsy<QueryGroupItem>> =
  TItem extends QueryGroupItem ? TItem['error'] : null;

export type QueryGroupData<TQueries extends QueryGroupItems> = {
  [TKey in keyof TQueries]: QueryGroupItemData<TQueries[TKey]>;
};

export type QueryGroupErrors<TQueries extends QueryGroupItems> = {
  [TKey in keyof TQueries]: QueryGroupItemError<TQueries[TKey]>;
};

export type QueryGroupError<TQueries extends QueryGroupItems> =
  QueryGroupItemError<TQueries[number]> | null;

/**
 * Reactive aggregation over multiple `Query` / `InfiniteQuery` instances.
 *
 * [**Documentation**](https://js2me.github.io/mobx-tanstack-query/api/QueryGroup.html)
 */
export class QueryGroup<TQueries extends QueryGroupItems> {
  constructor(protected queriesInput: MaybeFn<TQueries>) {
    makeObservable(this, {
      queries: computed,
      data: computed,
      error: computed,
      errors: computed,
      isPending: computed,
      isLoading: computed,
      isFetching: computed,
      isRefetching: computed,
      isPaused: computed,
      isError: computed,
      isSuccess: computed,
      status: computed,
      fetchStatus: computed,
    });

    this.refetch = this.refetch.bind(this);
  }

  /**
   * All non-falsy queries in the group
   *
   * [**Documentation**](https://js2me.github.io/mobx-tanstack-query/api/QueryGroup.html#queries-querygroupitem)
   */
  get queries(): QueryGroupItem[] {
    return this.items.filter((query): query is QueryGroupItem => !!query);
  }

  /**
   * Data of all queries in the group.
   * Keeps positions of the input list, falsy entries are represented as `undefined`.
   *
   * [**Documentation**](https://js2me.github.io/mobx-tanstack-query/api/QueryGroup.html#data-querygroupdata)
   */
  get data(): QueryGroupData<TQueries> {
    return this.items.map((query) =>
      query ? query.data : undefined,
    ) as QueryGroupData<TQueries>;
  }

  /**
   * The first non-null error of the queries in the group, otherwise `null`.
   *
   * [**Documentation**](https://js2me.github.io/mobx-tanstack-query/api/QueryGroup.html#error-querygrouperror)
   */
  get error(): QueryGroupError<TQueries> {
    return (this.queries.find((query) => query.error != null)?.error ??
      null) as QueryGroupError<TQueries>;
  }

  /**
   * Errors of all queries in the group.
   * Keeps positions of the input list, falsy entries are represented as `null`.
   *
   * [**Documentation**](https://js2me.github.io/mobx-tanstack-query/api/QueryGroup.html#errors-querygrouperrors)
   */
  get errors(): QueryGroupErrors<TQueries> {
    return this.items.map((query) =>
      query ? query.error : null,
    ) as QueryGroupErrors<TQueries>;
  }

  /**
   * `true` if any query in the group is pending
   *
   * [**Documentation**](https://js2me.github.io/mobx-tanstack-query/api/QueryGroup.html#ispending-boolean)
   */
  get isPending(): boolean {
    return this.queries.some((query) => query.isPending);
  }

  /**
   * `true` if any query in the group is loading (first fetch is in-flight)
   *
   * [**Documentation**](https://js2me.github.io/mobx-tanstack-query/api/QueryGroup.html#isloading-boolean)
   */
  get isLoading(): boolean {
    return this.queries.some((query) => query.isLoading);
  }

  /**
   * `true` if any query in the group is fetching
   *
   * [**Documentation**](https://js2me.github.io/mobx-tanstack-query/api/QueryGroup.html#isfetching-boolean)
   */
  get isFetching(): boolean {
    return this.queries.some((query) => query.isFetching);
  }

  /**
   * `true` if any query in the group is refetching
   *
   * [**Documentation**](https://js2me.github.io/mobx-tanstack-query/api/QueryGroup.html#isrefetching-boolean)
   */
  get isRefetching(): boolean {
    return this.queries.some((query) => query.isRefetching);
  }

  /**
   * `true` if any query in the group is paused
   *
   * [**Documentation**](https://js2me.github.io/mobx-tanstack-query/api/QueryGroup.html#ispaused-boolean)
   */
  get isPaused(): boolean {
    return this.queries.some((query) => query.isPaused);
  }

  /**
   * `true` if any query in the group has an error
   *
   * [**Documentation**](https://js2me.github.io/mobx-tanstack-query/api/QueryGroup.html#iserror-boolean)
   */
  get isError(): boolean {
    return this.queries.some((query) => query.isError);
  }

  /**
   * `true` if all queries in the group are successfully fetched
   *
   * [**Documentation**](https://js2me.github.io/mobx-tanstack-query/api/QueryGroup.html#issuccess-boolean)
   */
  get isSuccess(): boolean {
    return this.queries.every((query) => query.isSuccess);
  }

  /**
   * Aggregated status of the group:
   * - `success` if all queries are succeeded
   * - `error` if any query has an error
   * - `pending` otherwise
   *
   * [**Documentation**](https://js2me.github.io/mobx-tanstack-query/api/QueryGroup.html#status-querystatus)
   */
  get status(): QueryStatus {
    if (this.isSuccess) {
      return 'success';
    }
    if (this.isError) {
      return 'error';
    }
    return 'pending';
  }

  /**
   * Aggregated fetch status of the group:
   * - `fetching` if any query is fetching
   * - `paused` if any query is paused
   * - `idle` otherwise
   *
   * [**Documentation**](https://js2me.github.io/mobx-tanstack-query/api/QueryGroup.html#fetchstatus-fetchstatus)
   */
  get fetchStatus(): FetchStatus {
    if (this.isFetching) {
      return 'fetching';
    }
    if (this.isPaused) {
      return 'paused';
    }
    return 'idle';
  }

  /**
   * Refetches all queries in the group
   *
   * [**Documentation**](https://js2me.github.io/mobx-tanstack-query/api/QueryGroup.html#refetch-options)
   */
  refetch(options?: RefetchOptions): Promise<unknown[]> {
    return Promise.all(this.queries.map((query) => query.refetch(options)));
  }

  protected get items(): QueryGroupItems {
    return typeof this.queriesInput === 'function'
      ? this.queriesInput()
      : this.queriesInput;
  }
}

/**
 * Groups multiple queries into a single reactive aggregated view.
 *
 * Accepts either a list of queries or a function returning it
 * (useful for reactive lists, e.g. conditional queries).
 * Falsy entries (`undefined`, `null`, `false`, etc.) are ignored
 * by the aggregated flags, but keep their positions in `data` and `errors`.
 *
 * @example
 * ```ts
 * const group = groupQueries(() => [userQuery, withPosts && postsQuery]);
 *
 * autorun(() => {
 *   if (group.isSuccess) {
 *     console.log(group.data);
 *   }
 * });
 * ```
 *
 * [**Documentation**](https://js2me.github.io/mobx-tanstack-query/api/QueryGroup.html)
 */
export function groupQueries<const TQueries extends QueryGroupItems>(
  queries: MaybeFn<TQueries>,
): QueryGroup<TQueries> {
  return new QueryGroup(queries);
}

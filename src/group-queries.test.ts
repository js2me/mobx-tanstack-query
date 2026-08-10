import { QueryClient } from '@tanstack/query-core';
import { autorun, observable, runInAction, when } from 'mobx';
import { describe, expect, expectTypeOf, it, vi } from 'vitest';
import { groupQueries } from './group-queries.js';
import { InfiniteQuery } from './inifinite-query.js';
import { Query } from './query.js';

const createQuery = <TData>(key: string, queryFn: () => Promise<TData>) =>
  new Query({
    queryClient: new QueryClient(),
    queryKey: [key],
    queryFn,
  });

const deferred = <T>() => {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
};

describe('groupQueries', () => {
  it('aggregates data and flags of all queries', async () => {
    const queryA = createQuery('a', async () => 'a-data');
    const queryB = createQuery('b', async () => 42);

    const group = groupQueries([queryA, queryB]);

    expect(group.isPending).toBe(true);
    expect(group.isLoading).toBe(true);
    expect(group.isFetching).toBe(true);
    expect(group.isSuccess).toBe(false);
    expect(group.status).toBe('pending');
    expect(group.fetchStatus).toBe('fetching');
    expect(group.data).toEqual([undefined, undefined]);
    expect(group.queries).toHaveLength(2);

    await when(() => group.isSuccess);

    expect(group.data).toEqual(['a-data', 42]);
    expect(group.status).toBe('success');
    expect(group.fetchStatus).toBe('idle');
    expect(group.isFetching).toBe(false);
    expect(group.isPending).toBe(false);
    expect(group.isLoading).toBe(false);
    expect(group.isError).toBe(false);
    expect(group.error).toBeNull();
    expect(group.errors).toEqual([null, null]);
  });

  it('accepts a function as the queries list (MaybeFn)', async () => {
    const queryA = createQuery('a', async () => 'a-data');
    const queryB = createQuery('b', async () => 42);

    const group = groupQueries(() => [queryA, queryB]);

    await when(() => group.isSuccess);

    expect(group.data).toEqual(['a-data', 42]);
  });

  it('ignores falsy entries but keeps their positions in data/errors', async () => {
    const queryA = createQuery('a', async () => 'a-data');

    const group = groupQueries([queryA, null, undefined, false]);

    expect(group.queries).toHaveLength(1);

    await when(() => group.isSuccess);

    expect(group.data).toEqual(['a-data', undefined, undefined, undefined]);
    expect(group.errors).toEqual([null, null, null, null]);
    expect(group.error).toBeNull();
    expect(group.status).toBe('success');
  });

  it('reactively tracks the list returned by the function', async () => {
    const queryA = createQuery('a', async () => 'a-data');
    const deferredB = deferred<string>();
    const queryB = createQuery('b', () => deferredB.promise);

    const state = observable({ withB: false });

    const group = groupQueries(() => [queryA, state.withB && queryB]);

    await when(() => queryA.isSuccess);
    expect(group.isSuccess).toBe(true);

    const snapshots: boolean[] = [];
    const dispose = autorun(() => snapshots.push(group.isSuccess));

    runInAction(() => {
      state.withB = true;
    });

    expect(group.isSuccess).toBe(false);
    expect(group.isPending).toBe(true);

    deferredB.resolve('b-data');
    await when(() => group.isSuccess);

    expect(group.data).toEqual(['a-data', 'b-data']);
    expect(snapshots).toEqual([true, false, true]);

    dispose();
  });

  it('aggregates errors', async () => {
    const error = new Error('boom');
    const queryA = createQuery('a', async () => 'a-data');
    const failingQuery = new Query({
      queryClient: new QueryClient(),
      queryKey: ['failing'],
      retry: false,
      queryFn: async (): Promise<string> => {
        throw error;
      },
    });

    const group = groupQueries([queryA, failingQuery]);

    await when(() => group.isError);

    expect(group.error).toBe(error);
    expect(group.errors[0]).toBeNull();
    expect(group.errors[1]).toBe(error);
    expect(group.isError).toBe(true);
    expect(group.isSuccess).toBe(false);
    expect(group.status).toBe('error');
    expect(group.fetchStatus).toBe('idle');
  });

  it('isSuccess is true only when all queries are succeeded', async () => {
    const queryA = createQuery('a', async () => 'a-data');
    const deferredB = deferred<number>();
    const queryB = createQuery('b', () => deferredB.promise);

    const group = groupQueries([queryA, queryB]);

    await when(() => queryA.isSuccess);

    expect(queryA.isSuccess).toBe(true);
    expect(group.isSuccess).toBe(false);
    expect(group.status).toBe('pending');

    deferredB.resolve(42);
    await when(() => group.isSuccess);

    expect(group.status).toBe('success');
  });

  it('isFetching and isRefetching are true while any query is fetching', async () => {
    const queryA = createQuery('a', async () => 'a-data');
    let deferredB = deferred<number>();
    const queryB = createQuery('b', () => deferredB.promise);

    const group = groupQueries([queryA, queryB]);

    await when(() => queryA.isSuccess);

    expect(queryA.isFetching).toBe(false);
    expect(group.isFetching).toBe(true);

    deferredB.resolve(42);
    await when(() => !group.isFetching);

    expect(group.isFetching).toBe(false);

    deferredB = deferred<number>();
    void queryB.refetch();
    await when(() => group.isRefetching);

    expect(group.isRefetching).toBe(true);

    deferredB.resolve(43);
    await when(() => !group.isRefetching);
    expect(group.isRefetching).toBe(false);
  });

  it('refetch refetches all queries in the group', async () => {
    const queryFnA = vi.fn(async () => 'a-data');
    const queryFnB = vi.fn(async () => 42);
    const queryA = createQuery('a', queryFnA);
    const queryB = createQuery('b', queryFnB);

    const group = groupQueries([queryA, queryB]);

    await when(() => group.isSuccess);

    queryFnA.mockClear();
    queryFnB.mockClear();

    const results = await group.refetch();

    expect(queryFnA).toHaveBeenCalledTimes(1);
    expect(queryFnB).toHaveBeenCalledTimes(1);
    expect(results).toHaveLength(2);
  });

  it('works with InfiniteQuery', async () => {
    const queryA = createQuery('a', async () => 'a-data');
    const infiniteQuery = new InfiniteQuery({
      queryClient: new QueryClient(),
      queryKey: ['infinite'],
      initialPageParam: 0,
      getNextPageParam: () => undefined,
      queryFn: async () => 'page-data',
    });

    const group = groupQueries([queryA, infiniteQuery]);

    await when(() => group.isSuccess);

    expect(group.data[0]).toBe('a-data');
    expect(group.data[1]?.pages).toEqual(['page-data']);
  });

  it('typings', () => {
    const queryA = null as unknown as Query<string, Error, string>;
    const queryB = null as unknown as Query<number, TypeError, number>;

    const group = groupQueries([queryA, null, queryB]);

    expectTypeOf(group.data).toEqualTypeOf<
      readonly [string | undefined, undefined, number | undefined]
    >();
    expectTypeOf(group.errors).toEqualTypeOf<
      readonly [Error | null, null, TypeError | null]
    >();
    expectTypeOf(group.error).toEqualTypeOf<Error | TypeError | null>();
    expectTypeOf(group.isFetching).toEqualTypeOf<boolean>();

    const cond = true as boolean;
    const dynamicGroup = groupQueries(() => [queryA, cond && queryB]);

    expectTypeOf(dynamicGroup.data).toEqualTypeOf<
      readonly [string | undefined, number | undefined]
    >();
  });
});

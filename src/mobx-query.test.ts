import { DefaultError, QueryClient, QueryKey } from '@tanstack/query-core';
import { reaction, when } from 'mobx';
import { describe, expect, it, vi } from 'vitest';

import { MobxQuery, MobxQueryConfig } from './mobx-query';

describe('MobxQuery', () => {
  const testQueryClient = new QueryClient({});
  class TestMobxQuery<
    TData,
    TError = DefaultError,
    TQueryKey extends QueryKey = any,
  > extends MobxQuery<TData, TError, TQueryKey> {
    constructor(
      options: Omit<MobxQueryConfig<TData, TError, TQueryKey>, 'queryClient'>,
    ) {
      super({ ...options, queryClient: testQueryClient });
    }
  }

  it('to be defined', () => {
    const mobxQuery = new TestMobxQuery({
      queryKey: ['test'],
      queryFn: () => {},
    });
    expect(mobxQuery).toBeDefined();
  });

  it('"result" field should be reactive', async () => {
    let counter = 0;
    const mobxQuery = new TestMobxQuery({
      queryKey: ['test'],
      queryFn: () => {
        return ++counter;
      },
    });
    const spy = vi.fn();

    const dispose = reaction(
      () => mobxQuery.result,
      (result) => {
        spy(result.data);
      },
    );

    await when(() => mobxQuery.result.isLoading);

    expect(spy).toBeCalledTimes(1);
    expect(spy).nthCalledWith(1, 1);

    dispose();
  });
});

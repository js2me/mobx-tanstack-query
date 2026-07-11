import type { InfiniteData } from '@tanstack/query-core';
import { FetchInfiniteQuery, QueryClient } from 'mobx-tanstack-query';
import { describe, expect, expectTypeOf, it } from 'vitest';
import { createFetchInfiniteQuery } from './create-fetch-infinite-query.js';

describe('createFetchInfiniteQuery', () => {
  it('preserves typings for overloads', () => {
    type User = {
      id: string;
      email: string;
    };

    // options-only overload — queryClient defaults to preset
    const queryFromOptions = createFetchInfiniteQuery({
      params: () => ({ path: '/users' }),
      initialPageParam: 0,
      getNextPageParam: () => undefined,
    });

    expectTypeOf(queryFromOptions.data).toMatchTypeOf<
      InfiniteData<unknown, unknown> | undefined
    >();

    // options-only overload with explicit generics
    const queryFromOptionsWithGenerics = createFetchInfiniteQuery<User>({
      params: () => ({ path: '/users' }),
      initialPageParam: 0,
      getNextPageParam: () => undefined,
    });

    expectTypeOf(queryFromOptionsWithGenerics.data).toMatchTypeOf<
      InfiniteData<User, unknown> | undefined
    >();

    // options-only overload with select
    const queryFromOptionsWithSelect = createFetchInfiniteQuery<
      User,
      Error,
      number,
      string
    >({
      params: () => ({ path: '/users' }),
      initialPageParam: 0,
      getNextPageParam: () => undefined,
      select: (data) => data.pages.map((u) => u.email).join(','),
    });

    expectTypeOf(queryFromOptionsWithSelect.data).toEqualTypeOf<
      string | undefined
    >();

    // queryClient + dynamic options overload
    const queryFromClientAndOptions = createFetchInfiniteQuery<
      User,
      Error,
      number,
      string
    >(new QueryClient(), () => ({
      params: () => ({ path: '/users' }),
      initialPageParam: 0,
      getNextPageParam: () => undefined,
      select: (data) => data.pages.map((u) => u.email).join(','),
    }));

    expectTypeOf(queryFromClientAndOptions.data).toEqualTypeOf<
      string | undefined
    >();

    // queryClient + static options overload
    const queryFromClientAndStaticOptions = createFetchInfiniteQuery<User>(
      new QueryClient(),
      {
        params: () => ({ path: '/users' }),
        initialPageParam: 0,
        getNextPageParam: () => undefined,
      },
    );

    expectTypeOf(queryFromClientAndStaticOptions.data).toMatchTypeOf<
      InfiniteData<User, unknown> | undefined
    >();

    // with explicit TPageParam generic
    const queryWithPageParam = createFetchInfiniteQuery<User, Error, number>({
      params: () => ({ path: '/users', pageParam: 0 }),
      initialPageParam: 0,
      getNextPageParam: (lastPage, _allPages, lastPageParam) =>
        lastPage.id ? lastPageParam + 1 : undefined,
    });

    expectTypeOf(queryWithPageParam.data).toMatchTypeOf<
      InfiniteData<User, number> | undefined
    >();
  });

  it('returns FetchInfiniteQuery instance from options overload', () => {
    const query = createFetchInfiniteQuery({
      params: () => ({ path: '/test' }),
      initialPageParam: 0,
      getNextPageParam: () => undefined,
    });

    expect(query).toBeInstanceOf(FetchInfiniteQuery);

    query.destroy();
  });

  it('returns FetchInfiniteQuery instance from queryClient overload', () => {
    const client = new QueryClient();
    const query = createFetchInfiniteQuery(client, {
      params: () => ({ path: '/test' }),
      initialPageParam: 0,
      getNextPageParam: () => undefined,
    });

    expect(query).toBeInstanceOf(FetchInfiniteQuery);

    query.destroy();
  });

  it('uses preset queryClient when not provided', () => {
    const query = createFetchInfiniteQuery({
      params: () => ({ path: '/test' }),
      initialPageParam: 0,
      getNextPageParam: () => undefined,
    });

    expect(query).toBeInstanceOf(FetchInfiniteQuery);

    query.destroy();
  });

  it('uses explicit queryClient in single options overload', () => {
    const customClient = new QueryClient();

    const query = createFetchInfiniteQuery({
      queryClient: customClient,
      params: () => ({ path: '/test' }),
      initialPageParam: 0,
      getNextPageParam: () => undefined,
    });

    expect(query).toBeInstanceOf(FetchInfiniteQuery);

    query.destroy();
  });
});

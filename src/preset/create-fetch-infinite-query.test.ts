import type { InfiniteData } from '@tanstack/query-core';
import { observable, runInAction, when } from 'mobx';
import {
  FetchInfiniteQuery,
  getQueryClient,
  QueryClient,
} from 'mobx-tanstack-query';
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  expectTypeOf,
  it,
  vi,
} from 'vitest';
import { createFetchInfiniteQuery } from './create-fetch-infinite-query.js';
import { queryClient as presetQueryClient } from './query-client.js';

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

    // 1-arg function overload — queryClient defaults to preset
    const queryFromFunction = createFetchInfiniteQuery<User>(() => ({
      params: () => ({ path: '/users' }),
      initialPageParam: 0,
      getNextPageParam: () => undefined,
    }));

    expectTypeOf(queryFromFunction.data).toMatchTypeOf<
      InfiniteData<User, unknown> | undefined
    >();

    // 1-arg function overload with select
    const queryFromFunctionWithSelect = createFetchInfiniteQuery<
      User,
      Error,
      number,
      string
    >(() => ({
      params: () => ({ path: '/users' }),
      initialPageParam: 0,
      getNextPageParam: () => undefined,
      select: (data) => data.pages.map((u) => u.email).join(','),
    }));

    expectTypeOf(queryFromFunctionWithSelect.data).toEqualTypeOf<
      string | undefined
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

    expect(getQueryClient(query)).toBe(presetQueryClient);

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

  describe('fetching', () => {
    let fetchSpy: ReturnType<typeof vi.fn>;

    beforeEach(() => {
      fetchSpy = vi.fn();
      vi.stubGlobal('fetch', fetchSpy);
    });

    afterEach(() => {
      vi.unstubAllGlobals();
    });

    const okJson = (data: unknown) =>
      new Response(JSON.stringify(data), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });

    it('fetches from the queryClient + object options overload', async () => {
      fetchSpy.mockResolvedValueOnce(okJson({ id: 1 }));

      const query = createFetchInfiniteQuery(new QueryClient(), {
        params: { path: '/users' },
        initialPageParam: 0,
        getNextPageParam: () => undefined,
      });

      await when(() => !query.isLoading);

      expect(fetchSpy).toHaveBeenCalledWith('/users', expect.any(Object));
      expect(query.data?.pages[0]).toEqual({ id: 1 });

      query.destroy();
    });

    it('fetches from the queryClient + function options overload', async () => {
      fetchSpy.mockResolvedValueOnce(okJson({ id: 2 }));

      const query = createFetchInfiniteQuery(new QueryClient(), () => ({
        params: { path: '/users' },
        initialPageParam: 0,
        getNextPageParam: () => undefined,
      }));

      await when(() => !query.isLoading);

      expect(fetchSpy).toHaveBeenCalledWith('/users', expect.any(Object));
      expect(query.data?.pages[0]).toEqual({ id: 2 });

      query.destroy();
    });

    it('fetches from the function config overload with explicit queryClient', async () => {
      fetchSpy.mockResolvedValueOnce(okJson({ id: 3 }));

      const query = createFetchInfiniteQuery(() => ({
        queryClient: new QueryClient(),
        params: { path: '/users' },
        initialPageParam: 0,
        getNextPageParam: () => undefined,
      }));

      await when(() => !query.isLoading);

      expect(fetchSpy).toHaveBeenCalledWith('/users', expect.any(Object));
      expect(query.data?.pages[0]).toEqual({ id: 3 });

      query.destroy();
    });

    it('uses the preset queryClient in the function config overload', async () => {
      fetchSpy.mockResolvedValueOnce(okJson({ id: 4 }));

      const query = createFetchInfiniteQuery(() => ({
        params: { path: '/users' },
        initialPageParam: 0,
        getNextPageParam: () => undefined,
      }));

      await when(() => !query.isLoading);

      expect(fetchSpy).toHaveBeenCalledWith('/users', expect.any(Object));
      expect(query.data?.pages[0]).toEqual({ id: 4 });

      query.destroy();
    });

    it('refetches when observables inside the function config change', async () => {
      fetchSpy
        .mockResolvedValueOnce(okJson({ id: 1 }))
        .mockResolvedValueOnce(okJson({ id: 2 }));

      const state = observable({ id: 1 });
      const query = createFetchInfiniteQuery(() => ({
        queryClient: new QueryClient(),
        params: { path: `/users/${state.id}` },
        initialPageParam: 0,
        getNextPageParam: () => undefined,
      }));

      await when(() => !query.isLoading);
      expect(query.data?.pages[0]).toEqual({ id: 1 });

      runInAction(() => {
        state.id = 2;
      });

      await when(() => (query.data?.pages[0] as any)?.id === 2);
      expect(fetchSpy).toHaveBeenCalledTimes(2);

      query.destroy();
    });
  });
});

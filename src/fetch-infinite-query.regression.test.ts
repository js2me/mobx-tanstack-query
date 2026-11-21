import { QueryClient } from '@tanstack/query-core';
import { observable, runInAction, when } from 'mobx';
import { afterEach, expect, it, vi } from 'vitest';
import { FetchInfiniteQuery } from './fetch-infinite-query.js';

afterEach(() => vi.unstubAllGlobals());

it('separates caches with different initial page params without changing the key across pages', async () => {
  const queryClient = new QueryClient();
  const fetchSpy = vi.fn(
    async (url: string) => new Response(JSON.stringify({ url })),
  );
  vi.stubGlobal('fetch', fetchSpy);

  const makeQuery = (initialPageParam: number) =>
    new FetchInfiniteQuery({
      queryClient,
      params: ({ pageParam }) => ({
        path: '/items',
        query: { page: pageParam },
      }),
      initialPageParam,
      getNextPageParam: (_page, _pages, lastPageParam) =>
        lastPageParam < 2 ? lastPageParam + 1 : null,
    });

  const first = makeQuery(1);
  await when(() => first.isSuccess);
  const second = makeQuery(2);
  await when(() => second.isSuccess);

  expect(first.options.queryHash).not.toBe(second.options.queryHash);
  expect(fetchSpy).toHaveBeenCalledTimes(2);
  expect(second.data?.pages).toEqual([{ url: '/items?page=2' }]);

  const firstHash = first.options.queryHash;
  await first.fetchNextPage();
  expect(first.options.queryHash).toBe(firstHash);
  expect(fetchSpy).toHaveBeenCalledTimes(3);
  expect(fetchSpy).toHaveBeenLastCalledWith(
    '/items?page=2',
    expect.any(Object),
  );

  first.destroy();
  second.destroy();
});

it('does not reuse a key-time transform when the page callback omits it', async () => {
  const queryClient = new QueryClient();
  const fetchSpy = vi.fn(
    async () => new Response(JSON.stringify({ value: 1 })),
  );
  vi.stubGlobal('fetch', fetchSpy);

  const query = new FetchInfiniteQuery({
    queryClient,
    params: ({ pageParam }) => ({
      path: '/items',
      transformKey: 'key-time',
      transformResponse:
        pageParam === undefined ? async () => ({ value: 999 }) : undefined,
    }),
    initialPageParam: 1,
    getNextPageParam: () => null,
  });

  await when(() => query.isSuccess);
  expect(query.data?.pages).toEqual([{ value: 1 }]);
  query.destroy();
});

it('clears previous start params when explicitly passed null', async () => {
  const queryClient = new QueryClient();
  const fetchSpy = vi.fn(
    async () => new Response(JSON.stringify({ ok: true })),
  );
  vi.stubGlobal('fetch', fetchSpy);

  const query = new FetchInfiniteQuery({
    queryClient,
    initialPageParam: 1,
    getNextPageParam: () => null,
    retry: false,
  });

  await query.start({ params: { path: '/items' } });
  const result = await query.start({ params: null });
  expect(result.error?.message).toContain('Error #2');
  expect(query.options.queryKey).toEqual([null]);
  expect(fetchSpy).toHaveBeenCalledTimes(1);
  query.destroy();
});

it('reacts to enabled and keeps inline transforms with the same transformKey in one cache entry', async () => {
  const fetchSpy = vi.fn(async () => new Response('1'));
  vi.stubGlobal('fetch', fetchSpy);
  const queryClient = new QueryClient();
  const state = observable({ enabled: false, revision: 0 });
  const create = (transformKey: string, factor: number) =>
    new FetchInfiniteQuery(() => ({
      queryClient,
      enabled: state.enabled,
      staleTime: Infinity,
      meta: { revision: state.revision },
      initialPageParam: 1,
      getNextPageParam: () => null,
      params: {
        path: '/items',
        transformKey,
        transformResponse: async (response: Response) =>
          Number(await response.text()) * factor,
      },
    }));
  const first = create('single', 1);
  expect(fetchSpy).not.toHaveBeenCalled();
  runInAction(() => {
    state.enabled = true;
  });
  await when(() => first.isSuccess);
  const second = create('single', 1);
  const doubled = create('double', 2);
  await when(() => second.isSuccess && doubled.isSuccess);
  runInAction(() => {
    state.revision++;
  });
  await when(() => first.options.meta?.revision === 1);
  expect(first.options.queryHash).toBe(second.options.queryHash);
  expect(first.data?.pages).toEqual([1]);
  expect(doubled.data?.pages).toEqual([2]);
  expect(fetchSpy).toHaveBeenCalledTimes(2);
  first.destroy();
  second.destroy();
  doubled.destroy();
});

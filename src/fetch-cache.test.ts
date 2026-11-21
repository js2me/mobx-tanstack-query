import { dehydrate, hashKey, hydrate } from '@tanstack/query-core';
import { observable, runInAction, when } from 'mobx';
import { afterEach, expect, expectTypeOf, it, vi } from 'vitest';
import { FetchInfiniteQuery } from './fetch-infinite-query.js';
import { buildFetchQueryKey, FetchQuery } from './fetch-query.js';
import { createFetchQuery } from './preset/create-fetch-query.js';
import { QueryClient } from './query-client.js';

afterEach(() => vi.unstubAllGlobals());

it('refetches hydrated data with the active parser and headers', async () => {
  const fetch = vi.fn(async () => new Response('{"value":42}'));
  vi.stubGlobal('fetch', fetch);
  const config = {
    enabled: false,
    cacheScope: ['gitlab', 'user-1'],
    transformKey: 'value',
    transformResponse: async (res: Response): Promise<number> =>
      (await res.json()).value,
    params: { path: '/data', headers: { Authorization: 'old-secret' } },
  };
  const client = new QueryClient();
  const first = new FetchQuery(client, config);
  expectTypeOf(first.data).toEqualTypeOf<number | null | undefined>();
  await first.refetch();
  const serialized = JSON.stringify(dehydrate(client));
  expect(serialized).not.toContain('old-secret');
  const nextClient = new QueryClient();
  hydrate(nextClient, JSON.parse(serialized));
  const second = new FetchQuery(nextClient, {
    ...config,
    params: { ...config.params, headers: { Authorization: 'new-secret' } },
  });
  expect(second.data).toBe(42);
  expect((await second.refetch()).data).toBe(42);
  expect(fetch).toHaveBeenLastCalledWith(
    '/data',
    expect.objectContaining({ headers: { Authorization: 'new-secret' } }),
  );
  first.destroy();
  second.destroy();
});

it('keeps account caches separate and reuses a scope on return', async () => {
  const auth = observable({ account: 'alice', token: 'token-A' });
  const fetch = vi.fn(
    async (_url: string, init: RequestInit) =>
      new Response(
        JSON.stringify(new Headers(init.headers).get('Authorization')),
      ),
  );
  vi.stubGlobal('fetch', fetch);
  const queryClient = new QueryClient();
  const query = new FetchQuery(() => ({
    queryClient,
    cacheScope: { account: auth.account },
    staleTime: Infinity,
    params: { path: '/me', headers: { Authorization: auth.token } },
  }));
  await when(() => query.data === 'token-A');
  const firstHash = query.options.queryHash;
  runInAction(() => {
    auth.token = 'token-B';
  });
  expect(query.options.queryHash).toBe(firstHash);
  expect(fetch).toHaveBeenCalledTimes(1);
  expect((await query.refetch()).data).toBe('token-B');
  runInAction(() => {
    auth.account = 'bob';
    auth.token = 'token-C';
  });
  await when(() => query.data === 'token-C');
  expect(query.options.queryHash).not.toBe(firstHash);
  runInAction(() => {
    auth.account = 'alice';
    auth.token = 'token-B';
  });
  await when(() => query.data === 'token-B');
  expect(fetch).toHaveBeenCalledTimes(3);
  query.destroy();
});

it('refetches an inactive cache entry with its own request snapshot', async () => {
  const account = observable.box('alice');
  const queryClient = new QueryClient();
  const fetch = vi.fn(
    async (_url: string, init: RequestInit) =>
      new Response(
        JSON.stringify(new Headers(init.headers).get('Authorization')),
      ),
  );
  vi.stubGlobal('fetch', fetch);
  const query = new FetchQuery(() => ({
    queryClient,
    cacheScope: account.get(),
    params: { path: '/user', headers: { Authorization: account.get() } },
  }));
  await when(() => query.data === 'alice');
  const aliceKey = query.options.queryKey;
  runInAction(() => account.set('bob'));
  await when(() => query.data === 'bob');
  await queryClient.refetchQueries({
    queryKey: aliceKey,
    exact: true,
    type: 'inactive',
  });
  expect(fetch).toHaveBeenCalledTimes(3);
  expect(queryClient.getQueryData(aliceKey)).toBe('alice');
  expect(query.data).toBe('bob');
  query.destroy();
});

it('uses typed page context and accepts fresh inline parsers across pages', async () => {
  const fetch = vi.fn(async () => new Response('2'));
  vi.stubGlobal('fetch', fetch);
  for (const inline of [false, true]) {
    const query = new FetchInfiniteQuery({
      queryClient: new QueryClient(),
      cacheScope: 'my-account',
      initialPageParam: 1,
      getNextPageParam: () => 2,
      transformResponse: async (response, { pageParam }) => {
        expectTypeOf(pageParam).toEqualTypeOf<number>();
        return Number(await response.text()) * pageParam;
      },
      params: ({ pageParam }) => ({
        path: '/pages',
        query: { page: pageParam },
        transformResponse: inline
          ? async (res: Response) => Number(await res.text()) * (pageParam ?? 0)
          : undefined,
      }),
    });
    await when(() => query.isSuccess);
    const result = await query.fetchNextPage();
    expect(result.data?.pages).toEqual([2, 4]);
    expect(query.options.queryHash).toContain('my-account');
    query.destroy();
  }
});

it('distinguishes URL-encoded, opaque and binary request bodies', () => {
  const key = (body: BodyInit, bodyKey?: string) =>
    hashKey(buildFetchQueryKey({ path: '/data', body, bodyKey }));
  expect(key(new URLSearchParams('x=1'))).not.toBe(
    key(new URLSearchParams('x=2')),
  );
  expect(key(new URLSearchParams('x=1'))).not.toBe(key('x=1'));
  expect(key(new Uint8Array([1]))).not.toBe(key(new Uint8Array([2])));
  expect(key(new Blob(['a']))).not.toBe(key(new Blob(['b'])));
  expect(key(new Blob(['a']), 'digest-a')).toBe(
    key(new Blob(['a']), 'digest-a'),
  );
});

it('requires a selector to change the result type', () => {
  const query = createFetchQuery({
    enabled: false,
    params: { path: '/n' },
    transformResponse: () => 42,
    select: (n) => String(n ?? 0),
  });
  expectTypeOf(query.data).toEqualTypeOf<string | undefined>();
  query.destroy();
  // @ts-expect-error Number responses require a selector to produce strings.
  new FetchQuery<number, string>({
    queryClient: new QueryClient(),
    enabled: false,
    transformResponse: () => 42,
  }).destroy();
  // @ts-expect-error The preset has the same selector requirement.
  createFetchQuery<number, string>({ enabled: false }).destroy();
});

it.each([
  [500, 4],
  [404, 1],
])('retries HTTP %i the expected number of times with the preset', async (status, attempts) => {
  const fetch = vi.fn(async () => new Response(null, { status }));
  vi.stubGlobal('fetch', fetch);
  const query = createFetchQuery({
    enabled: false,
    retryDelay: 0,
    params: { path: `/retry/${status}` },
  });
  await expect(query.refetch()).rejects.toHaveProperty(
    'response.status',
    status,
  );
  expect(fetch).toHaveBeenCalledTimes(attempts);
  query.destroy();
});

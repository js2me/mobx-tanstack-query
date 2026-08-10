import { QueryClient } from '@tanstack/query-core';
import { when } from 'mobx';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FetchInfiniteQuery } from './fetch-infinite-query.js';

const okJson = (data: unknown, init?: ResponseInit) =>
  new Response(JSON.stringify(data), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
    ...init,
  });

describe('FetchInfiniteQuery', () => {
  let queryClient: QueryClient;
  let fetchSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    queryClient = new QueryClient();
    fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('encodes pageParam into the request for each page', async () => {
    fetchSpy.mockImplementation((url: string) =>
      Promise.resolve(okJson({ url })),
    );

    const query = new FetchInfiniteQuery({
      queryClient,
      params: ({ pageParam }) => ({
        path: '/stars',
        query: { page: pageParam },
      }),
      initialPageParam: 1,
      getNextPageParam: (_lastPage, _allPages, lastPageParam) =>
        lastPageParam < 2 ? lastPageParam + 1 : null,
    });

    await when(() => !query.isLoading);

    expect(fetchSpy).toHaveBeenNthCalledWith(
      1,
      '/stars?page=1',
      expect.any(Object),
    );
    expect(query.hasNextPage).toBe(true);

    await query.fetchNextPage();
    await when(() => !query.isFetchingNextPage);

    expect(fetchSpy).toHaveBeenNthCalledWith(
      2,
      '/stars?page=2',
      expect.any(Object),
    );
    expect(query.hasNextPage).toBe(false);

    query.destroy();
  });

  it('keeps a stable query key across pages', async () => {
    fetchSpy.mockImplementation((url: string) =>
      Promise.resolve(okJson({ url })),
    );

    const query = new FetchInfiniteQuery({
      queryClient,
      params: ({ pageParam }) => ({
        path: '/stars',
        query: { page: pageParam },
      }),
      initialPageParam: 1,
      getNextPageParam: (_lastPage, _allPages, lastPageParam) =>
        lastPageParam < 2 ? lastPageParam + 1 : null,
    });

    await when(() => !query.isLoading);
    const queryHash = query.options.queryHash;

    await query.fetchNextPage();
    await when(() => !query.isFetchingNextPage);

    expect(query.options.queryHash).toBe(queryHash);
    expect(query.data?.pages).toHaveLength(2);

    query.destroy();
  });

  it('does not include pageParam in the query key', async () => {
    fetchSpy.mockImplementation((url: string) =>
      Promise.resolve(okJson({ url })),
    );

    const query = new FetchInfiniteQuery({
      queryClient,
      params: ({ pageParam }) => ({
        path: '/stars',
        query: { count: 20, page: pageParam },
      }),
      initialPageParam: 1,
      getNextPageParam: () => null,
    });

    await when(() => !query.isLoading);

    // the serialized query segment of the key contains no pagination data
    expect(query.options.queryKey[2]).toEqual({ count: '20' });
    // ...while the request itself carries the real pageParam
    expect(fetchSpy).toHaveBeenCalledWith(
      '/stars?count=20&page=1',
      expect.any(Object),
    );

    query.destroy();
  });

  describe('start()', () => {
    it('fetches using the params passed to start', async () => {
      fetchSpy.mockImplementation((url: string) =>
        Promise.resolve(okJson({ url })),
      );

      const query = new FetchInfiniteQuery({
        queryClient,
        initialPageParam: 1,
        getNextPageParam: () => null,
      });

      expect(fetchSpy).not.toHaveBeenCalled();

      await query.start({
        params: { path: '/stars' },
      });

      expect(fetchSpy).toHaveBeenCalledWith('/stars', expect.any(Object));
      expect(query.isSuccess).toBe(true);

      query.destroy();
    });

    it('paginates with a page-aware params callback passed to start', async () => {
      fetchSpy.mockImplementation((url: string) =>
        Promise.resolve(okJson({ url })),
      );

      const query = new FetchInfiniteQuery({
        queryClient,
        initialPageParam: 1,
        getNextPageParam: (_lastPage, _allPages, lastPageParam) =>
          lastPageParam < 2 ? lastPageParam + 1 : null,
      });

      await query.start({
        params: ({ pageParam }) => ({
          path: '/stars',
          query: { page: pageParam },
        }),
      });

      expect(fetchSpy).toHaveBeenNthCalledWith(
        1,
        '/stars?page=1',
        expect.any(Object),
      );

      await query.fetchNextPage();
      await when(() => !query.isFetchingNextPage);

      expect(fetchSpy).toHaveBeenNthCalledWith(
        2,
        '/stars?page=2',
        expect.any(Object),
      );

      query.destroy();
    });

    it('preserves meta from start params and additional start options', async () => {
      fetchSpy.mockImplementation((url: string) =>
        Promise.resolve(okJson({ url })),
      );

      const query = new FetchInfiniteQuery({
        queryClient,
        initialPageParam: 1,
        getNextPageParam: () => null,
      });

      await query.start({
        params: { path: '/stars', meta: { source: 'start' } },
        staleTime: 1000,
      });

      expect(query.options.meta).toEqual({ source: 'start' });
      expect(query.options.staleTime).toBe(1000);

      query.destroy();
    });
  });
});

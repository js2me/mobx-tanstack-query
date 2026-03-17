import {
  type DefaultError,
  type FetchNextPageOptions,
  type FetchPreviousPageOptions,
  type InfiniteData,
  type Query,
  QueryClient,
  type QueryKey,
  type RefetchOptions,
} from '@tanstack/query-core';
import { observable, runInAction, when } from 'mobx';
import { describe, expect, expectTypeOf, it, vi } from 'vitest';
import { sleep } from 'yummies/async';

import { InfiniteQuery } from './inifinite-query.js';
import type {
  InfiniteQueryConfig,
  InfiniteQueryUpdateOptionsAllVariants,
} from './inifinite-query.types.js';
import type { QueryInvalidateParams } from './query.types.js';

class InfiniteQueryMock<
  TQueryFnData = unknown,
  TError = DefaultError,
  TPageParam = unknown,
  TData = InfiniteData<TQueryFnData, TPageParam>,
  TQueryKey extends QueryKey = QueryKey,
> extends InfiniteQuery<TQueryFnData, TError, TPageParam, TData, TQueryKey> {
  spies = {
    queryFn: null as unknown as ReturnType<typeof vi.fn>,
    setData: vi.fn(),
    update: vi.fn(),
    dispose: vi.fn(),
    refetch: vi.fn(),
    invalidate: vi.fn(),
    onDone: vi.fn(),
    onError: vi.fn(),
    fetchNextPage: vi.fn(),
    fetchPreviousPage: vi.fn(),
  };

  constructor(
    options: Omit<
      InfiniteQueryConfig<TQueryFnData, TError, TPageParam, TData, TQueryKey>,
      'queryClient'
    >,
  ) {
    super({
      ...options,
      queryClient: new QueryClient({}),
      queryFn: vi.fn((...args: any[]) => {
        // @ts-expect-error
        const result = options.queryFn?.(...args);
        return result;
      }),
    });

    this.spies.queryFn = this.options.queryFn as any;

    this.onDone(this.spies.onDone);
    this.onError(this.spies.onError);
  }

  get _rawResult() {
    return this._result;
  }

  refetch(options?: RefetchOptions | undefined) {
    this.spies.refetch(options);
    return super.refetch(options);
  }

  invalidate(params?: QueryInvalidateParams | undefined): Promise<void> {
    this.spies.invalidate(params)();
    return super.invalidate();
  }

  update(
    options: InfiniteQueryUpdateOptionsAllVariants<
      TQueryFnData,
      TError,
      TPageParam,
      TData,
      TQueryKey
    >,
  ) {
    const result = super.update(options);
    this.spies.update.mockReturnValue(result)(options);
    return result;
  }

  async fetchNextPage(options?: FetchNextPageOptions | undefined) {
    const result = await super.fetchNextPage(options);
    this.spies.fetchNextPage.mockReturnValue(result)(options);
    return result;
  }

  async fetchPreviousPage(options?: FetchPreviousPageOptions | undefined) {
    const result = await super.fetchPreviousPage(options);
    this.spies.fetchPreviousPage.mockReturnValue(result)(options);
    return result;
  }

  setData(updater: any, options?: any) {
    const result = super.setData(updater, options);
    this.spies.setData.mockReturnValue(result)(updater, options);
    return result;
  }

  dispose(): void {
    const result = super.dispose();
    this.spies.dispose.mockReturnValue(result)();
  }
}

describe('InfiniteQuery', () => {
  it('should call queryFn without infinite query params', async () => {
    // @ts-expect-error
    const query = new InfiniteQueryMock({
      queryKey: ['test'],
      queryFn: () => {},
    });

    expect(query.spies.queryFn).toBeCalledTimes(1);
    expect(query.spies.queryFn).toBeCalledWith({
      ...query.spies.queryFn.mock.calls[0][0],
      direction: 'forward',
      meta: undefined,
      pageParam: undefined,
      queryKey: ['test'],
    });

    query.dispose();
  });

  it('should call queryFn with initialPageParam', async () => {
    const query = new InfiniteQueryMock({
      queryKey: ['test'],
      initialPageParam: 0,
      getNextPageParam: () => undefined,
      queryFn: () => {},
    });

    expect(query.spies.queryFn).toBeCalledTimes(1);
    expect(query.spies.queryFn).toBeCalledWith({
      ...query.spies.queryFn.mock.calls[0][0],
      direction: 'forward',
      meta: undefined,
      pageParam: 0,
      queryKey: ['test'],
    });

    query.dispose();
  });

  it('should use initialPageParam from dynamic options without top-level initialPageParam', async () => {
    type PageParam = {
      limit: number;
      offset: number;
      total: number;
    };

    type PageData = {
      data: Record<string, { items: number[] }>;
    };

    const initialPageParam = {
      limit: 2,
      offset: 0,
      total: 3,
    } satisfies PageParam;

    const queryFn = vi.fn(async ({ pageParam }: { pageParam: PageParam }) => {
      return {
        data: {
          group: {
            items: [pageParam.offset + 1],
          },
        },
      } satisfies PageData;
    });

    const query = new InfiniteQuery({
      queryClient: new QueryClient({}),
      options: () => ({
        enabled: true,
        queryKey: ['dynamic-initial-page-param'],
        initialPageParam,
      }),
      queryFn,
      refetchInterval: (infiniteQuery) => {
        const pagesCount = infiniteQuery.state.data?.pages.length ?? 0;

        if (pagesCount === 1 && infiniteQuery.state.status === 'success') {
          return 15_000;
        }

        return false;
      },
      getNextPageParam: (lastPage, _, lastPageParam) => {
        const lastLoadedItems = Object.values(lastPage.data || {})[0]?.items;

        if (!lastLoadedItems?.length) {
          return undefined;
        }

        const nextOffset = lastPageParam.offset + lastPageParam.limit;

        if (nextOffset > lastPageParam.total) {
          return undefined;
        }

        return {
          limit: lastPageParam.limit,
          offset: nextOffset,
          total: lastPageParam.total,
        };
      },
    });

    await when(() => !query.result.isLoading);

    expect(queryFn).toBeCalledTimes(1);
    expect(queryFn).toBeCalledWith({
      ...queryFn.mock.calls[0][0],
      direction: 'forward',
      meta: undefined,
      pageParam: initialPageParam,
      queryKey: ['dynamic-initial-page-param'],
    });

    await query.fetchNextPage();

    expect(queryFn).toBeCalledTimes(2);
    expect(queryFn).toHaveBeenLastCalledWith({
      ...queryFn.mock.calls[1][0],
      direction: 'forward',
      meta: undefined,
      pageParam: {
        limit: 2,
        offset: 2,
        total: 3,
      },
      queryKey: ['dynamic-initial-page-param'],
    });

    expect(query.result.data).toStrictEqual({
      pageParams: [
        {
          limit: 2,
          offset: 0,
          total: 3,
        },
        {
          limit: 2,
          offset: 2,
          total: 3,
        },
      ],
      pages: [
        {
          data: {
            group: {
              items: [1],
            },
          },
        },
        {
          data: {
            group: {
              items: [3],
            },
          },
        },
      ],
    });

    query.destroy();
  });

  it('should call queryFn with getNextPageParam', async () => {
    const query = new InfiniteQueryMock({
      queryKey: ['test'],
      initialPageParam: undefined,
      getNextPageParam: () => 1,
      queryFn: () => {},
    });

    expect(query.spies.queryFn).toBeCalledTimes(1);
    expect(query.spies.queryFn).toBeCalledWith({
      ...query.spies.queryFn.mock.calls[0][0],
      direction: 'forward',
      meta: undefined,
      pageParam: undefined,
      queryKey: ['test'],
    });

    query.dispose();
  });

  it('should call queryFn with getNextPageParam returning null', async () => {
    const query = new InfiniteQueryMock({
      queryKey: ['test'],
      initialPageParam: undefined,
      getNextPageParam: () => null,
      queryFn: async () => 'data',
    });

    expect(query.spies.queryFn).toBeCalledTimes(1);
    expect(query.spies.queryFn).toBeCalledWith({
      ...query.spies.queryFn.mock.calls[0][0],
      direction: 'forward',
      meta: undefined,
      pageParam: undefined,
      queryKey: ['test'],
    });

    await when(() => !query.result.isLoading);

    expect(query.result).toStrictEqual({
      ...query.result,
      data: {
        pageParams: [undefined],
        pages: ['data'],
      },
      error: null,
      errorUpdateCount: 0,
      errorUpdatedAt: 0,
      failureCount: 0,
      failureReason: null,
      fetchStatus: 'idle',
      hasNextPage: false,
      hasPreviousPage: false,
      isError: false,
      isFetchNextPageError: false,
      isFetchPreviousPageError: false,
      isFetched: true,
      isFetchedAfterMount: true,
      isFetching: false,
      isFetchingNextPage: false,
      isFetchingPreviousPage: false,
      isInitialLoading: false,
      isLoading: false,
      isLoadingError: false,
      isPaused: false,
      isPending: false,
      isPlaceholderData: false,
      isRefetchError: false,
      isRefetching: false,
      isStale: true,
      isSuccess: true,
      status: 'success',
    });

    query.dispose();
  });

  it('should call queryFn after fetchNextPage call', async () => {
    const query = new InfiniteQueryMock({
      queryKey: ['test'],
      initialPageParam: 1,
      getNextPageParam: (_, _1, lastPageParam) => lastPageParam + 1,
      queryFn: () => {
        return [1, 2, 3];
      },
    });

    expect(query.result).toStrictEqual({
      ...query.result,
      data: undefined,
      dataUpdatedAt: 0,
      error: null,
      errorUpdateCount: 0,
      errorUpdatedAt: 0,
      failureCount: 0,
      failureReason: null,
      fetchStatus: 'fetching',
      hasNextPage: false,
      hasPreviousPage: false,
      isError: false,
      isFetchNextPageError: false,
      isFetchPreviousPageError: false,
      isFetched: false,
      isFetchedAfterMount: false,
      isFetching: true,
      isFetchingNextPage: false,
      isFetchingPreviousPage: false,
      isInitialLoading: true,
      isLoading: true,
      isLoadingError: false,
      isPaused: false,
      isPending: true,
      isPlaceholderData: false,
      isRefetchError: false,
      isRefetching: false,
      isStale: true,
      isSuccess: false,
      status: 'pending',
    });

    await query.fetchNextPage();

    expect(query.spies.fetchNextPage).toBeCalledTimes(1);
    expect(query.spies.queryFn).toBeCalledTimes(1);

    expect(query.result).toStrictEqual({
      ...query.result,
      data: {
        pageParams: [1],
        pages: [[1, 2, 3]],
      },
      error: null,
      errorUpdateCount: 0,
      errorUpdatedAt: 0,
      failureCount: 0,
      failureReason: null,
      fetchStatus: 'idle',
      hasNextPage: true,
      hasPreviousPage: false,
      isError: false,
      isFetchNextPageError: false,
      isFetchPreviousPageError: false,
      isFetched: true,
      isFetchedAfterMount: true,
      isFetching: false,
      isFetchingNextPage: false,
      isFetchingPreviousPage: false,
      isInitialLoading: false,
      isLoading: false,
      isLoadingError: false,
      isPaused: false,
      isPending: false,
      isPlaceholderData: false,
      isRefetchError: false,
      isRefetching: false,
      isStale: true,
      isSuccess: true,
      status: 'success',
    });

    query.dispose();
  });

  it('should call queryFn after fetchNextPage call (x3 times)', async () => {
    const query = new InfiniteQueryMock({
      queryKey: ['test'],
      initialPageParam: 1,
      getNextPageParam: (_, _1, lastPageParam) => lastPageParam + 1,
      queryFn: ({ pageParam, queryKey }) => {
        return { data: pageParam, queryKey };
      },
    });

    expect(query.result).toStrictEqual({
      ...query.result,
      data: undefined,
      dataUpdatedAt: 0,
      error: null,
      errorUpdateCount: 0,
      errorUpdatedAt: 0,
      failureCount: 0,
      failureReason: null,
      fetchStatus: 'fetching',
      hasNextPage: false,
      hasPreviousPage: false,
      isError: false,
      isFetchNextPageError: false,
      isFetchPreviousPageError: false,
      isFetched: false,
      isFetchedAfterMount: false,
      isFetching: true,
      isFetchingNextPage: false,
      isFetchingPreviousPage: false,
      isInitialLoading: true,
      isLoading: true,
      isLoadingError: false,
      isPaused: false,
      isPending: true,
      isPlaceholderData: false,
      isRefetchError: false,
      isRefetching: false,
      isStale: true,
      isSuccess: false,
      status: 'pending',
    });

    await query.fetchNextPage();
    await query.fetchNextPage();
    await query.fetchNextPage();

    expect(query.result).toStrictEqual({
      ...query.result,
      data: {
        pageParams: [1, 2, 3],
        pages: [
          {
            data: 1,
            queryKey: ['test'],
          },
          {
            data: 2,
            queryKey: ['test'],
          },
          {
            data: 3,
            queryKey: ['test'],
          },
        ],
      },
      error: null,
      errorUpdateCount: 0,
      errorUpdatedAt: 0,
      failureCount: 0,
      failureReason: null,
      fetchStatus: 'idle',
      hasNextPage: true,
      hasPreviousPage: false,
      isError: false,
      isFetchNextPageError: false,
      isFetchPreviousPageError: false,
      isFetched: true,
      isFetchedAfterMount: true,
      isFetching: false,
      isFetchingNextPage: false,
      isFetchingPreviousPage: false,
      isInitialLoading: false,
      isLoading: false,
      isLoadingError: false,
      isPaused: false,
      isPending: false,
      isPlaceholderData: false,
      isRefetchError: false,
      isRefetching: false,
      isStale: true,
      isSuccess: true,
      status: 'success',
    });

    query.dispose();
  });

  describe('"enabled" reactive parameter', () => {
    it('should be reactive after change queryKey', async () => {
      const query = new InfiniteQueryMock({
        queryKey: ['test', 0 as number] as const,
        initialPageParam: undefined,
        enabled: ({ queryKey }) => queryKey[1] > 0,
        getNextPageParam: () => 1,
        queryFn: () => 100,
      });

      query.update({ queryKey: ['test', 1] as const });

      await when(() => !query.result.isLoading);

      expect(query.spies.queryFn).toBeCalledTimes(1);
      expect(query.spies.queryFn).nthReturnedWith(1, 100);

      query.dispose();
    });
  });

  it('onDone should call again after reactive queryKey change', async () => {
    const queryKeyPart = observable.box(1);
    const onDone = vi.fn();
    const query = new InfiniteQuery({
      queryClient: new QueryClient({}),
      queryKey: () =>
        ['infinite-on-done-query-key-change', queryKeyPart.get()] as const,
      initialPageParam: 0,
      getNextPageParam: () => undefined,
      queryFn: async ({ queryKey }) => ({
        value: `value-${queryKey[1]}`,
      }),
      onDone,
    });

    try {
      await when(() => query.result.data?.pages[0]?.value === 'value-1');

      runInAction(() => {
        queryKeyPart.set(2);
      });

      await when(() => query.result.data?.pages[0]?.value === 'value-2');

      expect(onDone).toBeCalledTimes(2);
      expect(onDone.mock.calls[0]?.[0]?.pages[0]).toStrictEqual({
        value: 'value-1',
      });
      expect(onDone.mock.calls[1]?.[0]?.pages[0]).toStrictEqual({
        value: 'value-2',
      });
    } finally {
      query.destroy();
    }
  });

  it('should not call onDone again when switching back to cached query without new fetch', async () => {
    const queryKeyPart = observable.box(1);
    const queryFn = vi.fn(async ({ queryKey }) => ({
      value: `value-${queryKey[1]}`,
    }));
    const onDone = vi.fn();
    const query = new InfiniteQuery({
      queryClient: new QueryClient({}),
      staleTime: Infinity,
      queryKey: () =>
        [
          'infinite-on-done-return-to-cached-query',
          queryKeyPart.get(),
        ] as const,
      initialPageParam: 0,
      getNextPageParam: () => undefined,
      queryFn,
      onDone,
    });

    try {
      await when(() => query.result.data?.pages[0]?.value === 'value-1');

      runInAction(() => {
        queryKeyPart.set(2);
      });

      await when(() => query.result.data?.pages[0]?.value === 'value-2');

      runInAction(() => {
        queryKeyPart.set(1);
      });

      await when(() => query.result.data?.pages[0]?.value === 'value-1');
      await sleep(20);

      expect(queryFn).toBeCalledTimes(2);
      expect(onDone).toBeCalledTimes(2);
    } finally {
      query.destroy();
    }
  });

  describe('typings', () => {
    it('should preserve page typings with refetchInterval callback', () => {
      type Service = {
        id: number;
      };

      type ServicePage = {
        meta: {
          pageNumber: number;
          pageSize: number;
          total: number;
        };
        services: Service[];
      };

      const queryClient = new QueryClient({});
      const initialPageParam = { page: 1, pageSize: 500 };

      const queryWithAny = new InfiniteQuery({
        queryClient,
        initialPageParam,
        options: () => ({
          enabled: true,
          queryKey: ['services-with-any'],
        }),
        queryFn: async ({ pageParam }) => {
          return {
            meta: {
              pageNumber: pageParam.page,
              pageSize: pageParam.pageSize,
              total: 1_000,
            },
            services: [{ id: 1 }],
          } satisfies ServicePage;
        },
        getNextPageParam: (lastPage) => {
          expectTypeOf(lastPage).toEqualTypeOf<ServicePage>();

          if (
            lastPage.meta.pageNumber * lastPage.meta.pageSize >=
            lastPage.meta.total
          ) {
            return undefined;
          }

          return {
            page: lastPage.meta.pageNumber + 1,
            pageSize: lastPage.meta.pageSize,
          };
        },
        refetchInterval: (query: any): number | false => {
          const pagesCount = query.state.data?.pages.length ?? 0;

          return pagesCount === 1 && query.state.status === 'success'
            ? 5000
            : false;
        },
        select: (data) => {
          expectTypeOf(data).toEqualTypeOf<
            InfiniteData<ServicePage, { page: number; pageSize: number }>
          >();

          return {
            ...data,
            total: data.pages.at(-1)?.meta.total ?? 0,
            services: data.pages.flatMap(({ services }) => services),
          };
        },
      });

      expectTypeOf(queryWithAny.result.data).toEqualTypeOf<
        | {
            total: number;
            services: {
              id: number;
            }[];
            pages: {
              meta: {
                pageNumber: number;
                pageSize: number;
                total: number;
              };
              services: {
                id: number;
              }[];
            }[];
            pageParams: {
              page: number;
              pageSize: number;
            }[];
          }
        | undefined
      >();

      const queryWithoutAny = new InfiniteQuery({
        queryClient,
        initialPageParam,
        options: () => ({
          enabled: true,
          queryKey: ['services-without-any'],
        }),
        queryFn: async ({ pageParam }) => {
          return {
            meta: {
              pageNumber: pageParam.page,
              pageSize: pageParam.pageSize,
              total: 1_000,
            },
            services: [{ id: 1 }],
          } satisfies ServicePage;
        },
        refetchInterval: (query): number | false => {
          const pagesCount = query.state.data?.pages.length ?? 0;

          return pagesCount === 1 && query.state.status === 'success'
            ? 5000
            : false;
        },
        getNextPageParam: (lastPage) => {
          expectTypeOf(lastPage).toEqualTypeOf<ServicePage>();

          if (
            lastPage.meta.pageNumber * lastPage.meta.pageSize >=
            lastPage.meta.total
          ) {
            return undefined;
          }

          return initialPageParam;
        },
        select: (data) => {
          expectTypeOf(data).toEqualTypeOf<
            InfiniteData<ServicePage, { page: number; pageSize: number }>
          >();

          return {
            ...data,
            total: data.pages.at(-1)?.meta.total ?? 0,
            services: data.pages.flatMap(({ services }) => services),
          };
        },
      });

      const queryWithoutAnyData:
        | undefined
        | (InfiniteData<ServicePage, { page: number; pageSize: number }> & {
            total: number;
            services: Service[];
          }) = queryWithoutAny.result.data;

      expectTypeOf(queryWithoutAnyData).toEqualTypeOf<
        | undefined
        | (InfiniteData<ServicePage, { page: number; pageSize: number }> & {
            total: number;
            services: Service[];
          })
      >();
    });

    it('should work fine "result" typings with "select" property', () => {
      type Foo = { foo: 1 };

      const getFoo = (): Foo[] => [];

      const queryClient = new QueryClient({});

      const infiniteQuery = new InfiniteQuery({
        queryClient,
        select: (data) => ({
          pageParams: data.pageParams,
          pages: data.pages,
          kek: 1,
        }),
        initialPageParam: { offset: 0, limit: 10 },
        getNextPageParam: (_page, _allPages, _lastPageParam) => {
          if (globalThis) {
            return null;
          }
          return { offset: 10, limit: 10 };
        },
        queryKey: [''],
        enableOnDemand: true,
        queryFn: async () => {
          return getFoo();
        },
      });

      expectTypeOf(infiniteQuery.result.data).toEqualTypeOf<
        | undefined
        | {
            pageParams: {
              offset: number;
              limit: number;
            }[];
            pages: Foo[][];
            kek: number;
          }
      >();

      type Foo2 = {
        foo2: { bar: 1 }[];
        rofls: string;
      };

      const getFoo2 = (): Foo2 => null as any;

      const infiniteQueryAnother = new InfiniteQuery({
        queryClient,
        enableOnDemand: true,
        abortSignal: new AbortController().signal,
        queryFn: async ({ pageParam, signal }) => {
          // eslint-disable-next-line sonarjs/no-invalid-await
          const response = await getFoo2();
          return { ...response, lastSearch: 'aaa', pageParam, signal };
        },
        select: (data) => ({
          pageParams: data.pageParams,
          pages: data.pages,
          kek: 1,
        }),
        queryKey: ['1', '2', '3'],
        initialPageParam: { offset: 0, limit: 30 },
        getNextPageParam: (page) => {
          expectTypeOf(page).branded.toEqualTypeOf<
            Foo2 & {
              lastSearch: string;
              signal: AbortSignal;
              pageParam: { offset: number; limit: number };
            }
          >();

          return {
            limit: 1,
            offset: 1,
          };
        },
      });

      expectTypeOf(infiniteQueryAnother.result.data).branded.toEqualTypeOf<
        | undefined
        | {
            pageParams: {
              offset: number;
              limit: number;
            }[];
            pages: {
              lastSearch: string;
              pageParam: {
                offset: number;
                limit: number;
              };
              signal: AbortSignal;
              foo2: {
                bar: 1;
              }[];
              rofls: string;
            }[];
            kek: number;
          }
      >();
    });

    it('should work fine "result" typings without "select" property', () => {
      type Foo = { foo: 1 };

      const getFoo = (): Foo[] => [];

      const infiniteQuery = new InfiniteQuery({
        queryClient: new QueryClient({}),
        initialPageParam: { offset: 0, limit: 10 },
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        getNextPageParam: (page, allPages, lastPageParam) => {
          expectTypeOf(page).toEqualTypeOf<Foo[]>();
          expectTypeOf(allPages).toEqualTypeOf<Foo[][]>();
          expectTypeOf(lastPageParam).toEqualTypeOf<{
            offset: number;
            limit: number;
          }>();

          if (globalThis) {
            return null;
          }
          return { offset: 10, limit: 10 };
        },
        queryKey: [''],
        enableOnDemand: true,
        queryFn: async () => {
          return getFoo();
        },
      });

      expectTypeOf(infiniteQuery.result.data).toEqualTypeOf<
        | undefined
        | {
            pageParams: {
              offset: number;
              limit: number;
            }[];
            pages: Foo[][];
          }
      >();
    });

    it('getNextPageParam typings with dynamic options', () => {
      type Foo = { foo: 1 };

      const getFoo = (): Foo[] => [];

      const infiniteQuery = new InfiniteQuery(new QueryClient({}), () => ({
        queryKey: ['allCharacters', ['1', '2']],
        initialPageParam: 1,
        queryFn: async () => {
          return getFoo();
        },
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        getNextPageParam: (page, allPages, lastPageParam) => {
          expectTypeOf(page).toEqualTypeOf<Foo[]>();
          expectTypeOf(allPages).toEqualTypeOf<Foo[][]>();
          expectTypeOf(lastPageParam).toEqualTypeOf<number>();

          if (globalThis) {
            return null;
          }
          return 2;
        },
      }));

      expectTypeOf(infiniteQuery.result.data).toEqualTypeOf<
        | undefined
        | {
            pageParams: number[];
            pages: Foo[][];
          }
      >();

      const anotherTest =
        (infiniteQuery.data?.pages.flat().length ?? 0) -
        (infiniteQuery.data?.pages.at(-1)?.length ?? 0);

      expectTypeOf(anotherTest).toEqualTypeOf<number>();
    });

    it('should infer types from initialPageParam inside dynamic options', () => {
      type PageParam = {
        limit: number;
        offset: number;
        total: number;
      };

      type PageData = {
        data: Record<string, { items: number[] }>;
      };

      const queryClient = new QueryClient({});
      const sourceData = {
        items: [1, 2, 3],
      };

      const dynamicInfiniteQuery = new InfiniteQuery({
        queryClient,
        options: () => {
          const inputParams: object | undefined = globalThis ? {} : undefined;

          if (!inputParams) {
            return {
              enabled: false,
            };
          }

          return {
            enabled: true,
            queryKey: [1, 2, 3] as const,
            initialPageParam: {
              limit: 500,
              offset: 0,
              total: sourceData.items.length,
            },
          };
        },
        queryFn: async ({ pageParam }) => {
          expectTypeOf(pageParam).toEqualTypeOf<PageParam>();

          return {
            data: {
              group: {
                items: [pageParam.offset + 1],
              },
            },
          } satisfies PageData;
        },
        refetchInterval: (query) => {
          expectTypeOf(query.state.data).toMatchTypeOf<
            InfiniteData<PageData, PageParam> | undefined
          >();

          const pagesCount = query.state.data?.pages.length ?? 0;

          if (pagesCount === 1 && query.state.status === 'success') {
            return 15_000;
          }

          return false;
        },
        getNextPageParam: (lastPage, _, lastPageParam) => {
          expectTypeOf(lastPage).toMatchTypeOf<PageData>();
          expectTypeOf(lastPageParam).toEqualTypeOf<PageParam>();

          const lastLoadedItems = Object.values(lastPage.data || {})[0]?.items;

          if (!lastLoadedItems?.length) {
            return undefined;
          }

          const nextOffset = lastPageParam.offset + lastPageParam.limit;

          if (nextOffset > sourceData.items.length) {
            return undefined;
          }

          return {
            limit: lastPageParam.limit,
            offset: nextOffset,
            total: sourceData.items.length,
          };
        },
      });

      expectTypeOf(dynamicInfiniteQuery.result.data).toEqualTypeOf<
        | InfiniteData<
            {
              data: {
                group: {
                  items: number[];
                };
              };
            },
            {
              limit: number;
              offset: number;
              total: number;
            }
          >
        | undefined
      >();
    });

    it('update() method parameters (throwOnError)', () => {
      type Foo = { foo: 1 };

      const getFoo = (): Foo[] => [];

      const infiniteQuery = new InfiniteQuery({
        queryClient: new QueryClient({}),
        initialPageParam: { offset: 0, limit: 10 },
        getNextPageParam: (_page, _allPages, _lastPageParam) => {
          if (globalThis) {
            return null;
          }
          return { offset: 10, limit: 10 };
        },
        queryKey: [''],
        enableOnDemand: true,
        queryFn: async () => {
          return getFoo();
        },
      });

      const updateOptions = {
        throwOnError: (
          error: Error,
          query: Query<
            Foo[],
            Error,
            InfiniteData<
              Foo[],
              {
                offset: number;
                limit: number;
              }
            >,
            string[]
          >,
        ) => {
          return Boolean(error && query);
        },
      };

      expectTypeOf(updateOptions).toMatchTypeOf<
        Parameters<typeof infiniteQuery.update>[0]
      >();
    });
  });

  describe('"start" method', () => {
    it('should call queryFn and fetch data', async () => {
      const queryFnSpy = vi.fn(async ({ pageParam = 0 }) => {
        return Array.from({ length: 3 }, (_, i) => `Item ${pageParam * 3 + i}`);
      });

      const infiniteQuery = new InfiniteQueryMock({
        queryKey: ['test'],
        queryFn: queryFnSpy,
        enabled: false,
        initialPageParam: 0,
        getNextPageParam: (_, allPages) => {
          return allPages.length < 2 ? allPages.length : undefined;
        },
      });

      await infiniteQuery.start();

      await when(() => !infiniteQuery._rawResult.isLoading);

      expect(infiniteQuery.result.isFetched).toBeTruthy();
      expect(queryFnSpy).toBeCalledTimes(1);
      expect(infiniteQuery.data?.pages).toHaveLength(1);

      infiniteQuery.destroy();
    });

    it('should throw error when throwOnError is true', async () => {
      vi.useFakeTimers();

      const infiniteQuery = new InfiniteQueryMock({
        queryKey: ['test-error'],
        queryFn: async () => {
          throw new Error('InfiniteQueryError');
        },
        enabled: false,
        throwOnError: true,
        initialPageParam: 0,
        getNextPageParam: () => undefined,
      });

      let error: Error | undefined;

      const promise = infiniteQuery.start().catch((error_) => {
        error = error_;
      });

      await vi.runAllTimersAsync();
      await promise;

      expect(error?.message).toBe('InfiniteQueryError');

      infiniteQuery.destroy();
      vi.useRealTimers();
    });
  });
});

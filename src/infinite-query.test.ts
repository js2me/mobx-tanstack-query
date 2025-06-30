import {
  DefaultError,
  FetchNextPageOptions,
  FetchPreviousPageOptions,
  InfiniteData,
  Query,
  QueryClient,
  QueryKey,
  RefetchOptions,
} from '@tanstack/query-core';
import { when } from 'mobx';
import { describe, expect, expectTypeOf, it, vi } from 'vitest';

import { InfiniteQuery } from './inifinite-query';
import {
  InfiniteQueryConfig,
  InfiniteQueryUpdateOptionsAllVariants,
} from './inifinite-query.types';
import { QueryInvalidateParams } from './query.types';

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
      // @ts-ignore
      queryFn: vi.fn((...args: any[]) => {
        // @ts-ignore
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
    return result;
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

  describe('typings', () => {
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
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        getNextPageParam: (page, allPages, lastPageParam) => {
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

    it('update() method parameters (throwOnError)', () => {
      type Foo = { foo: 1 };

      const getFoo = (): Foo[] => [];

      const infiniteQuery = new InfiniteQuery({
        queryClient: new QueryClient({}),
        initialPageParam: { offset: 0, limit: 10 },
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        getNextPageParam: (page, allPages, lastPageParam) => {
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
});

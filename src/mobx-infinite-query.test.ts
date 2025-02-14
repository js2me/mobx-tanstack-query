import {
  DefaultError,
  FetchNextPageOptions,
  FetchPreviousPageOptions,
  QueryClient,
  QueryKey,
  RefetchOptions,
} from '@tanstack/query-core';
import { when } from 'mobx';
import { describe, expect, it, vi } from 'vitest';

import { MobxInfiniteQuery } from './mobx-inifinite-query';
import {
  MobxInfiniteQueryConfig,
  MobxInfiniteQueryDynamicOptions,
  MobxInfiniteQueryUpdateOptions,
} from './mobx-inifinite-query.types';
import { MobxQueryInvalidateParams } from './mobx-query.types';

class MobxInfiniteQueryMock<
  TData,
  TError = DefaultError,
  TQueryKey extends QueryKey = any,
  TPageParam = unknown,
> extends MobxInfiniteQuery<TData, TError, TQueryKey, TPageParam> {
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
      MobxInfiniteQueryConfig<TData, TError, TQueryKey, TPageParam>,
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

  invalidate(params?: MobxQueryInvalidateParams | undefined): Promise<void> {
    this.spies.invalidate(params)();
    return super.invalidate();
  }

  update(
    options:
      | MobxInfiniteQueryUpdateOptions<TData, TError, TQueryKey, TPageParam>
      | MobxInfiniteQueryDynamicOptions<TData, TError, TQueryKey, TPageParam>,
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

describe('MobxInfiniteQuery', () => {
  it('should call queryFn without infinite query params', async () => {
    const mobxQuery = new MobxInfiniteQueryMock({
      queryKey: ['test'],
      queryFn: () => {},
    });

    expect(mobxQuery.spies.queryFn).toBeCalledTimes(1);
    expect(mobxQuery.spies.queryFn).toBeCalledWith({
      ...mobxQuery.spies.queryFn.mock.calls[0][0],
      direction: 'forward',
      meta: undefined,
      pageParam: undefined,
      queryKey: ['test'],
    });

    mobxQuery.dispose();
  });

  it('should call queryFn with initialPageParam', async () => {
    const mobxQuery = new MobxInfiniteQueryMock({
      queryKey: ['test'],
      initialPageParam: 0,
      queryFn: () => {},
    });

    expect(mobxQuery.spies.queryFn).toBeCalledTimes(1);
    expect(mobxQuery.spies.queryFn).toBeCalledWith({
      ...mobxQuery.spies.queryFn.mock.calls[0][0],
      direction: 'forward',
      meta: undefined,
      pageParam: 0,
      queryKey: ['test'],
    });

    mobxQuery.dispose();
  });

  it('should call queryFn with getNextPageParam', async () => {
    const mobxQuery = new MobxInfiniteQueryMock({
      queryKey: ['test'],
      getNextPageParam: () => 1,
      queryFn: () => {},
    });

    expect(mobxQuery.spies.queryFn).toBeCalledTimes(1);
    expect(mobxQuery.spies.queryFn).toBeCalledWith({
      ...mobxQuery.spies.queryFn.mock.calls[0][0],
      direction: 'forward',
      meta: undefined,
      pageParam: undefined,
      queryKey: ['test'],
    });

    mobxQuery.dispose();
  });

  it('should call queryFn with getNextPageParam returning null', async () => {
    const mobxQuery = new MobxInfiniteQueryMock({
      queryKey: ['test'],
      getNextPageParam: () => null,
      queryFn: async () => 'data',
    });

    expect(mobxQuery.spies.queryFn).toBeCalledTimes(1);
    expect(mobxQuery.spies.queryFn).toBeCalledWith({
      ...mobxQuery.spies.queryFn.mock.calls[0][0],
      direction: 'forward',
      meta: undefined,
      pageParam: undefined,
      queryKey: ['test'],
    });

    await when(() => !mobxQuery.result.isLoading);

    expect(mobxQuery.result).toStrictEqual({
      ...mobxQuery.result,
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

    mobxQuery.dispose();
  });

  it('should call queryFn after fetchNextPage call', async () => {
    const mobxQuery = new MobxInfiniteQueryMock({
      queryKey: ['test'],
      initialPageParam: 1,
      getNextPageParam: (_, _1, lastPageParam) => lastPageParam + 1,
      queryFn: () => {
        return [1, 2, 3];
      },
    });

    expect(mobxQuery.result).toStrictEqual({
      ...mobxQuery.result,
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

    await mobxQuery.fetchNextPage();

    expect(mobxQuery.spies.fetchNextPage).toBeCalledTimes(1);
    expect(mobxQuery.spies.queryFn).toBeCalledTimes(1);

    expect(mobxQuery.result).toStrictEqual({
      ...mobxQuery.result,
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

    mobxQuery.dispose();
  });

  it('should call queryFn after fetchNextPage call (x3 times)', async () => {
    const mobxQuery = new MobxInfiniteQueryMock({
      queryKey: ['test'],
      initialPageParam: 1,
      getNextPageParam: (_, _1, lastPageParam) => lastPageParam + 1,
      queryFn: ({ pageParam, queryKey }) => {
        return { data: pageParam, queryKey };
      },
    });

    expect(mobxQuery.result).toStrictEqual({
      ...mobxQuery.result,
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

    await mobxQuery.fetchNextPage();
    await mobxQuery.fetchNextPage();
    await mobxQuery.fetchNextPage();

    expect(mobxQuery.result).toStrictEqual({
      ...mobxQuery.result,
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

    mobxQuery.dispose();
  });

  describe('"enabled" reactive parameter', () => {
    it('should be reactive after change queryKey', async () => {
      const mobxQuery = new MobxInfiniteQueryMock({
        queryKey: ['test', 0 as number] as const,
        enabled: ({ queryKey }) => queryKey[1] > 0,
        getNextPageParam: () => 1,
        queryFn: () => 100,
      });

      mobxQuery.update({ queryKey: ['test', 1] as const });

      await when(() => !mobxQuery.result.isLoading);

      expect(mobxQuery.spies.queryFn).toBeCalledTimes(1);
      expect(mobxQuery.spies.queryFn).nthReturnedWith(1, 100);

      mobxQuery.dispose();
    });
  });
});

import {
  DefaultError,
  FetchNextPageOptions,
  FetchPreviousPageOptions,
  QueryClient,
  QueryKey,
  RefetchOptions,
} from '@tanstack/query-core';
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
    queryFn: vi.fn(),
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
      queryFn: vi.fn(options.queryFn),
    });

    // @ts-ignore
    this.spies.queryFn = this.options.queryFn;

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
    this.spies.invalidate(params);
    return super.invalidate();
  }

  update(
    options:
      | MobxInfiniteQueryUpdateOptions<TData, TError, TQueryKey, TPageParam>
      | MobxInfiniteQueryDynamicOptions<TData, TError, TQueryKey, TPageParam>,
  ) {
    const result = super.update(options);
    this.spies.update.mockReturnValue(result);
    this.spies.update(options);
    return result;
  }

  async fetchNextPage(options?: FetchNextPageOptions | undefined) {
    const result = await super.fetchNextPage(options);
    this.spies.fetchNextPage.mockReturnValue(result);
    this.spies.fetchNextPage(options);
    return result;
  }

  async fetchPreviousPage(options?: FetchPreviousPageOptions | undefined) {
    const result = await super.fetchPreviousPage(options);
    this.spies.fetchPreviousPage.mockReturnValue(result);
    this.spies.fetchPreviousPage(options);
    return result;
  }

  setData(updater: any, options?: any) {
    const result = super.setData(updater, options);
    this.spies.setData.mockReturnValue(result);
    this.spies.setData(updater, options);
    return result;
  }

  dispose(): void {
    const result = super.dispose();
    this.spies.dispose.mockReturnValue(result);
    this.spies.dispose();
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
      direction: 'forward',
      meta: undefined,
      pageParam: undefined,
      queryKey: ['test'],
      signal: mobxQuery.spies.queryFn.mock.calls[0][0].signal,
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
      direction: 'forward',
      meta: undefined,
      pageParam: 0,
      queryKey: ['test'],
      signal: mobxQuery.spies.queryFn.mock.calls[0][0].signal,
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
      direction: 'forward',
      meta: undefined,
      pageParam: undefined,
      queryKey: ['test'],
      signal: mobxQuery.spies.queryFn.mock.calls[0][0].signal,
    });

    mobxQuery.dispose();
  });

  it('should call queryFn with getNextPageParam returning null', async () => {
    const mobxQuery = new MobxInfiniteQueryMock({
      queryKey: ['test'],
      getNextPageParam: () => null,
      queryFn: () => {},
    });

    expect(mobxQuery.spies.queryFn).toBeCalledTimes(1);
    expect(mobxQuery.spies.queryFn).toBeCalledWith({
      direction: 'forward',
      meta: undefined,
      pageParam: undefined,
      queryKey: ['test'],
      signal: mobxQuery.spies.queryFn.mock.calls[0][0].signal,
    });

    mobxQuery.dispose();
  });

  it('should call queryFn after fetchNextPage call', async () => {
    const mobxQuery = new MobxInfiniteQueryMock({
      queryKey: ['test'],
      initialPageParam: 1,
      enabled: true,
      enableOnDemand: true,
      getNextPageParam: (_, _1, lastPageParam) => lastPageParam + 1,
      queryFn: () => {
        return [1, 2, 3];
      },
    });

    expect(mobxQuery.result.hasNextPage).toBeTruthy();

    await mobxQuery.fetchNextPage();

    expect(mobxQuery.spies.fetchNextPage).toBeCalledTimes(1);
    expect(mobxQuery.spies.queryFn).toBeCalledTimes(1);

    mobxQuery.dispose();
  });
});

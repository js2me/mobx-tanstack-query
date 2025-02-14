import {
  DefaultError,
  QueryClient,
  QueryKey,
  QueryObserverResult,
  RefetchOptions,
  SetDataOptions,
  Updater,
} from '@tanstack/query-core';
import { LinkedAbortController } from 'linked-abort-controller';
import { observable, reaction, runInAction, when } from 'mobx';
import { describe, expect, it, test, vi } from 'vitest';
import { waitAsync } from 'yammies/async';

import { MobxQuery } from './mobx-query';
import {
  MobxQueryConfig,
  MobxQueryDynamicOptions,
  MobxQueryInvalidateParams,
  MobxQueryUpdateOptions,
} from './mobx-query.types';

class MobxQueryMock<
  TData,
  TError = DefaultError,
  TQueryKey extends QueryKey = any,
> extends MobxQuery<TData, TError, TQueryKey> {
  spies = {
    queryFn: null as unknown as ReturnType<typeof vi.fn>,
    setData: vi.fn(),
    update: vi.fn(),
    dispose: vi.fn(),
    refetch: vi.fn(),
    invalidate: vi.fn(),
    onDone: vi.fn(),
    onError: vi.fn(),
  };

  constructor(
    options: Omit<MobxQueryConfig<TData, TError, TQueryKey>, 'queryClient'>,
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

  refetch(
    options?: RefetchOptions | undefined,
  ): Promise<QueryObserverResult<TData, TError>> {
    this.spies.refetch(options);
    return super.refetch(options);
  }

  invalidate(params?: MobxQueryInvalidateParams | undefined): Promise<void> {
    this.spies.invalidate(params);
    return super.invalidate();
  }

  update(
    options:
      | MobxQueryUpdateOptions<TData, TError, TQueryKey>
      | MobxQueryDynamicOptions<TData, TError, TQueryKey>,
  ): void {
    const result = super.update(options);
    this.spies.update.mockReturnValue(result)(options);
    return result;
  }

  setData(
    updater: Updater<NoInfer<TData> | undefined, NoInfer<TData> | undefined>,
    options?: SetDataOptions | undefined,
  ): TData | undefined {
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

describe('MobxQuery', () => {
  it('should be fetched on start', async () => {
    const mobxQuery = new MobxQueryMock({
      queryKey: ['test'],
      queryFn: () => {},
    });

    await when(() => !mobxQuery._rawResult.isLoading);

    expect(mobxQuery.result.isFetched).toBeTruthy();

    mobxQuery.dispose();
  });

  it('"result" field to be defined', async () => {
    const mobxQuery = new MobxQueryMock({
      queryKey: ['test'],
      queryFn: () => {},
    });

    await when(() => !mobxQuery._rawResult.isLoading);

    expect(mobxQuery.result).toBeDefined();

    mobxQuery.dispose();
  });

  it('"result" field should be reactive', async () => {
    let counter = 0;
    const mobxQuery = new MobxQueryMock({
      queryKey: ['test'],
      queryFn: () => ++counter,
    });
    const reactionSpy = vi.fn();

    const dispose = reaction(
      () => mobxQuery.result,
      (result) => reactionSpy(result),
    );

    await when(() => !mobxQuery._rawResult.isLoading);

    expect(reactionSpy).toBeCalled();
    expect(reactionSpy).toBeCalledWith({ ...mobxQuery.result });

    dispose();
    mobxQuery.dispose();
  });

  describe('"queryKey" reactive parameter', () => {
    it('should rerun queryFn after queryKey change', async () => {
      const boxCounter = observable.box(0);
      const mobxQuery = new MobxQueryMock({
        queryFn: ({ queryKey }) => {
          return queryKey[1];
        },
        queryKey: () => ['test', boxCounter.get()] as const,
      });

      await when(() => !mobxQuery._rawResult.isLoading);

      runInAction(() => {
        boxCounter.set(1);
      });

      await when(() => !mobxQuery._rawResult.isLoading);

      expect(mobxQuery.spies.queryFn).toBeCalledTimes(2);
      expect(mobxQuery.spies.queryFn).nthReturnedWith(1, 0);
      expect(mobxQuery.spies.queryFn).nthReturnedWith(2, 1);

      mobxQuery.dispose();
    });

    it('should rerun queryFn after queryKey change', async () => {
      const boxEnabled = observable.box(false);
      const mobxQuery = new MobxQueryMock({
        queryFn: () => 10,
        queryKey: () => ['test', boxEnabled.get()] as const,
        enabled: ({ queryKey }) => queryKey[1],
      });

      runInAction(() => {
        boxEnabled.set(true);
      });

      await when(() => !mobxQuery._rawResult.isLoading);

      expect(mobxQuery.spies.queryFn).toBeCalledTimes(1);
      expect(mobxQuery.spies.queryFn).nthReturnedWith(1, 10);

      mobxQuery.dispose();
    });
  });

  describe('"enabled" reactive parameter', () => {
    it('should be reactive after change queryKey', async () => {
      const mobxQuery = new MobxQueryMock({
        queryKey: ['test', 0 as number] as const,
        enabled: ({ queryKey }) => queryKey[1] > 0,
        queryFn: () => 100,
      });

      mobxQuery.update({ queryKey: ['test', 1] as const });

      await when(() => !mobxQuery._rawResult.isLoading);

      expect(mobxQuery.spies.queryFn).toBeCalledTimes(1);
      expect(mobxQuery.spies.queryFn).nthReturnedWith(1, 100);

      mobxQuery.dispose();
    });

    it('should be reactive dependent on another query (runs before declartion)', async () => {
      const disabledMobxQuery = new MobxQueryMock({
        queryKey: ['test', 0 as number] as const,
        enabled: ({ queryKey }) => queryKey[1] > 0,
        queryFn: () => 100,
      });

      disabledMobxQuery.update({ queryKey: ['test', 1] as const });

      const dependentMobxQuery = new MobxQueryMock({
        options: () => ({
          enabled: !!disabledMobxQuery.options.enabled,
          queryKey: [...disabledMobxQuery.options.queryKey, 'dependent'],
        }),
        queryFn: ({ queryKey }) => queryKey,
      });

      await when(() => !disabledMobxQuery._rawResult.isLoading);
      await when(() => !dependentMobxQuery._rawResult.isLoading);

      expect(dependentMobxQuery.spies.queryFn).toBeCalledTimes(1);
      expect(dependentMobxQuery.spies.queryFn).nthReturnedWith(1, [
        'test',
        1,
        'dependent',
      ]);

      disabledMobxQuery.dispose();
      dependentMobxQuery.dispose();
    });

    it('should be reactive dependent on another query (runs after declaration)', async () => {
      const tempDisabledMobxQuery = new MobxQueryMock({
        queryKey: ['test', 0 as number] as const,
        enabled: ({ queryKey }) => queryKey[1] > 0,
        queryFn: () => 100,
      });

      const dependentMobxQuery = new MobxQueryMock({
        options: () => ({
          enabled: !!tempDisabledMobxQuery.options.enabled,
          queryKey: [...tempDisabledMobxQuery.options.queryKey, 'dependent'],
        }),
        queryFn: ({ queryKey }) => queryKey,
      });

      tempDisabledMobxQuery.update({ queryKey: ['test', 1] as const });

      await when(() => !tempDisabledMobxQuery._rawResult.isLoading);
      await when(() => !dependentMobxQuery._rawResult.isLoading);

      expect(dependentMobxQuery.spies.queryFn).toBeCalledTimes(1);
      // результат с 0 потому что options.enabled у первой квери - это функция и
      // !!tempDisabledMobxQuery.options.enabled будет всегда true
      expect(dependentMobxQuery.spies.queryFn).nthReturnedWith(1, [
        'test',
        0,
        'dependent',
      ]);

      tempDisabledMobxQuery.dispose();
      dependentMobxQuery.dispose();
    });
  });

  describe('"options" reactive parameter', () => {
    it('"options.queryKey" should updates query', async () => {
      const boxCounter = observable.box(0);
      let counter = 0;
      const mobxQuery = new MobxQueryMock({
        queryFn: ({ queryKey }) => {
          counter += queryKey[1] * 10;
          return counter;
        },
        options: () => ({
          queryKey: ['test', boxCounter.get()] as const,
        }),
      });

      runInAction(() => {
        boxCounter.set(1);
      });

      await when(() => !mobxQuery._rawResult.isLoading);

      expect(mobxQuery.spies.queryFn).toBeCalledTimes(2);
      expect(mobxQuery.spies.queryFn).nthReturnedWith(1, 0);
      expect(mobxQuery.spies.queryFn).nthReturnedWith(2, 10);

      mobxQuery.dispose();
    });

    it('"options.enabled" should change "enabled" statement for query (enabled as boolean in options)', async () => {
      const boxEnabled = observable.box(false);
      const mobxQuery = new MobxQueryMock({
        queryFn: ({ queryKey }) => {
          return queryKey[1];
        },
        options: () => ({
          enabled: boxEnabled.get(),
          queryKey: ['test', boxEnabled.get() ? 10 : 0] as const,
        }),
      });

      runInAction(() => {
        boxEnabled.set(true);
      });

      await when(() => !mobxQuery._rawResult.isLoading);

      expect(mobxQuery.spies.queryFn).toBeCalledTimes(1);
      expect(mobxQuery.spies.queryFn).nthReturnedWith(1, 10);

      mobxQuery.dispose();
    });

    it('"options.enabled" should change "enabled" statement for query (enabled as query based fn)', async () => {
      const boxEnabled = observable.box(false);
      const mobxQuery = new MobxQueryMock({
        queryFn: ({ queryKey }) => {
          return queryKey[1];
        },
        enabled: ({ queryKey }) => queryKey[1],
        options: () => ({
          queryKey: ['test', boxEnabled.get()] as const,
        }),
      });

      runInAction(() => {
        boxEnabled.set(true);
      });

      await when(() => !mobxQuery._rawResult.isLoading);

      expect(mobxQuery.spies.queryFn).toBeCalledTimes(1);
      expect(mobxQuery.spies.queryFn).nthReturnedWith(1, true);

      mobxQuery.dispose();
    });
  });

  describe('"enableOnDemand" option', () => {
    describe('at start', () => {
      it('should not call query if result is not requested (without "enabled" property use)', async () => {
        const mobxQuery = new MobxQueryMock({
          queryFn: () => 10,
          enableOnDemand: true,
        });

        await when(() => !mobxQuery._rawResult.isLoading);

        expect(mobxQuery.spies.queryFn).toBeCalledTimes(0);

        mobxQuery.dispose();
      });

      it('should not call query if result is not requested (with "enabled": false)', async () => {
        const mobxQuery = new MobxQueryMock({
          queryFn: () => 10,
          enableOnDemand: true,
          enabled: false,
        });

        await when(() => !mobxQuery._rawResult.isLoading);

        expect(mobxQuery.spies.queryFn).toBeCalledTimes(0);

        mobxQuery.dispose();
      });

      it('should not call query if result is not requested (with "enabled": fn -> false)', async () => {
        const mobxQuery = new MobxQueryMock({
          queryFn: () => 10,
          enableOnDemand: true,
          enabled: () => false,
        });

        await when(() => !mobxQuery._rawResult.isLoading);

        expect(mobxQuery.spies.queryFn).toBeCalledTimes(0);

        mobxQuery.dispose();
      });

      it('should not call query if result is not requested (with "enabled": fn -> true)', async () => {
        const mobxQuery = new MobxQueryMock({
          queryFn: () => 10,
          enableOnDemand: true,
          enabled: () => true,
        });

        await when(() => !mobxQuery._rawResult.isLoading);

        expect(mobxQuery.spies.queryFn).toBeCalledTimes(0);

        mobxQuery.dispose();
      });

      it('should not call query if result is not requested (with "enabled": true)', async () => {
        const mobxQuery = new MobxQueryMock({
          queryFn: () => 10,
          enableOnDemand: true,
          enabled: true,
        });

        await when(() => !mobxQuery._rawResult.isLoading);

        expect(mobxQuery.spies.queryFn).toBeCalledTimes(0);

        mobxQuery.dispose();
      });

      it('should not call query if result is not requested (with "enabled": false in dynamic options)', async () => {
        const mobxQuery = new MobxQueryMock({
          queryFn: () => 10,
          enableOnDemand: true,
          options: () => ({
            enabled: false,
          }),
        });

        await when(() => !mobxQuery._rawResult.isLoading);

        expect(mobxQuery.spies.queryFn).toBeCalledTimes(0);

        mobxQuery.dispose();
      });

      it('should not call query if result is not requested (with "enabled": true in dynamic options)', async () => {
        const mobxQuery = new MobxQueryMock({
          queryFn: () => 10,
          enableOnDemand: true,
          options: () => ({
            enabled: true,
          }),
        });

        await when(() => !mobxQuery._rawResult.isLoading);

        expect(mobxQuery.spies.queryFn).toBeCalledTimes(0);

        mobxQuery.dispose();
      });

      it('should call query if result is requested (without "enabled" property use)', async () => {
        const mobxQuery = new MobxQueryMock({
          queryFn: () => 10,
          enableOnDemand: true,
        });

        mobxQuery.result.data;

        await when(() => !mobxQuery._rawResult.isLoading);

        expect(mobxQuery.spies.queryFn).toBeCalledTimes(1);

        mobxQuery.dispose();
      });

      it('should not call query event if result is requested (reason: "enabled": false)', async () => {
        const mobxQuery = new MobxQueryMock({
          queryFn: () => 10,
          enableOnDemand: true,
          enabled: false,
        });

        mobxQuery.result.data;

        await when(() => !mobxQuery._rawResult.isLoading);

        expect(mobxQuery.spies.queryFn).toBeCalledTimes(0);

        mobxQuery.dispose();
      });

      it('should not call query even if result is requested (reason: "enabled": fn -> false)', async () => {
        const mobxQuery = new MobxQueryMock({
          queryFn: () => 10,
          enableOnDemand: true,
          enabled: () => false,
        });

        mobxQuery.result.data;

        await when(() => !mobxQuery._rawResult.isLoading);

        expect(mobxQuery.spies.queryFn).toBeCalledTimes(0);

        mobxQuery.dispose();
      });

      it('should call query if result is requested (with "enabled": fn -> true)', async () => {
        const mobxQuery = new MobxQueryMock({
          queryFn: () => 10,
          enableOnDemand: true,
          enabled: () => true,
        });

        mobxQuery.result.data;

        await when(() => !mobxQuery._rawResult.isLoading);

        expect(mobxQuery.spies.queryFn).toBeCalledTimes(1);

        mobxQuery.dispose();
      });

      it('should call query if result is requested (with "enabled": true)', async () => {
        const mobxQuery = new MobxQueryMock({
          queryFn: () => 10,
          enableOnDemand: true,
          enabled: true,
        });

        mobxQuery.result.data;

        await when(() => !mobxQuery._rawResult.isLoading);

        expect(mobxQuery.spies.queryFn).toBeCalledTimes(1);

        mobxQuery.dispose();
      });
    });
  });

  describe('"start" method', () => {
    test('should call once queryFn', async () => {
      const querySpyFn = vi.fn();
      const mobxQuery = new MobxQueryMock({
        queryKey: ['test'],
        queryFn: querySpyFn,
        enabled: false,
      });

      await mobxQuery.start();

      await when(() => !mobxQuery._rawResult.isLoading);

      expect(mobxQuery.result.isFetched).toBeTruthy();
      expect(querySpyFn).toBeCalledTimes(1);

      mobxQuery.dispose();
    });
  });

  describe('scenarios', () => {
    it('query with refetchInterval(number) should be stopped after inner abort', async () => {
      const query = new MobxQueryMock({
        queryFn: async () => {
          await waitAsync(10);
          return 10;
        },
        enabled: true,
        refetchInterval: 10,
      });

      await waitAsync(100);
      expect(query.spies.queryFn).toBeCalledTimes(5);
      query.dispose();

      await waitAsync(100);

      expect(query.spies.queryFn).toBeCalledTimes(5);
    });
    it('query with refetchInterval(number) should be stopped after outer abort', async () => {
      const abortController = new AbortController();
      const query = new MobxQueryMock({
        queryFn: async () => {
          await waitAsync(10);
          return 10;
        },
        enabled: true,
        abortSignal: abortController.signal,
        refetchInterval: 10,
      });

      await waitAsync(100);
      expect(query.spies.queryFn).toBeCalledTimes(5);

      abortController.abort();

      await waitAsync(100);

      expect(query.spies.queryFn).toBeCalledTimes(5);
    });
    it('query with refetchInterval(fn) should be stopped after inner abort', async () => {
      const query = new MobxQueryMock({
        queryFn: async () => {
          await waitAsync(10);
          return 10;
        },
        enabled: true,
        refetchInterval: () => 10,
      });

      await waitAsync(100);
      expect(query.spies.queryFn).toBeCalledTimes(5);

      query.dispose();

      await waitAsync(100);

      expect(query.spies.queryFn).toBeCalledTimes(5);
    });
    it('query with refetchInterval(fn) should be stopped after outer abort', async () => {
      const abortController = new AbortController();
      const query = new MobxQueryMock({
        queryFn: async () => {
          await waitAsync(10);
          return 10;
        },
        enabled: true,
        abortSignal: abortController.signal,
        refetchInterval: () => 10,
      });

      await waitAsync(100);
      expect(query.spies.queryFn).toBeCalledTimes(5);

      abortController.abort();

      await waitAsync(100);

      expect(query.spies.queryFn).toBeCalledTimes(5);
    });
    it('query with refetchInterval(condition fn) should be stopped after inner abort', async () => {
      const query = new MobxQueryMock({
        queryFn: async () => {
          await waitAsync(10);
          return 10;
        },
        enabled: true,
        refetchInterval: (query) => (query.isActive() ? 10 : false),
      });

      await waitAsync(100);
      expect(query.spies.queryFn).toBeCalledTimes(5);
      query.dispose();

      await waitAsync(100);

      expect(query.spies.queryFn).toBeCalledTimes(5);
    });
    it('query with refetchInterval(condition-fn) should be stopped after outer abort', async () => {
      const abortController = new AbortController();
      const query = new MobxQueryMock({
        queryFn: async () => {
          await waitAsync(10);
          return 10;
        },
        enabled: true,
        abortSignal: abortController.signal,
        refetchInterval: (query) => (query.isActive() ? 10 : false),
      });

      await waitAsync(100);
      expect(query.spies.queryFn).toBeCalledTimes(5);

      abortController.abort();

      await waitAsync(100);

      expect(query.spies.queryFn).toBeCalledTimes(5);
    });
    it('dynamic enabled + dynamic refetchInterval', async () => {
      const abortController = new AbortController();
      const counter = observable.box(0);

      const query = new MobxQueryMock({
        queryFn: async () => {
          runInAction(() => {
            counter.set(counter.get() + 1);
          });
          await waitAsync(10);
          return 10;
        },
        options: () => ({
          enabled: counter.get() < 3,
          queryKey: ['test', counter.get()],
        }),
        abortSignal: abortController.signal,
        refetchInterval: (query) => (query.isDisabled() ? false : 10),
      });

      await waitAsync(100);
      expect(query.spies.queryFn).toBeCalledTimes(3);

      abortController.abort();

      await waitAsync(100);

      expect(query.spies.queryFn).toBeCalledTimes(3);
    });
    it('dynamic enabled + dynamic refetchInterval(refetchInterval is fixed)', async () => {
      const abortController = new AbortController();
      const counter = observable.box(0);

      const query = new MobxQueryMock({
        queryFn: async () => {
          runInAction(() => {
            counter.set(counter.get() + 1);
          });
          await waitAsync(10);
          return 10;
        },
        options: () => ({
          enabled: counter.get() < 3,
          queryKey: ['test', counter.get()],
        }),
        abortSignal: abortController.signal,
        refetchInterval: () => 10,
      });

      await waitAsync(100);
      expect(query.spies.queryFn).toBeCalledTimes(3);

      abortController.abort();

      await waitAsync(100);

      expect(query.spies.queryFn).toBeCalledTimes(3);
    });
    it('dynamic enabled + dynamic refetchInterval (+enabledOnDemand)', async () => {
      const abortController = new AbortController();
      const counter = observable.box(0);

      const query = new MobxQueryMock({
        queryFn: async () => {
          await waitAsync(10);
          runInAction(() => {
            counter.set(counter.get() + 1);
          });
          return 10;
        },
        enableOnDemand: true,
        options: () => ({
          enabled: counter.get() < 100,
          queryKey: ['test', counter.get()],
        }),
        abortSignal: abortController.signal,
        refetchInterval: (query) => (query.isDisabled() ? false : 10),
      });

      await waitAsync(100);
      expect(query.spies.queryFn).toBeCalledTimes(0);

      query.result.data;

      await waitAsync(100);
      expect(query.spies.queryFn).toBeCalledTimes(10);

      query.result.data;
      query.result.isLoading;
      await waitAsync(50);
      expect(query.spies.queryFn).toBeCalledTimes(15);
      abortController.abort();

      query.result.data;
      query.result.data;
      query.result.isLoading;

      await waitAsync(100);

      query.result.data;
      query.result.isLoading;

      expect(query.spies.queryFn).toBeCalledTimes(15);
    });

    it('after abort identical (by query key) query another query should work', async () => {
      const abortController1 = new LinkedAbortController();
      const abortController2 = new LinkedAbortController();
      const mobxQuery1 = new MobxQueryMock({
        queryFn: async () => {
          await waitAsync(5);
          return 'bar';
        },
        abortSignal: abortController1.signal,
        queryKey: ['test'] as const,
      });
      const mobxQuery2 = new MobxQueryMock({
        queryFn: async () => {
          await waitAsync(5);
          return 'foo';
        },
        abortSignal: abortController2.signal,
        queryKey: ['test'] as const,
      });
      abortController1.abort();

      expect(mobxQuery1.result).toStrictEqual({
        data: undefined,
        dataUpdatedAt: 0,
        error: null,
        errorUpdateCount: 0,
        errorUpdatedAt: 0,
        failureCount: 0,
        failureReason: null,
        fetchStatus: 'fetching',
        isError: false,
        isFetched: false,
        isFetchedAfterMount: false,
        isFetching: true,
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
        promise: mobxQuery1.result.promise,
        refetch: mobxQuery1.result.refetch,
        status: 'pending',
      });
      expect(mobxQuery2.result).toStrictEqual({
        data: undefined,
        dataUpdatedAt: 0,
        error: null,
        errorUpdateCount: 0,
        errorUpdatedAt: 0,
        failureCount: 0,
        failureReason: null,
        fetchStatus: 'fetching',
        isError: false,
        isFetched: false,
        isFetchedAfterMount: false,
        isFetching: true,
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
        promise: mobxQuery2.result.promise,
        refetch: mobxQuery2.result.refetch,
        status: 'pending',
      });
      await waitAsync(10);
      expect(mobxQuery1.result).toStrictEqual({
        data: undefined,
        dataUpdatedAt: 0,
        error: null,
        errorUpdateCount: 0,
        errorUpdatedAt: 0,
        failureCount: 0,
        failureReason: null,
        fetchStatus: 'fetching',
        isError: false,
        isFetched: false,
        isFetchedAfterMount: false,
        isFetching: true,
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
        promise: mobxQuery1.result.promise,
        refetch: mobxQuery1.result.refetch,
        status: 'pending',
      });
      expect(mobxQuery2.result).toStrictEqual({
        data: 'foo',
        dataUpdatedAt: mobxQuery2.result.dataUpdatedAt,
        error: null,
        errorUpdateCount: 0,
        errorUpdatedAt: 0,
        failureCount: 0,
        failureReason: null,
        fetchStatus: 'idle',
        isError: false,
        isFetched: true,
        isFetchedAfterMount: true,
        isFetching: false,
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
        promise: mobxQuery2.result.promise,
        refetch: mobxQuery2.result.refetch,
        status: 'success',
      });
      await waitAsync(10);
      expect(mobxQuery1.result).toStrictEqual({
        data: undefined,
        dataUpdatedAt: 0,
        error: null,
        errorUpdateCount: 0,
        errorUpdatedAt: 0,
        failureCount: 0,
        failureReason: null,
        fetchStatus: 'fetching',
        isError: false,
        isFetched: false,
        isFetchedAfterMount: false,
        isFetching: true,
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
        promise: mobxQuery1.result.promise,
        refetch: mobxQuery1.result.refetch,
        status: 'pending',
      });
    });

    it('after abort identical (by query key) query another query should work (with resetOnDestroy option)', async () => {
      const abortController1 = new LinkedAbortController();
      const abortController2 = new LinkedAbortController();
      const mobxQuery1 = new MobxQueryMock({
        queryFn: async () => {
          await waitAsync(5);
          return 'bar';
        },
        abortSignal: abortController1.signal,
        queryKey: ['test'] as const,
        resetOnDestroy: true,
      });
      const mobxQuery2 = new MobxQueryMock({
        queryFn: async () => {
          await waitAsync(5);
          return 'foo';
        },
        abortSignal: abortController2.signal,
        queryKey: ['test'] as const,
        resetOnDestroy: true,
      });
      abortController1.abort();

      expect(mobxQuery1.result).toStrictEqual({
        data: undefined,
        dataUpdatedAt: 0,
        error: null,
        errorUpdateCount: 0,
        errorUpdatedAt: 0,
        failureCount: 0,
        failureReason: null,
        fetchStatus: 'fetching',
        isError: false,
        isFetched: false,
        isFetchedAfterMount: false,
        isFetching: true,
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
        promise: mobxQuery1.result.promise,
        refetch: mobxQuery1.result.refetch,
        status: 'pending',
      });
      expect(mobxQuery2.result).toStrictEqual({
        data: undefined,
        dataUpdatedAt: 0,
        error: null,
        errorUpdateCount: 0,
        errorUpdatedAt: 0,
        failureCount: 0,
        failureReason: null,
        fetchStatus: 'fetching',
        isError: false,
        isFetched: false,
        isFetchedAfterMount: false,
        isFetching: true,
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
        promise: mobxQuery2.result.promise,
        refetch: mobxQuery2.result.refetch,
        status: 'pending',
      });
      await waitAsync(10);
      expect(mobxQuery1.result).toStrictEqual({
        data: undefined,
        dataUpdatedAt: 0,
        error: null,
        errorUpdateCount: 0,
        errorUpdatedAt: 0,
        failureCount: 0,
        failureReason: null,
        fetchStatus: 'fetching',
        isError: false,
        isFetched: false,
        isFetchedAfterMount: false,
        isFetching: true,
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
        promise: mobxQuery1.result.promise,
        refetch: mobxQuery1.result.refetch,
        status: 'pending',
      });
      expect(mobxQuery2.result).toStrictEqual({
        data: 'foo',
        dataUpdatedAt: mobxQuery2.result.dataUpdatedAt,
        error: null,
        errorUpdateCount: 0,
        errorUpdatedAt: 0,
        failureCount: 0,
        failureReason: null,
        fetchStatus: 'idle',
        isError: false,
        isFetched: true,
        isFetchedAfterMount: true,
        isFetching: false,
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
        promise: mobxQuery2.result.promise,
        refetch: mobxQuery2.result.refetch,
        status: 'success',
      });
      await waitAsync(10);
      expect(mobxQuery1.result).toStrictEqual({
        data: undefined,
        dataUpdatedAt: 0,
        error: null,
        errorUpdateCount: 0,
        errorUpdatedAt: 0,
        failureCount: 0,
        failureReason: null,
        fetchStatus: 'fetching',
        isError: false,
        isFetched: false,
        isFetchedAfterMount: false,
        isFetching: true,
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
        promise: mobxQuery1.result.promise,
        refetch: mobxQuery1.result.refetch,
        status: 'pending',
      });
    });
  });
});

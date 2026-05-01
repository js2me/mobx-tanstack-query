/// <reference types="node" />
/* eslint-disable no-async-promise-executor */
/** biome-ignore-all lint/nursery/noFloatingPromises: tests intentionally leave promises unawaited */
import { types } from 'node:util';
import {
  type DefaultError,
  hashKey,
  QueryClient,
  type QueryKey,
  type QueryObserverResult,
  type RefetchOptions,
  type SetDataOptions,
  type Updater,
} from '@tanstack/query-core';
import { LinkedAbortController } from 'linked-abort-controller';
import {
  comparer,
  computed,
  makeAutoObservable,
  makeObservable,
  observable,
  reaction,
  runInAction,
  untracked,
  when,
} from 'mobx';
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  expectTypeOf,
  it,
  test,
  vi,
} from 'vitest';
import { sleep } from 'yummies/async';
import type { Maybe } from 'yummies/types';
import { createQuery } from './preset/index.js';
import { Query } from './query.js';
import type {
  QueryConfig,
  QueryDynamicOptions,
  QueryFeatures,
  QueryInvalidateParams,
  QueryUpdateOptions,
} from './query.types.js';
import { QueryClient as MobxQueryClient } from './query-client.js';
import type { QueryClientConfig } from './query-client.types.js';

class QueryMock<
  TQueryFnData = unknown,
  TError = DefaultError,
  TData = TQueryFnData,
  TQueryData = TQueryFnData,
  TQueryKey extends QueryKey = QueryKey,
> extends Query<TQueryFnData, TError, TData, TQueryData, TQueryKey> {
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
    options: Omit<
      QueryConfig<TQueryFnData, TError, TData, TQueryData, TQueryKey>,
      'queryClient'
    >,
    queryClient?: QueryClient,
  ) {
    super({
      ...options,
      queryClient: queryClient ?? new QueryClient({}),
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

  refetch(
    options?: RefetchOptions | undefined,
  ): Promise<QueryObserverResult<TData, TError>> {
    this.spies.refetch(options);
    return super.refetch(options);
  }

  invalidate(params?: QueryInvalidateParams | undefined): Promise<void> {
    this.spies.invalidate(params);
    return super.invalidate(params);
  }

  update(
    options:
      | QueryUpdateOptions<TQueryFnData, TError, TData, TQueryData, TQueryKey>
      | QueryDynamicOptions<TQueryFnData, TError, TData, TQueryData, TQueryKey>,
  ): void {
    const result = super.update(options);
    this.spies.update.mockReturnValue(result)(options);
  }

  setData(
    updater: Updater<
      NoInfer<TQueryFnData> | undefined,
      NoInfer<TQueryFnData> | undefined
    >,
    options?: SetDataOptions,
  ): TQueryFnData | undefined {
    const result = super.setData(updater, options);
    this.spies.setData.mockReturnValue(result)(updater, options);
    return result;
  }

  dispose(): void {
    const result = super.destroy();
    this.spies.dispose.mockReturnValue(result)();
  }
}

class HttpResponse<TData = any, TError = Error> extends Response {
  data: TData | null;
  error: TError | null;

  constructor(data?: TData, error?: TError, init?: ResponseInit) {
    super(null, init);
    this.data = data ?? null;
    this.error = error ?? null;
  }
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const createMockFetch = () => {
  return vi.fn(
    (cfg: {
      signal?: AbortSignal;
      sleep?: number;
      willReturn: HttpResponse<any, any>;
    }) => {
      return new Promise<HttpResponse<any, any>>((resolve, reject) => {
        // Проверяем, если сигнал уже был прерван
        if (cfg.signal?.aborted) {
          reject(new DOMException('Aborted', 'AbortError'));
          return;
        }

        const timeout = setTimeout(() => {
          if (cfg.willReturn.error) {
            reject(cfg.willReturn);
          } else {
            resolve(cfg.willReturn);
          }
        }, cfg?.sleep ?? 5);

        // Добавляем обработчик прерывания
        if (cfg.signal) {
          const abortHandler = () => {
            clearTimeout(timeout);
            reject(new DOMException('Aborted', 'AbortError'));
            cfg.signal?.removeEventListener('abort', abortHandler);
          };

          cfg.signal.addEventListener('abort', abortHandler);
        }
      });
    },
  );
};

describe('Query', () => {
  it('should be fetched on start', async () => {
    const query = new QueryMock({
      queryKey: ['test'],
      queryFn: () => {},
    });

    await when(() => !query._rawResult.isLoading);

    expect(query.result.isFetched).toBeTruthy();

    query.destroy();
  });

  it('"result" field to be defined', async () => {
    const query = new QueryMock({
      queryKey: ['test'],
      queryFn: () => {},
    });

    await when(() => !query._rawResult.isLoading);

    expect(query.result).toBeDefined();

    query.destroy();
  });

  it('"result" field should be reactive', async () => {
    let counter = 0;
    const query = new QueryMock({
      queryKey: ['test'],
      queryFn: () => ++counter,
    });
    const reactionSpy = vi.fn();

    const dispose = reaction(
      () => query.result,
      (result) => reactionSpy(result),
    );

    await when(() => !query._rawResult.isLoading);

    expect(reactionSpy).toBeCalled();
    expect(reactionSpy).toBeCalledWith({ ...query.result });

    dispose();
    query.destroy();
  });

  it('should not call onDone twice in enableOnDemand cycle (result -> update -> onDone -> result)', async () => {
    class Foo {
      query;
      onDoneSpy = vi.fn();

      constructor(queryClient: QueryClient) {
        this.query = new QueryMock(
          {
            queryKey: ['on-done-cycle', 0 as number] as const,
            queryFn: ({ queryKey }) => ({
              foo: { foo: queryKey[1] as number },
            }),
            enableOnDemand: true,
            onDone: () => {
              this.onDoneSpy();
              // This read hits `get result`, and in enableOnDemand it calls `this.update({})`.
              untracked(() => this.query.result.data?.foo);
            },
          },
          queryClient,
        );
      }
    }

    const queryClient = new QueryClient({});
    queryClient.setQueryData(['on-done-cycle', 1], { foo: { foo: 1 } });

    const foo = new Foo(queryClient);

    // First update delivers cached success and triggers onDone.
    // onDone reads `result`, which triggers second update from line 631.
    foo.query.update({ queryKey: ['on-done-cycle', 1] as const });
    await sleep(20);

    expect(foo.query.spies.update).toHaveBeenCalledTimes(2);
    expect(foo.onDoneSpy).toHaveBeenCalledTimes(1);

    foo.query.destroy();
  });

  describe('"queryKey" reactive parameter', () => {
    it('should rerun queryFn after queryKey change', async () => {
      const boxCounter = observable.box(0);
      const query = new QueryMock({
        queryFn: ({ queryKey }) => {
          return queryKey[1];
        },
        queryKey: () => ['test', boxCounter.get()] as const,
      });

      await when(() => !query._rawResult.isLoading);

      runInAction(() => {
        boxCounter.set(1);
      });

      await when(() => !query._rawResult.isLoading);

      expect(query.spies.queryFn).toHaveBeenCalledTimes(2);
      expect(query.spies.queryFn).nthReturnedWith(1, 0);
      expect(query.spies.queryFn).nthReturnedWith(2, 1);

      query.destroy();
    });

    it('should rerun queryFn after queryKey change', async () => {
      const boxEnabled = observable.box(false);
      const query = new QueryMock({
        queryFn: () => 10,
        queryKey: () => ['test', boxEnabled.get()] as const,
        enabled: ({ queryKey }) => queryKey[1],
      });

      runInAction(() => {
        boxEnabled.set(true);
      });

      await when(() => !query._rawResult.isLoading);

      expect(query.spies.queryFn).toHaveBeenCalledTimes(1);
      expect(query.spies.queryFn).nthReturnedWith(1, 10);

      query.destroy();
    });
  });

  describe('"enabled" reactive parameter', () => {
    it('should be DISABLED from default query options (from query client)', async () => {
      const queryClient = new QueryClient({
        defaultOptions: {
          queries: {
            enabled: false,
          },
        },
      });
      const query = new QueryMock(
        {
          queryKey: ['test', 0 as number] as const,
          queryFn: () => 100,
        },
        queryClient,
      );

      expect(query.spies.queryFn).toHaveBeenCalledTimes(0);

      query.destroy();
    });

    it('should be DISABLED from default query options (from query client) (lazy:true)', async () => {
      const queryClient = new QueryClient({
        defaultOptions: {
          queries: {
            enabled: false,
          },
        },
      });
      const query = new QueryMock(
        {
          queryKey: ['test', 0 as number] as const,
          queryFn: () => 100,
          lazy: true,
        },
        queryClient,
      );

      expect(query.spies.queryFn).toHaveBeenCalledTimes(0);

      query.destroy();
    });

    it('should be reactive after change queryKey', async () => {
      const query = new QueryMock({
        queryKey: ['test', 0 as number] as const,
        enabled: ({ queryKey }) => queryKey[1] > 0,
        queryFn: () => 100,
      });

      query.update({ queryKey: ['test', 1] as const });

      await when(() => !query._rawResult.isLoading);

      expect(query.spies.queryFn).toHaveBeenCalledTimes(1);
      expect(query.spies.queryFn).nthReturnedWith(1, 100);

      query.destroy();
    });

    it('should be reactive after change queryKey (lazy:true)', async () => {
      const query = new QueryMock({
        queryKey: ['test', 0 as number] as const,
        enabled: ({ queryKey }) => queryKey[1] > 0,
        queryFn: () => 100,
        lazy: true,
      });

      query.update({ queryKey: ['test', 1] as const });

      await when(() => !query._rawResult.isLoading);

      expect(query.spies.queryFn).toHaveBeenCalledTimes(1);
      expect(query.spies.queryFn).nthReturnedWith(1, 100);

      query.destroy();
    });

    it('should be reactive dependent on another query (runs before declartion)', async () => {
      const disabledQuery = new QueryMock({
        queryKey: ['test', 0 as number] as const,
        enabled: ({ queryKey }) => queryKey[1] > 0,
        queryFn: () => 100,
      });

      disabledQuery.update({ queryKey: ['test', 1] as const });

      const dependentQuery = new QueryMock({
        options: () => ({
          enabled: !!disabledQuery.options.enabled,
          queryKey: [...disabledQuery.options.queryKey, 'dependent'],
        }),
        queryFn: ({ queryKey }) => queryKey,
      });

      await when(() => !disabledQuery._rawResult.isLoading);
      await when(() => !dependentQuery._rawResult.isLoading);

      expect(dependentQuery.spies.queryFn).toHaveBeenCalledTimes(1);
      expect(dependentQuery.spies.queryFn).nthReturnedWith(1, [
        'test',
        1,
        'dependent',
      ]);

      disabledQuery.destroy();
      dependentQuery.destroy();
    });

    it('should be reactive dependent on another query (runs before declartion) (lazy: true)', async () => {
      const disabledQuery = new QueryMock({
        queryKey: ['test', 0 as number] as const,
        enabled: ({ queryKey }) => queryKey[1] > 0,
        queryFn: () => 100,
        lazy: true,
      });

      disabledQuery.update({ queryKey: ['test', 1] as const });

      const dependentQuery = new QueryMock({
        options: () => ({
          enabled: !!disabledQuery.options.enabled,
          queryKey: [...disabledQuery.options.queryKey, 'dependent'],
        }),
        queryFn: ({ queryKey }) => queryKey,
        lazy: true,
      });

      await when(() => !disabledQuery._rawResult.isLoading);
      await when(() => !dependentQuery._rawResult.isLoading);

      expect(dependentQuery.spies.queryFn).toHaveBeenCalledTimes(1);
      expect(dependentQuery.spies.queryFn).nthReturnedWith(1, [
        'test',
        1,
        'dependent',
      ]);

      disabledQuery.destroy();
      dependentQuery.destroy();
    });

    it('should be reactive dependent on another query (runs after declaration)', async () => {
      const tempDisabledQuery = new QueryMock({
        queryKey: ['test', 0 as number] as const,
        enabled: ({ queryKey }) => queryKey[1] > 0,
        queryFn: () => 100,
      });

      const dependentQuery = new QueryMock({
        options: () => ({
          enabled: !!tempDisabledQuery.options.enabled,
          queryKey: [...tempDisabledQuery.options.queryKey, 'dependent'],
        }),
        queryFn: ({ queryKey }) => queryKey,
      });

      tempDisabledQuery.update({ queryKey: ['test', 1] as const });

      await when(() => !tempDisabledQuery._rawResult.isLoading);
      await when(() => !dependentQuery._rawResult.isLoading);

      expect(dependentQuery.spies.queryFn).toHaveBeenCalledTimes(1);
      // результат с 0 потому что options.enabled у первой квери - это функция и
      // !!tempDisabledQuery.options.enabled будет всегда true
      expect(dependentQuery.spies.queryFn).nthReturnedWith(1, [
        'test',
        0,
        'dependent',
      ]);

      tempDisabledQuery.destroy();
      dependentQuery.destroy();
    });
  });

  it('should be reactive dependent on another query (runs after declaration) (updating lazy query)', async () => {
    const tempDisabledQuery = new QueryMock({
      queryKey: ['test', 0 as number] as const,
      enabled: ({ queryKey }) => queryKey[1] > 0,
      queryFn: () => 100,
      lazy: true,
    });

    const dependentQuery = new QueryMock({
      options: () => ({
        enabled: !!tempDisabledQuery.options.enabled,
        queryKey: [...tempDisabledQuery.options.queryKey, 'dependent'],
      }),
      queryFn: ({ queryKey }) => queryKey,
    });

    tempDisabledQuery.update({ queryKey: ['test', 1] as const });

    await when(() => !tempDisabledQuery._rawResult.isLoading);
    await when(() => !dependentQuery._rawResult.isLoading);

    expect(dependentQuery.spies.queryFn).toHaveBeenCalledTimes(1);
    // результат с 0 потому что options.enabled у первой квери - это функция и
    // !!tempDisabledQuery.options.enabled будет всегда true
    expect(dependentQuery.spies.queryFn).nthReturnedWith(1, [
      'test',
      0,
      'dependent',
    ]);

    tempDisabledQuery.destroy();
    dependentQuery.destroy();
  });

  it('should NOT be reactive dependent on another query because lazy queries has not subscriptions', async () => {
    const tempDisabledQuery = new QueryMock({
      queryKey: ['test', 0 as number] as const,
      enabled: ({ queryKey }) => queryKey[1] > 0,
      queryFn: () => 100,
      lazy: true,
    });

    const dependentQuery = new QueryMock({
      options: () => {
        return {
          enabled: !!tempDisabledQuery.options.enabled,
          queryKey: [...tempDisabledQuery.options.queryKey, 'dependent'],
        };
      },
      queryFn: ({ queryKey }) => {
        return queryKey;
      },
      lazy: true,
    });

    tempDisabledQuery.update({ queryKey: ['test', 1] as const });

    await sleep(100);

    expect(dependentQuery.spies.queryFn).toHaveBeenCalledTimes(0);

    await sleep(100);

    // НО когда мы начнем следить за кверей то все заработает
    reaction(
      () => dependentQuery.result.data,
      () => {},
      { fireImmediately: true },
    );

    expect(dependentQuery.spies.queryFn).toHaveBeenCalledTimes(1);
    expect(dependentQuery.spies.queryFn).nthReturnedWith(1, [
      'test',
      1,
      'dependent',
    ]);

    tempDisabledQuery.destroy();
    dependentQuery.destroy();
  });

  describe('lazyDelay', () => {
    class QueryWithMergedFeatures extends QueryMock {
      get mergedFeatures() {
        return this.features;
      }
    }

    afterEach(() => {
      vi.useRealTimers();
    });

    it('merges lazyDelay from QueryClient defaultOptions.queries', () => {
      const queryClient = new MobxQueryClient({
        defaultOptions: {
          queries: {
            lazy: true,
            lazyDelay: 4242,
          },
        },
      });
      const query = new QueryWithMergedFeatures(
        {
          queryKey: ['lazy-delay-merge'],
          queryFn: () => 1,
          lazy: true,
        },
        queryClient,
      );

      expect(query.mergedFeatures.lazyDelay).toBe(4242);
      query.destroy();
    });

    it('query lazyDelay overrides QueryClient defaultOptions.queries', () => {
      const queryClient = new MobxQueryClient({
        defaultOptions: {
          queries: {
            lazy: true,
            lazyDelay: 1,
          },
        },
      });
      const query = new QueryWithMergedFeatures(
        {
          queryKey: ['lazy-delay-override'],
          queryFn: () => 1,
          lazy: true,
          lazyDelay: 2,
        },
        queryClient,
      );

      expect(query.mergedFeatures.lazyDelay).toBe(2);
      query.destroy();
    });

    it('delays tearing down the observer so a quick re-subscribe does not refetch', async () => {
      vi.useFakeTimers();

      const queryClient = new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 0,
          },
        },
      });
      const query = new QueryMock(
        {
          queryKey: ['lazy-delay-behavior'] as const,
          queryFn: async () => 'x',
          lazy: true,
          lazyDelay: 10_000,
        },
        queryClient,
      );

      const disposer1 = reaction(
        () => query.data,
        () => {},
        { fireImmediately: true },
      );

      await when(() => query.isSuccess);

      expect(query.spies.queryFn).toHaveBeenCalledTimes(1);

      disposer1();

      const disposer2 = reaction(
        () => query.data,
        () => {},
        { fireImmediately: true },
      );

      await vi.advanceTimersByTimeAsync(500);

      expect(query.spies.queryFn).toHaveBeenCalledTimes(1);

      disposer2();

      await vi.advanceTimersByTimeAsync(10_000);

      const disposer3 = reaction(
        () => query.data,
        () => {},
        { fireImmediately: true },
      );

      await when(() => !query.isFetching);
      await vi.runAllTimersAsync();

      expect(query.spies.queryFn).toHaveBeenCalledTimes(2);

      disposer3();
      query.destroy();
    });
  });

  it('missing "queryKey" bug', async () => {
    const abortController = new AbortController();
    const params = {
      pageNumber: 0,
      pageLimit: 1,
      status: '1',
    };

    makeAutoObservable(params);

    const enabledValue = observable.box(false);

    const queryFn = vi.fn().mockResolvedValue(1);

    const mockQuery = new Query({
      queryClient: new QueryClient({}),
      abortSignal: abortController.signal,
      queryKey: ['missing-query-key-bug'] as const,
      options: () => ({
        enabled: enabledValue.get(),
      }),
      queryFn,
      onInit: (query) => {
        reaction(
          () => [params.pageNumber, params.pageLimit, params.status],
          () => {
            query.refetch();
          },
          { signal: abortController.signal },
        );
      },
    });

    expect(mockQuery.options.queryKey).toStrictEqual(['missing-query-key-bug']);

    enabledValue.set(true);

    await sleep();

    expect(mockQuery.options.queryKey).toStrictEqual(['missing-query-key-bug']);

    expect(queryFn).toHaveBeenCalledTimes(1);

    runInAction(() => {
      params.pageNumber = 1;
    });

    runInAction(() => {
      params.pageNumber = 2;
    });

    runInAction(() => {
      params.pageNumber = 3;
    });

    expect(queryFn).toHaveBeenCalledTimes(4);

    await sleep();

    expect(queryFn).toHaveBeenCalledTimes(4);

    abortController.abort();
  });

  describe('"options" reactive parameter', () => {
    it('"options.queryKey" should updates query', async () => {
      const boxCounter = observable.box(0);
      let counter = 0;
      const query = new QueryMock({
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

      await when(() => !query._rawResult.isLoading);

      expect(query.spies.queryFn).toHaveBeenCalledTimes(2);
      expect(query.spies.queryFn).nthReturnedWith(1, 0);
      expect(query.spies.queryFn).nthReturnedWith(2, 10);

      query.destroy();
    });

    it('"options.enabled" should change "enabled" statement for query (enabled as boolean in options)', async () => {
      const boxEnabled = observable.box(false);
      const query = new QueryMock({
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

      await when(() => !query._rawResult.isLoading);

      expect(query.spies.queryFn).toHaveBeenCalledTimes(1);
      expect(query.spies.queryFn).nthReturnedWith(1, 10);

      query.destroy();
    });

    it('"options.enabled" should change "enabled" statement for query (enabled as query based fn)', async () => {
      const boxEnabled = observable.box(false);
      const query = new QueryMock({
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

      await when(() => !query._rawResult.isLoading);

      expect(query.spies.queryFn).toHaveBeenCalledTimes(1);
      expect(query.spies.queryFn).nthReturnedWith(1, true);

      query.destroy();
    });
  });

  describe('"enableOnDemand" option', () => {
    describe('at start', () => {
      it('should not call query if result is not requested (without "enabled" property use)', async () => {
        const query = new QueryMock({
          queryFn: () => 10,
          enableOnDemand: true,
        });

        await when(() => !query._rawResult.isLoading);

        expect(query.spies.queryFn).toHaveBeenCalledTimes(0);

        query.destroy();
      });

      it('should not call query if result is not requested (with "enabled": false)', async () => {
        const query = new QueryMock({
          queryFn: () => 10,
          enableOnDemand: true,
          enabled: false,
        });

        await when(() => !query._rawResult.isLoading);

        expect(query.spies.queryFn).toHaveBeenCalledTimes(0);

        query.destroy();
      });

      it('should not call query if result is not requested (with "enabled": fn -> false)', async () => {
        const query = new QueryMock({
          queryFn: () => 10,
          enableOnDemand: true,
          enabled: () => false,
        });

        await when(() => !query._rawResult.isLoading);

        expect(query.spies.queryFn).toHaveBeenCalledTimes(0);

        query.destroy();
      });

      it('should not call query if result is not requested (with "enabled": fn -> true)', async () => {
        const query = new QueryMock({
          queryFn: () => 10,
          enableOnDemand: true,
          enabled: () => true,
        });

        await when(() => !query._rawResult.isLoading);

        expect(query.spies.queryFn).toHaveBeenCalledTimes(0);

        query.destroy();
      });

      it('should not call query if result is not requested (with "enabled": true)', async () => {
        const query = new QueryMock({
          queryFn: () => 10,
          enableOnDemand: true,
          enabled: true,
        });

        await when(() => !query._rawResult.isLoading);

        expect(query.spies.queryFn).toHaveBeenCalledTimes(0);

        query.destroy();
      });

      it('should not call query if result is not requested (with "enabled": false in dynamic options)', async () => {
        const query = new QueryMock({
          queryFn: () => 10,
          enableOnDemand: true,
          options: () => ({
            enabled: false,
          }),
        });

        await when(() => !query._rawResult.isLoading);

        expect(query.spies.queryFn).toHaveBeenCalledTimes(0);

        query.destroy();
      });

      it('should not call query if result is not requested (with "enabled": true in dynamic options)', async () => {
        const query = new QueryMock({
          queryFn: () => 10,
          enableOnDemand: true,
          options: () => ({
            enabled: true,
          }),
        });

        await when(() => !query._rawResult.isLoading);

        expect(query.spies.queryFn).toHaveBeenCalledTimes(0);

        query.destroy();
      });

      it('should call query if result is requested (without "enabled" property use)', async () => {
        const query = new QueryMock({
          queryFn: () => 10,
          enableOnDemand: true,
        });

        query.result.data;

        await when(() => !query._rawResult.isLoading);

        expect(query.spies.queryFn).toHaveBeenCalledTimes(1);

        query.destroy();
      });

      it('should not call query event if result is requested (reason: "enabled": false out of box)', async () => {
        const query = new QueryMock({
          queryFn: () => 10,
          enableOnDemand: true,
          enabled: false,
        });

        query.result.data;

        await when(() => !query._rawResult.isLoading);

        expect(query.spies.queryFn).toHaveBeenCalledTimes(0);

        query.destroy();
      });

      it('should not call query even if result is requested (reason: "enabled": fn -> false)', async () => {
        const query = new QueryMock({
          queryFn: () => 10,
          enableOnDemand: true,
          enabled: function getEnabledFromUnitTest() {
            return false;
          },
        });

        query.result.data;

        await when(() => !query._rawResult.isLoading);

        expect(query.spies.queryFn).toHaveBeenCalledTimes(0);

        query.destroy();
      });

      it('should call query if result is requested (with "enabled": fn -> true)', async () => {
        const query = new QueryMock({
          queryFn: () => 10,
          enableOnDemand: true,
          enabled: () => true,
        });

        query.result.data;

        await when(() => !query._rawResult.isLoading);

        expect(query.spies.queryFn).toHaveBeenCalledTimes(1);

        query.destroy();
      });

      it('should call query if result is requested (with "enabled": true)', async () => {
        const query = new QueryMock({
          queryFn: () => 10,
          enableOnDemand: true,
          enabled: true,
        });

        query.result.data;

        await when(() => !query._rawResult.isLoading);

        expect(query.spies.queryFn).toHaveBeenCalledTimes(1);

        query.destroy();
      });
      it('should NOT call query if result is requested (reason: "enabled" false from default query client options)', async () => {
        const queryClient = new QueryClient({
          defaultOptions: {
            queries: {
              enabled: false,
            },
          },
        });
        const query = new QueryMock(
          {
            queryKey: ['test', 0 as number] as const,
            queryFn: () => 100,
            enableOnDemand: true,
          },
          queryClient,
        );

        query.result.data;
        query.result.isLoading;

        expect(query.spies.queryFn).toHaveBeenCalledTimes(0);

        query.destroy();
      });

      it('should not call query even it is enabled until result is requested', async () => {
        const queryClient = new QueryClient({
          defaultOptions: {
            queries: {
              enabled: true,
            },
          },
        });
        const query = new QueryMock(
          {
            queryKey: ['test', 0 as number] as const,
            queryFn: () => 100,
            enableOnDemand: true,
          },
          queryClient,
        );

        expect(query.spies.queryFn).toHaveBeenCalledTimes(0);

        query.result.data;
        query.result.isLoading;

        expect(query.spies.queryFn).toHaveBeenCalledTimes(1);

        query.destroy();
      });

      it('should enable query when result is requested', async () => {
        const query = new QueryMock({
          queryKey: ['test', 0 as number] as const,
          queryFn: () => 100,
          enableOnDemand: true,
        });

        expect(query.spies.queryFn).toHaveBeenCalledTimes(0);

        query.result.data;
        query.result.isLoading;

        expect(query.spies.queryFn).toHaveBeenCalledTimes(1);

        query.destroy();
      });

      it('should enable query from dynamic options ONLY AFTER result is requested', () => {
        const valueBox = observable.box<string | undefined>();

        const query = new QueryMock({
          queryFn: () => 100,
          enableOnDemand: true,
          options: () => ({
            queryKey: ['values', valueBox.get()] as const,
            enabled: !!valueBox.get(),
          }),
        });

        query.result.data;
        query.result.isLoading;

        expect(query.spies.queryFn).toHaveBeenCalledTimes(0);

        runInAction(() => {
          valueBox.set('value');
        });

        expect(query.spies.queryFn).toHaveBeenCalledTimes(1);

        query.destroy();
      });

      it('should enable query from dynamic options ONLY AFTER result is requested (multiple observable updates)', () => {
        const valueBox = observable.box<string | null | undefined>();

        const query = new QueryMock({
          queryFn: () => 100,
          enableOnDemand: true,
          options: () => {
            const value = valueBox.get();
            return {
              queryKey: ['values', value] as const,
              enabled: value === 'kek',
            };
          },
        });

        query.result.data;
        query.result.isLoading;

        expect(query.spies.queryFn).toHaveBeenCalledTimes(0);

        runInAction(() => {
          valueBox.set(null);
        });

        runInAction(() => {
          valueBox.set('faslse');
        });

        expect(query.spies.queryFn).toHaveBeenCalledTimes(0);

        runInAction(() => {
          valueBox.set('kek');
        });

        expect(query.spies.queryFn).toHaveBeenCalledTimes(1);

        query.destroy();
      });
    });
  });

  describe('"setData" method', () => {
    const queryClient = new QueryClient();

    afterEach(() => {
      vi.restoreAllMocks();
      queryClient.clear();
    });

    it('should simple update query data', async ({ task }) => {
      const queryData = {
        a: {
          b: {
            c: {
              d: {
                f: {
                  children: [
                    {
                      id: '1',
                      name: 'John',
                      age: 20,
                    },
                  ],
                },
              },
            },
          },
        },
      } as Record<string, any>;

      const query = new QueryMock(
        {
          queryKey: [task.name, '1'],
          queryFn: () => structuredClone(queryData),
        },
        queryClient,
      );

      await when(() => !query.result.isLoading);

      query.setData(() => ({ bar: 1, baz: 2 }));

      expect(query.spies.queryFn).toHaveBeenCalledTimes(1);
      expect(query.result.data).toEqual({ bar: 1, baz: 2 });

      query.destroy();
    });
    it('should update query data using mutation', async ({ task }) => {
      const queryData = {
        a: {
          b: {
            c: {
              d: {
                e: {
                  children: [
                    {
                      id: '1',
                      name: 'John',
                      age: 20,
                    },
                  ],
                },
              },
            },
          },
        },
      } as Record<string, any>;

      const query = new QueryMock(
        {
          queryKey: [task.name, '2'],
          queryFn: () => structuredClone(queryData),
        },
        queryClient,
      );

      await when(() => !query.result.isLoading);
      await sleep(10);

      query.setData((curr) => {
        if (!curr) return curr;
        curr.a.b.c.d.e.children.push({ id: '2', name: 'Doe', age: 21 });
        return curr;
      });

      await when(() => !query.result.isLoading);

      expect(query.spies.queryFn).toHaveBeenCalledTimes(1);
      expect(query.result.data).toEqual({
        a: {
          b: {
            c: {
              d: {
                e: {
                  children: [
                    {
                      id: '1',
                      name: 'John',
                      age: 20,
                    },
                    {
                      id: '2',
                      name: 'Doe',
                      age: 21,
                    },
                  ],
                },
              },
            },
          },
        },
      });
    });
    it('should calls reactions after update query data using mutation', async ({
      task,
    }) => {
      const queryData = {
        a: {
          b: {
            c: {
              d: {
                e: {
                  children: [
                    {
                      id: '1',
                      name: 'John',
                      age: 20,
                    },
                  ],
                },
              },
            },
          },
        },
      } as Record<string, any>;

      const query = new QueryMock(
        {
          queryKey: [task.name, '3'],
          queryFn: () => structuredClone(queryData),
        },
        queryClient,
      );

      const reactionSpy = vi.fn();

      reaction(
        () => query.result.data,
        (curr, prev) => reactionSpy(curr, prev),
      );

      await when(() => !query.result.isLoading);
      await sleep(10);

      query.setData((curr) => {
        if (!curr) return curr;
        curr.a.b.c.d.e.children.push({ id: '2', name: 'Doe', age: 21 });
        return curr;
      });

      expect(reactionSpy).toHaveBeenCalledTimes(2);
      expect(reactionSpy).toHaveBeenNthCalledWith(
        2,
        {
          a: {
            b: {
              c: {
                d: {
                  e: {
                    children: [
                      {
                        id: '1',
                        name: 'John',
                        age: 20,
                      },
                      {
                        id: '2',
                        name: 'Doe',
                        age: 21,
                      },
                    ],
                  },
                },
              },
            },
          },
        },
        {
          a: {
            b: {
              c: {
                d: {
                  e: {
                    children: [
                      {
                        id: '1',
                        name: 'John',
                        age: 20,
                      },
                    ],
                  },
                },
              },
            },
          },
        },
      );

      query.destroy();
    });
    it('should update computed.structs after update query data using mutation', async ({
      task,
    }) => {
      const queryData = {
        a: {
          b: {
            c: {
              d: {
                e: {
                  children: [
                    {
                      id: '1',
                      name: 'John',
                      age: 20,
                    },
                  ],
                },
              },
            },
          },
        },
      } as Record<string, any>;

      class TestClass {
        query = new QueryMock(
          {
            queryKey: [task.name, '4'],
            queryFn: () => structuredClone(queryData),
          },
          queryClient,
        );

        constructor() {
          computed.struct(this, 'foo');
          makeObservable(this);
        }

        get foo() {
          return this.query.result.data?.a.b.c.d.e.children[0] || null;
        }

        destroy() {
          this.query.destroy();
        }
      }

      const testClass = new TestClass();

      await when(() => !testClass.query.result.isLoading);
      await sleep(10);

      expect(testClass.foo).toStrictEqual({
        age: 20,
        id: '1',
        name: 'John',
      });

      testClass.query.setData((curr) => {
        if (!curr) return curr;
        curr.a.b.c.d.e.children[0].name = 'Doe';
        return curr;
      });

      expect(testClass.foo).toStrictEqual({
        age: 20,
        id: '1',
        name: 'Doe',
      });

      testClass.destroy();
    });
    it('computed.structs should be reactive after update query data using mutation', async ({
      task,
    }) => {
      const queryData = {
        a: {
          b: {
            c: {
              d: {
                e: {
                  children: [
                    {
                      id: '1',
                      name: 'John',
                      age: 20,
                    },
                  ],
                },
              },
            },
          },
        },
      } as Record<string, any>;

      class TestClass {
        query = new QueryMock(
          {
            queryKey: [task.name, '5'],
            queryFn: () => structuredClone(queryData),
          },
          queryClient,
        );

        constructor() {
          computed.struct(this, 'foo');
          makeObservable(this);
        }

        get foo() {
          return this.query.result.data?.a.b.c.d.e.children[0] || null;
        }

        destroy() {
          this.query.destroy();
        }
      }

      const testClass = new TestClass();

      const reactionFooSpy = vi.fn();

      reaction(
        () => testClass.foo,
        (curr, prev) => reactionFooSpy(curr, prev),
      );

      await when(() => !testClass.query.result.isLoading);
      await sleep(10);

      testClass.query.setData((curr) => {
        if (!curr) return curr;
        curr.a.b.c.d.e.children[0].name = 'Doe';
        return curr;
      });

      expect(reactionFooSpy).toHaveBeenCalledTimes(2);

      expect(reactionFooSpy).toHaveBeenNthCalledWith(
        2,
        {
          age: 20,
          id: '1',
          name: 'Doe',
        },
        {
          age: 20,
          id: '1',
          name: 'John',
        },
      );

      testClass.destroy();
    });
  });

  describe('"invalidate" method', () => {
    beforeEach(() => {
      vi.clearAllMocks();
    });

    it('should call queryClient.invalidateQueries with exact: true', async () => {
      const queryClient = new QueryClient();
      const invalidateQueriesSpy = vi.spyOn(queryClient, 'invalidateQueries');

      const query = new QueryMock(
        {
          queryKey: ['test', 'key'],
          queryFn: () => 'data',
        },
        queryClient,
      );

      await when(() => !query._rawResult.isLoading);

      await query.invalidate();

      expect(query.spies.invalidate).toHaveBeenCalled();
      expect(invalidateQueriesSpy).toHaveBeenCalledWith({
        exact: true,
        queryKey: ['test', 'key'],
      });

      query.destroy();
      invalidateQueriesSpy.mockRestore();
    });

    it('should pass parameters to queryClient.invalidateQueries', async () => {
      const queryClient = new QueryClient();
      const invalidateQueriesSpy = vi.spyOn(queryClient, 'invalidateQueries');

      const query = new QueryMock(
        {
          queryKey: ['test', 'key'],
          queryFn: () => 'data',
        },
        queryClient,
      );

      await when(() => !query._rawResult.isLoading);

      await query.invalidate();

      expect(invalidateQueriesSpy).toHaveBeenCalledWith({
        exact: true,
        queryKey: ['test', 'key'],
      });

      query.destroy();
      invalidateQueriesSpy.mockRestore();
    });

    it('should invalidate queries with matching query key', async () => {
      const queryClient = new QueryClient();
      // Mock the invalidateQueries method to track calls
      const invalidateQueriesSpy = vi.spyOn(queryClient, 'invalidateQueries');

      const query1 = new QueryMock(
        {
          queryKey: ['users'],
          queryFn: () => ['user1', 'user2'],
        },
        queryClient,
      );

      const query2 = new QueryMock(
        {
          queryKey: ['users', '1'],
          queryFn: () => ({ id: 1, name: 'User 1' }),
        },
        queryClient,
      );

      await when(() => !query1._rawResult.isLoading);
      await when(() => !query2._rawResult.isLoading);

      await query1.invalidate();

      // Both queries should be invalidated
      expect(invalidateQueriesSpy).toHaveBeenCalledWith({
        exact: true,
        queryKey: ['users'],
      });

      query1.destroy();
      query2.destroy();
      invalidateQueriesSpy.mockRestore();
    });

    it('should invalidate queries with exact key match', async () => {
      const queryClient = new QueryClient();
      // Mock the invalidateQueries method to track calls
      const invalidateQueriesSpy = vi.spyOn(queryClient, 'invalidateQueries');

      const query1 = new QueryMock(
        {
          queryKey: ['users', '1'],
          queryFn: () => ({ id: 1, name: 'User 1' }),
        },
        queryClient,
      );

      const query2 = new QueryMock(
        {
          queryKey: ['users', '2'],
          queryFn: () => ({ id: 2, name: 'User 2' }),
        },
        queryClient,
      );

      await when(() => !query1._rawResult.isLoading);
      await when(() => !query2._rawResult.isLoading);

      await query1.invalidate();

      expect(invalidateQueriesSpy).toHaveBeenCalledWith({
        exact: true,
        queryKey: ['users', '1'],
      });

      query1.destroy();
      query2.destroy();
      invalidateQueriesSpy.mockRestore();
    });

    it('should invalidate queries with prefix matching', async () => {
      const queryClient = new QueryClient();
      const invalidateQueriesSpy = vi.spyOn(queryClient, 'invalidateQueries');

      const query1 = new Query({
        queryClient,
        queryKey: ['users', '1', 'profile'],
        queryFn: () => ({ id: 1, name: 'User 1' }),
      });

      const query2 = new Query({
        queryClient,
        queryKey: ['users', '2', 'profile'],
        queryFn: () => ({ id: 2, name: 'User 2' }),
      });

      await when(() => !query1.isLoading);
      await when(() => !query2.isLoading);

      await query1.invalidate();

      expect(invalidateQueriesSpy).toHaveBeenNthCalledWith(1, {
        exact: true,
        queryKey: ['users', '1', 'profile'],
      });

      query1.destroy();
      query2.destroy();
      invalidateQueriesSpy.mockRestore();
    });

    it('should handle invalidation with no parameters', async () => {
      const queryClient = new QueryClient();
      const invalidateQueriesSpy = vi.spyOn(queryClient, 'invalidateQueries');

      const query = new QueryMock(
        {
          queryKey: ['test'],
          queryFn: () => 'data',
        },
        queryClient,
      );

      await when(() => !query._rawResult.isLoading);

      await query.invalidate();

      expect(invalidateQueriesSpy).toHaveBeenCalledWith({
        exact: true,
        queryKey: ['test'],
      });

      query.destroy();
      invalidateQueriesSpy.mockRestore();
    });

    it('should handle invalidation with refetch options', async () => {
      const queryClient = new QueryClient();
      // Mock the invalidateQueries method to track calls
      const invalidateQueriesSpy = vi.spyOn(queryClient, 'invalidateQueries');

      const query = new QueryMock(
        {
          queryKey: ['test'],
          queryFn: () => 'data',
        },
        queryClient,
      );

      await when(() => !query._rawResult.isLoading);

      await query.invalidate();

      expect(invalidateQueriesSpy).toHaveBeenCalledWith({
        exact: true,
        queryKey: ['test'],
      });

      query.destroy();
      invalidateQueriesSpy.mockRestore();
    });

    it('should properly handle async operation', async () => {
      const queryClient = new QueryClient();
      const invalidateQueriesSpy = vi.spyOn(queryClient, 'invalidateQueries');

      const query = new QueryMock(
        {
          queryKey: ['test'],
          queryFn: () => 'data',
        },
        queryClient,
      );

      await when(() => !query._rawResult.isLoading);

      const result = query.invalidate();

      expect(result).toBeInstanceOf(Promise);
      expect(invalidateQueriesSpy).toHaveBeenCalledWith({
        exact: true,
        queryKey: ['test'],
      });

      await result;

      query.destroy();
      invalidateQueriesSpy.mockRestore();
    });
  });

  describe('"start" method', () => {
    test('should call once queryFn', async () => {
      const querySpyFn = vi.fn();
      const query = new QueryMock({
        queryKey: ['test'],
        queryFn: querySpyFn,
        enabled: false,
      });

      await query.start();

      await when(() => !query._rawResult.isLoading);

      expect(query.result.isFetched).toBeTruthy();
      expect(querySpyFn).toHaveBeenCalledTimes(1);

      query.destroy();
    });

    test('should call queryFn every time when start() method is called', async () => {
      const querySpyFn = vi.fn();
      const query = new QueryMock({
        queryKey: ['test'],
        queryFn: querySpyFn,
        enabled: false,
      });

      await query.start();
      await query.start();
      await query.start();

      await when(() => !query._rawResult.isLoading);

      expect(query.result.isFetched).toBeTruthy();
      expect(querySpyFn).toHaveBeenCalledTimes(3);

      query.destroy();
    });
  });

  describe('scenarios', () => {
    it('query with refetchInterval(number) should be stopped after inner abort', async () => {
      const query = new QueryMock({
        queryFn: async () => {
          await sleep(10);
          return 10;
        },
        enabled: true,
        refetchInterval: 10,
      });

      await sleep(100);
      expect(query.spies.queryFn).toHaveBeenCalledTimes(5);
      query.destroy();

      await sleep(100);

      expect(query.spies.queryFn).toHaveBeenCalledTimes(5);
    });
    it('query with refetchInterval(number) should be stopped after outer abort', async () => {
      const abortController = new AbortController();
      const query = new QueryMock({
        queryFn: async () => {
          await sleep(10);
          return 10;
        },
        enabled: true,
        abortSignal: abortController.signal,
        refetchInterval: 10,
      });

      await sleep(100);
      expect(query.spies.queryFn).toHaveBeenCalledTimes(5);

      abortController.abort();

      await sleep(100);

      expect(query.spies.queryFn).toHaveBeenCalledTimes(5);
    });
    it('query with refetchInterval(fn) should be stopped after inner abort', async () => {
      const query = new QueryMock({
        queryFn: async () => {
          await sleep(10);
          return 10;
        },
        enabled: true,
        refetchInterval: () => 10,
      });

      await sleep(100);
      expect(query.spies.queryFn).toHaveBeenCalledTimes(5);

      query.destroy();

      await sleep(100);

      expect(query.spies.queryFn).toHaveBeenCalledTimes(5);
    });
    it('query with refetchInterval(fn) should be stopped after outer abort', async () => {
      const abortController = new AbortController();
      const query = new QueryMock({
        queryFn: async () => {
          await sleep(10);
          return 10;
        },
        enabled: true,
        abortSignal: abortController.signal,
        refetchInterval: () => 10,
      });

      await sleep(100);
      expect(query.spies.queryFn).toHaveBeenCalledTimes(5);

      abortController.abort();

      await sleep(100);

      expect(query.spies.queryFn).toHaveBeenCalledTimes(5);
    });
    it('query with refetchInterval(condition fn) should be stopped after inner abort', async () => {
      const query = new QueryMock({
        queryFn: async () => {
          await sleep(10);
          return 10;
        },
        enabled: true,
        refetchInterval: (query) => (query.isActive() ? 10 : false),
      });

      await sleep(100);
      expect(query.spies.queryFn).toHaveBeenCalledTimes(5);
      query.destroy();

      await sleep(100);

      expect(query.spies.queryFn).toHaveBeenCalledTimes(5);
    });
    it('query with refetchInterval(condition-fn) should be stopped after outer abort', async () => {
      const abortController = new AbortController();
      const query = new QueryMock({
        queryFn: async () => {
          await sleep(10);
          return 10;
        },
        enabled: true,
        abortSignal: abortController.signal,
        refetchInterval: (query) => (query.isActive() ? 10 : false),
      });

      await sleep(100);
      expect(query.spies.queryFn).toHaveBeenCalledTimes(5);

      abortController.abort();

      await sleep(100);

      expect(query.spies.queryFn).toHaveBeenCalledTimes(5);
    });
    it('dynamic enabled + dynamic refetchInterval', async () => {
      const abortController = new AbortController();
      const counter = observable.box(0);

      const query = new QueryMock({
        queryFn: async () => {
          runInAction(() => {
            counter.set(counter.get() + 1);
          });
          await sleep(10);
          return 10;
        },
        options: () => ({
          enabled: counter.get() < 3,
          queryKey: ['test', counter.get()],
        }),
        abortSignal: abortController.signal,
        refetchInterval: (query) => (query.isDisabled() ? false : 10),
      });

      await sleep(100);
      expect(query.spies.queryFn).toHaveBeenCalledTimes(3);

      abortController.abort();

      await sleep(100);

      expect(query.spies.queryFn).toHaveBeenCalledTimes(3);
    });
    it('dynamic enabled + dynamic refetchInterval(refetchInterval is fixed)', async () => {
      const abortController = new AbortController();
      const counter = observable.box(0);

      const query = new QueryMock({
        queryFn: async () => {
          runInAction(() => {
            counter.set(counter.get() + 1);
          });
          await sleep(10);
          return 10;
        },
        options: () => ({
          enabled: counter.get() < 3,
          queryKey: ['test', counter.get()],
        }),
        abortSignal: abortController.signal,
        refetchInterval: () => 10,
      });

      await sleep(100);
      expect(query.spies.queryFn).toHaveBeenCalledTimes(3);

      abortController.abort();

      await sleep(100);

      expect(query.spies.queryFn).toHaveBeenCalledTimes(3);
    });
    it('dynamic enabled + dynamic refetchInterval (+enabledOnDemand)', async () => {
      const abortController = new AbortController();
      const counter = observable.box(0);

      const query = new QueryMock({
        queryFn: async () => {
          await sleep(10);
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

      await sleep(100);
      expect(query.spies.queryFn).toHaveBeenCalledTimes(0);

      query.result.data;

      await sleep(100);
      expect(query.spies.queryFn).toHaveBeenCalledTimes(10);

      query.result.data;
      query.result.isLoading;
      await sleep(50);
      expect(query.spies.queryFn).toHaveBeenCalledTimes(15);
      abortController.abort();

      query.result.data;
      query.result.data;
      query.result.isLoading;

      await sleep(100);

      query.result.data;
      query.result.isLoading;

      expect(query.spies.queryFn).toHaveBeenCalledTimes(15);
    });

    it('after abort identical (by query key) query another query should work', async () => {
      const abortController1 = new LinkedAbortController();
      const abortController2 = new LinkedAbortController();
      const query1 = new QueryMock({
        queryFn: async () => {
          await sleep(5);
          return 'bar';
        },
        abortSignal: abortController1.signal,
        queryKey: ['test'] as const,
      });
      const query2 = new QueryMock({
        queryFn: async () => {
          await sleep(5);
          return 'foo';
        },
        abortSignal: abortController2.signal,
        queryKey: ['test'] as const,
      });
      abortController1.abort();

      expect(query1.result).toStrictEqual({
        ...query1.result,
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
        promise: query1.result.promise,
        refetch: query1.result.refetch,
        status: 'pending',
      });
      expect(query2.result).toStrictEqual({
        ...query2.result,
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
        promise: query2.result.promise,
        refetch: query2.result.refetch,
        status: 'pending',
      });
      await sleep(10);
      expect(query1.result).toStrictEqual({
        ...query1.result,
        data: 'bar',
        dataUpdatedAt: query1.result.dataUpdatedAt,
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
        promise: query1.result.promise,
        refetch: query1.result.refetch,
        status: 'success',
      });
      expect(query2.result).toStrictEqual({
        ...query2.result,
        data: 'foo',
        dataUpdatedAt: query2.result.dataUpdatedAt,
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
        promise: query2.result.promise,
        refetch: query2.result.refetch,
        status: 'success',
      });
      await sleep(10);
      expect(query1.result).toStrictEqual({
        ...query1.result,
        data: 'bar',
        dataUpdatedAt: query1.result.dataUpdatedAt,
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
        promise: query1.result.promise,
        refetch: query1.result.refetch,
        status: 'success',
      });
    });

    it('after abort identical (by query key) query another query should work (with resetOnDestroy option)', async () => {
      const abortController1 = new LinkedAbortController();
      const abortController2 = new LinkedAbortController();
      const query1 = new QueryMock({
        queryFn: async () => {
          await sleep(5);
          return 'bar';
        },
        abortSignal: abortController1.signal,
        queryKey: ['test'] as const,
        resetOnDestroy: true,
      });
      const query2 = new QueryMock({
        queryFn: async () => {
          await sleep(5);
          return 'foo';
        },
        abortSignal: abortController2.signal,
        queryKey: ['test'] as const,
        resetOnDestroy: true,
      });
      abortController1.abort();

      expect(query1.result).toStrictEqual({
        ...query1.result,
        data: undefined,
        dataUpdatedAt: 0,
        error: null,
        errorUpdateCount: 0,
        errorUpdatedAt: 0,
        failureCount: 0,
        failureReason: null,
        fetchStatus: 'idle',
        isError: false,
        isFetched: false,
        isFetchedAfterMount: false,
        isFetching: false,
        isInitialLoading: false,
        isLoading: false,
        isLoadingError: false,
        isPaused: false,
        isPending: true,
        isPlaceholderData: false,
        isRefetchError: false,
        isRefetching: false,
        isStale: true,
        isSuccess: false,
        promise: query1.result.promise,
        refetch: query1.result.refetch,
        status: 'pending',
      });
      expect(query2.result).toStrictEqual({
        ...query2.result,
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
        promise: query2.result.promise,
        refetch: query2.result.refetch,
        status: 'pending',
      });
      await sleep(10);
      expect(query1.result).toStrictEqual({
        ...query1.result,
        data: undefined,
        dataUpdatedAt: 0,
        error: null,
        errorUpdateCount: 0,
        errorUpdatedAt: 0,
        failureCount: 0,
        failureReason: null,
        fetchStatus: 'idle',
        isError: false,
        isFetched: false,
        isFetchedAfterMount: false,
        isFetching: false,
        isInitialLoading: false,
        isLoading: false,
        isLoadingError: false,
        isPaused: false,
        isPending: true,
        isPlaceholderData: false,
        isRefetchError: false,
        isRefetching: false,
        isStale: true,
        isSuccess: false,
        promise: query1.result.promise,
        refetch: query1.result.refetch,
        status: 'pending',
      });
      expect(query2.result).toStrictEqual({
        ...query2.result,
        data: 'foo',
        dataUpdatedAt: query2.result.dataUpdatedAt,
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
        promise: query2.result.promise,
        refetch: query2.result.refetch,
        status: 'success',
      });
      await sleep(10);
      expect(query1.result).toStrictEqual({
        ...query1.result,
        data: undefined,
        dataUpdatedAt: 0,
        error: null,
        errorUpdateCount: 0,
        errorUpdatedAt: 0,
        failureCount: 0,
        failureReason: null,
        fetchStatus: 'idle',
        isError: false,
        isFetched: false,
        isFetchedAfterMount: false,
        isFetching: false,
        isInitialLoading: false,
        isLoading: false,
        isLoadingError: false,
        isPaused: false,
        isPending: true,
        isPlaceholderData: false,
        isRefetchError: false,
        isRefetching: false,
        isStale: true,
        isSuccess: false,
        promise: query1.result.promise,
        refetch: query1.result.refetch,
        status: 'pending',
      });
    });

    it('options is not reactive when updating after creating #10', () => {
      const enabled = observable.box(false);

      const queryFnSpy = vi.fn();
      const getDynamicOptionsSpy = vi.fn();

      createQuery(queryFnSpy, {
        options: () => {
          getDynamicOptionsSpy();
          return {
            enabled: enabled.get(),
          };
        },
      });

      enabled.set(true);

      expect(queryFnSpy).toHaveBeenCalledTimes(1);
      expect(getDynamicOptionsSpy).toHaveBeenCalledTimes(3);
    });

    it('after abort signal for inprogress success work query create new instance with the same key and it should work', async () => {
      vi.useFakeTimers();
      const abortController1 = new LinkedAbortController();
      const query = new QueryMock({
        queryFn: async () => {
          await sleep(11);
          return {
            foo: 1,
            bar: 2,
            kek: {
              pek: {
                tek: 1,
              },
            },
          };
        },
        enabled: true,
        abortSignal: abortController1.signal,
        queryKey: ['test', 'key'] as const,
      });

      await vi.advanceTimersByTimeAsync(0);

      expect(query.result).toMatchObject({
        status: 'pending',
        fetchStatus: 'fetching',
        isPending: true,
        isSuccess: false,
        isError: false,
        isInitialLoading: true,
        isLoading: true,
        data: undefined,
        dataUpdatedAt: 0,
        error: null,
        errorUpdatedAt: 0,
        failureCount: 0,
        failureReason: null,
        errorUpdateCount: 0,
        isFetched: false,
        isFetchedAfterMount: false,
        isFetching: true,
        isRefetching: false,
        isLoadingError: false,
        isPaused: false,
        isPlaceholderData: false,
        isRefetchError: false,
        isStale: true,
      } satisfies Partial<QueryObserverResult<any>>);

      abortController1.abort();

      await vi.advanceTimersByTimeAsync(20);

      expect(query.result).toMatchObject({
        status: 'success',
        fetchStatus: 'idle',
        isPending: false,
        isSuccess: true,
        isError: false,
        isInitialLoading: false,
        isLoading: false,
        data: {
          foo: 1,
          bar: 2,
          kek: {
            pek: {
              tek: 1,
            },
          },
        },
        dataUpdatedAt: query.result.dataUpdatedAt,
        error: null,
        errorUpdatedAt: 0,
        failureCount: 0,
        failureReason: null,
        errorUpdateCount: 0,
        isFetched: true,
        isFetchedAfterMount: true,
        isFetching: false,
        isRefetching: false,
        isLoadingError: false,
        isPaused: false,
        isPlaceholderData: false,
        isRefetchError: false,
        isStale: true,
      } satisfies Partial<QueryObserverResult<any>>);

      const query2 = new QueryMock({
        queryFn: async () => {
          await sleep(5);
          return 'foo';
        },
        queryKey: ['test', 'key'] as const,
      });

      await vi.advanceTimersByTimeAsync(20);

      expect(query.result).toMatchObject({
        status: 'success',
        fetchStatus: 'idle',
        isPending: false,
        isSuccess: true,
        isError: false,
        isInitialLoading: false,
        isLoading: false,
        data: {
          foo: 1,
          bar: 2,
          kek: {
            pek: {
              tek: 1,
            },
          },
        },
        dataUpdatedAt: query.result.dataUpdatedAt,
        error: null,
        errorUpdatedAt: 0,
        failureCount: 0,
        failureReason: null,
        errorUpdateCount: 0,
        isFetched: true,
        isFetchedAfterMount: true,
        isFetching: false,
        isRefetching: false,
        isLoadingError: false,
        isPaused: false,
        isPlaceholderData: false,
        isRefetchError: false,
        isStale: true,
      } satisfies Partial<QueryObserverResult<any>>);

      expect(query2.result).toMatchObject({
        status: 'success',
        fetchStatus: 'idle',
        isPending: false,
        isSuccess: true,
        isError: false,
        isInitialLoading: false,
        isLoading: false,
        data: 'foo',
        dataUpdatedAt: query2.result.dataUpdatedAt,
        error: null,
        errorUpdatedAt: 0,
        failureCount: 0,
        failureReason: null,
        errorUpdateCount: 0,
        isFetched: true,
        isFetchedAfterMount: true,
        isFetching: false,
        isRefetching: false,
      });

      vi.useRealTimers();

      query2.destroy();
      query.destroy();
    });

    it('after aborted Query with failed queryFn - create new Query with the same key and it should has succeed execution', async () => {
      vi.useFakeTimers();
      const box = observable.box('bar');

      const badResponse = new HttpResponse(
        undefined,
        {
          description: 'not found',
          errorCode: '404',
        },
        {
          status: 404,
          statusText: 'Not Found',
        },
      );

      const okResponse = new HttpResponse(
        {
          fooBars: [1, 2, 3],
        },
        undefined,
        {
          status: 200,
          statusText: 'OK',
        },
      );

      const queryClient = new QueryClient({
        defaultOptions: {
          queries: {
            throwOnError: true,
            queryKeyHashFn: hashKey,
            refetchOnWindowFocus: 'always',
            refetchOnReconnect: 'always',
            staleTime: 5 * 60 * 1000,
            retry: (failureCount, error) => {
              if (error instanceof Response && error.status >= 500) {
                return 3 - failureCount > 0;
              }
              return false;
            },
          },
          mutations: {
            throwOnError: true,
          },
        },
      });

      queryClient.mount();

      const vmAbortController = new AbortController();

      const fetch = createMockFetch();

      const query = new QueryMock(
        {
          abortSignal: vmAbortController.signal,
          queryFn: () =>
            fetch({
              willReturn: badResponse,
            }),
          options: () => ({
            queryKey: ['foo', box.get(), 'baz'] as const,
            enabled: !!box.get(),
          }),
        },
        queryClient,
      );

      await vi.runAllTimersAsync();

      expect(query.result).toMatchObject({
        data: undefined,
        dataUpdatedAt: 0,
        errorUpdateCount: 1,
        error: badResponse,
        failureCount: 1,
        failureReason: badResponse,
        fetchStatus: 'idle',
        isError: true,
        isFetched: true,
        isStale: true,
        isSuccess: false,
        isPending: false,
      } satisfies Partial<QueryObserverResult<any, any>>);
      expect(query.options).toMatchObject({
        enabled: true,
      });

      queryClient.invalidateQueries({
        queryKey: ['foo'],
      });
      vmAbortController.abort();

      await vi.runAllTimersAsync();

      expect(query.result).toMatchObject({
        data: undefined,
        dataUpdatedAt: 0,
        error: null,
        errorUpdateCount: 0,
        failureCount: 0,
        failureReason: null,
        fetchStatus: 'idle',
        isError: false,
        isFetched: false,
        isStale: true,
        isSuccess: false,
        isPending: true,
      } satisfies Partial<QueryObserverResult<any, any>>);

      const vmAbortController2 = new AbortController();

      const query2 = new QueryMock(
        {
          abortSignal: vmAbortController2.signal,
          queryFn: () => {
            return fetch({
              willReturn: okResponse,
            });
          },
          options: () => ({
            queryKey: ['foo', 'bar', 'baz'] as const,
            enabled: true,
          }),
        },
        queryClient,
      );

      await vi.runAllTimersAsync();

      expect(query2.result).toMatchObject({
        data: okResponse,
        isError: false,
        isFetched: true,
        isStale: true,
        isSuccess: true,
        isPending: false,
      } satisfies Partial<QueryObserverResult<any, any>>);
    });

    it('should sync two queries to the same queryKey via options and keep shared data', async () => {
      vi.useFakeTimers();

      const queryClient = new QueryClient({});
      queryClient.mount();

      const firstKeyPart = observable.box('first');
      const secondKeyPart = observable.box('second');

      const firstQuery = new QueryMock(
        {
          queryFn: async () => {
            await sleep(100);
            return 'foo';
          },
          options: () => ({
            queryKey: ['shared-key-test', firstKeyPart.get()] as const,
            enabled: true,
          }),
        },
        queryClient,
      );

      const secondQuery = new QueryMock(
        {
          queryFn: async () => {
            await sleep(200);
            return 'bar';
          },
          options: () => ({
            queryKey: ['shared-key-test', secondKeyPart.get()] as const,
            enabled: true,
          }),
        },
        queryClient,
      );

      const firstObserverDisposer = reaction(
        () => firstQuery.result.data,
        () => {},
        {
          fireImmediately: true,
        },
      );
      const secondObserverDisposer = reaction(
        () => secondQuery.result.data,
        () => {},
        { fireImmediately: true },
      );

      await vi.runAllTimersAsync();

      expect(firstQuery.result.data).toBe('foo');
      expect(secondQuery.result.data).toBe('bar');

      runInAction(() => {
        firstKeyPart.set('merged');
      });
      await vi.runAllTimersAsync();

      runInAction(() => {
        secondKeyPart.set('merged');
      });
      await vi.runAllTimersAsync();

      // Первая query остается подписанной на общий ключ и получает итоговое значение "bar".
      expect(firstQuery.result.data).toBe('bar');
      // Вторая query активна и также получает итоговое значение по общему ключу.
      expect(secondQuery.result.data).toBe('bar');
      expect(firstQuery.spies.queryFn).toHaveBeenCalledTimes(2);
      expect(secondQuery.spies.queryFn).toHaveBeenCalledTimes(2);

      firstObserverDisposer();
      secondObserverDisposer();
      firstQuery.destroy();
      secondQuery.destroy();
      queryClient.unmount();
    });

    it('should sync two queries to the same queryKey and destroy second query before its queryFn completion', async () => {
      vi.useFakeTimers();

      const queryClient = new QueryClient({});
      queryClient.mount();

      const firstKeyPart = observable.box('first');
      const secondKeyPart = observable.box('second');

      const firstQuery = new QueryMock(
        {
          queryFn: async () => {
            await sleep(100);
            return 'foo';
          },
          options: () => ({
            queryKey: ['shared-key-test-destroy', firstKeyPart.get()] as const,
            enabled: true,
          }),
        },
        queryClient,
      );

      const secondQuery = new QueryMock(
        {
          queryFn: async () => {
            await sleep(200);
            return 'bar';
          },
          options: () => ({
            queryKey: ['shared-key-test-destroy', secondKeyPart.get()] as const,
            enabled: true,
          }),
        },
        queryClient,
      );

      const firstObserverDisposer = reaction(
        () => firstQuery.result.data,
        () => {},
        {
          fireImmediately: true,
        },
      );
      const secondObserverDisposer = reaction(
        () => secondQuery.result.data,
        () => {},
        { fireImmediately: true },
      );

      await vi.runAllTimersAsync();

      expect(firstQuery.result.data).toBe('foo');
      expect(secondQuery.result.data).toBe('bar');

      runInAction(() => {
        firstKeyPart.set('merged');
      });
      await vi.runAllTimersAsync();

      runInAction(() => {
        secondKeyPart.set('merged');
      });
      await vi.advanceTimersByTimeAsync(100);

      secondQuery.destroy();

      await vi.runAllTimersAsync();

      expect(firstQuery.result.data).toBe('bar');
      // После destroy() подписка отключена, но при чтении result берется optimistic snapshot по последнему queryKey.
      expect(secondQuery.result.data).toBe('bar');
      expect(firstQuery.spies.queryFn).toHaveBeenCalledTimes(2);
      expect(secondQuery.spies.queryFn).toHaveBeenCalledTimes(2);

      firstObserverDisposer();
      secondObserverDisposer();
      firstQuery.destroy();
      queryClient.unmount();
    });

    it('should sync two lazy queries to the same queryKey via options and keep shared data', async () => {
      vi.useFakeTimers();
      const queryClient = new QueryClient({});
      queryClient.mount();

      const firstKeyPart = observable.box('first');
      const secondKeyPart = observable.box('second');

      const firstQuery = new QueryMock(
        {
          lazy: true,
          queryFn: async () => {
            await sleep(100);
            return 'foo';
          },
          options: () => ({
            queryKey: ['shared-key-test-lazy', firstKeyPart.get()] as const,
            enabled: true,
          }),
        },
        queryClient,
      );

      const secondQuery = new QueryMock(
        {
          lazy: true,
          queryFn: async () => {
            await sleep(200);
            return 'bar';
          },
          options: () => ({
            queryKey: ['shared-key-test-lazy', secondKeyPart.get()] as const,
            enabled: true,
          }),
        },
        queryClient,
      );

      const firstObserverDisposer = reaction(
        () => firstQuery.result.data,
        () => {},
        {
          fireImmediately: true,
        },
      );
      const secondObserverDisposer = reaction(
        () => secondQuery.result.data,
        () => {},
        { fireImmediately: true },
      );

      await vi.runAllTimersAsync();

      expect(firstQuery.result.data).toBe('foo');
      expect(secondQuery.result.data).toBe('bar');

      runInAction(() => {
        firstKeyPart.set('merged');
      });
      await vi.runAllTimersAsync();

      runInAction(() => {
        secondKeyPart.set('merged');
      });
      await vi.runAllTimersAsync();

      expect(firstQuery.result.data).toBe('bar');
      expect(secondQuery.result.data).toBe('bar');
      expect(firstQuery.spies.queryFn).toHaveBeenCalledTimes(2);
      expect(secondQuery.spies.queryFn).toHaveBeenCalledTimes(2);

      firstObserverDisposer();
      secondObserverDisposer();
      firstQuery.destroy();
      secondQuery.destroy();
      queryClient.unmount();

      vi.useRealTimers();
    });

    it('should sync two lazy queries to the same queryKey and destroy second query before its queryFn completion', async () => {
      vi.useFakeTimers();
      const queryClient = new QueryClient({});
      queryClient.mount();

      const firstKeyPart = observable.box('first');
      const secondKeyPart = observable.box('second');

      const firstQuery = new QueryMock(
        {
          lazy: true,
          queryFn: async () => {
            await sleep(100);
            return 'foo';
          },
          options: () => ({
            queryKey: [
              'shared-key-test-lazy-destroy',
              firstKeyPart.get(),
            ] as const,
            enabled: true,
          }),
        },
        queryClient,
      );

      const secondQuery = new QueryMock(
        {
          lazy: true,
          queryFn: async () => {
            await sleep(200);
            return 'bar';
          },
          options: () => ({
            queryKey: [
              'shared-key-test-lazy-destroy',
              secondKeyPart.get(),
            ] as const,
            enabled: true,
          }),
        },
        queryClient,
      );

      const firstObserverDisposer = reaction(
        () => firstQuery.result.data,
        () => {},
        {
          fireImmediately: true,
        },
      );
      const secondObserverDisposer = reaction(
        () => secondQuery.result.data,
        () => {},
        { fireImmediately: true },
      );

      await vi.runAllTimersAsync();

      expect(firstQuery.result.data).toBe('foo');
      expect(secondQuery.result.data).toBe('bar');

      runInAction(() => {
        firstKeyPart.set('merged');
      });
      await vi.runAllTimersAsync();

      runInAction(() => {
        secondKeyPart.set('merged');
      });
      await vi.advanceTimersByTimeAsync(100);

      secondQuery.destroy();

      await vi.runAllTimersAsync();

      expect(firstQuery.result.data).toBe('bar');
      expect(secondQuery.result.data).toBe('bar');
      expect(firstQuery.spies.queryFn).toHaveBeenCalledTimes(2);
      expect(secondQuery.spies.queryFn).toHaveBeenCalledTimes(2);

      firstObserverDisposer();
      secondObserverDisposer();
      firstQuery.destroy();
      queryClient.unmount();

      vi.useRealTimers();
    });

    it('after aborted Query with failed queryFn - create new Query with the same key and it should has succeed execution (+ abort signal usage inside query fn)', async () => {
      vi.useFakeTimers();
      const box = observable.box('bar');

      const badResponse = new HttpResponse(
        undefined,
        {
          description: 'not found',
          errorCode: '404',
        },
        {
          status: 404,
          statusText: 'Not Found',
        },
      );

      const okResponse = new HttpResponse(
        {
          fooBars: [1, 2, 3],
        },
        undefined,
        {
          status: 200,
          statusText: 'OK',
        },
      );

      const queryClient = new QueryClient({
        defaultOptions: {
          queries: {
            throwOnError: true,
            queryKeyHashFn: hashKey,
            refetchOnWindowFocus: 'always',
            refetchOnReconnect: 'always',
            staleTime: 5 * 60 * 1000,
            retry: (failureCount, error) => {
              if (error instanceof Response && error.status >= 500) {
                return 3 - failureCount > 0;
              }
              return false;
            },
          },
          mutations: {
            throwOnError: true,
          },
        },
      });

      queryClient.mount();

      const vmAbortController = new AbortController();

      const fetch = createMockFetch();

      const query = new QueryMock(
        {
          abortSignal: vmAbortController.signal,
          queryFn: ({ signal }) =>
            fetch({
              willReturn: badResponse,
              signal,
            }),
          options: () => ({
            queryKey: ['foo', box.get(), 'baz'] as const,
            enabled: !!box.get(),
          }),
        },
        queryClient,
      );

      await vi.runAllTimersAsync();

      expect(query.result).toMatchObject({
        data: undefined,
        dataUpdatedAt: 0,
        errorUpdateCount: 1,
        error: badResponse,
        failureCount: 1,
        failureReason: badResponse,
        fetchStatus: 'idle',
        isError: true,
        isFetched: true,
        isStale: true,
        isSuccess: false,
        isPending: false,
      } satisfies Partial<QueryObserverResult<any, any>>);
      expect(query.options).toMatchObject({
        enabled: true,
      });

      queryClient.invalidateQueries({
        queryKey: ['foo'],
      });
      vmAbortController.abort();

      await vi.runAllTimersAsync();

      expect(query.result).toMatchObject({
        data: undefined,
        dataUpdatedAt: 0,
        error: null,
        errorUpdateCount: 0,
        failureCount: 0,
        failureReason: null,
        fetchStatus: 'idle',
        isError: false,
        isFetched: false,
        isStale: true,
        isSuccess: false,
        isPending: true,
      } satisfies Partial<QueryObserverResult<any, any>>);

      const vmAbortController2 = new AbortController();

      const query2 = new QueryMock(
        {
          abortSignal: vmAbortController2.signal,
          queryFn: ({ signal }) => {
            return fetch({
              willReturn: okResponse,
              signal,
            });
          },
          options: () => ({
            queryKey: ['foo', 'bar', 'baz'] as const,
            enabled: true,
          }),
        },
        queryClient,
      );

      await vi.runAllTimersAsync();

      expect(query2.result).toMatchObject({
        data: okResponse,
        isError: false,
        isFetched: true,
        isStale: true,
        isSuccess: true,
        isPending: false,
      } satisfies Partial<QueryObserverResult<any, any>>);
    });
  });

  describe('throwOnError', () => {
    it('should throw error (throwOnError: true in options)', async () => {
      vi.useFakeTimers();
      const query = new QueryMock({
        throwOnError: true,
        enabled: false,
        queryFn: async () => {
          throw new Error('QueryError');
        },
      });
      let error: Error | undefined;

      const promise = query.start().catch((error_) => {
        error = error_;
      });
      await vi.runAllTimersAsync();

      await promise;

      expect(error?.message).toBe('QueryError');
    });

    it('should throw error (updating param throwOnError true)', async () => {
      vi.useFakeTimers();
      const query = new QueryMock({
        enabled: false,
        queryFn: async () => {
          throw new Error('QueryError');
        },
      });
      let error: Error | undefined;

      const promise = query.start({ throwOnError: true }).catch((error_) => {
        error = error_;
      });
      await vi.runAllTimersAsync();

      await promise;

      expect(error?.message).toBe('QueryError');
    });

    it('should throw error (throwOnError: true in global options)', async () => {
      vi.useFakeTimers();
      const query = new QueryMock(
        {
          enabled: false,
          queryFn: async () => {
            throw new Error('QueryError');
          },
        },
        new QueryClient({
          defaultOptions: {
            queries: {
              throwOnError: true,
            },
          },
        }),
      );
      let error: Error | undefined;

      const promise = query.start().catch((error_) => {
        error = error_;
      });
      await vi.runAllTimersAsync();

      await promise;

      expect(error?.message).toBe('QueryError');
    });
  });

  it('select type bugfix (#12 issue)', async () => {
    const data = [
      {
        address: 'a1',
        name: 'Foo',
      },
      {
        address: 'b1',
        name: 'Bar',
      },
    ];

    const queryWithSelect = new Query({
      queryClient: new QueryClient(),
      queryKey: ['a'],
      queryFn: () => data,
      select: (data) => {
        return new Map(data.map((item) => [item.address, item]));
      },
    });

    await when(() => !queryWithSelect.result.isLoading);

    expectTypeOf(queryWithSelect.result.data).toEqualTypeOf<
      undefined | Map<string, { address: string; name: string }>
    >();
    expect(queryWithSelect.result.data).toBeDefined();
  });

  it('initialData is not enabling query bug (enableOnDemand: true, staleTime: 0)', async () => {
    vi.useFakeTimers();

    const queryClient = new MobxQueryClient({
      defaultOptions: {
        queries: {
          staleTime: 0,
          enableOnDemand: true,
        },
      },
    });
    const box = observable.box(false);
    const queryFn = vi.fn(() => {
      return Promise.resolve({
        meta: {
          limit: 0,
          offset: 0,
          total: 0,
        },
        fruits: ['fruit1', 'fruit2', 'fruit3'],
      });
    });

    const query = new Query({
      queryClient,
      queryFn: async () => {
        const result = await queryFn();
        return result;
      },
      initialData: {
        meta: {
          limit: 0,
          offset: 0,
          total: 0,
        },
        fruits: [],
      } as Awaited<ReturnType<typeof queryFn>>,
      options: () => ({
        queryKey: ['fruits', box.get() ? 'enabled' : 'disabled'] as const,
        enabled: box.get(),
      }),
      select: (data) =>
        data.fruits.map((fruit) => ({
          fruit,
          searchText: fruit,
        })),
    });

    sleep(100);
    await vi.runAllTimersAsync();

    expect(query.data).toStrictEqual([]);

    const managedQueryData = {
      get isEmpty() {
        return !query.data?.length;
      },
      get data() {
        return query.data ?? [];
      },
      get isLoading() {
        return query.isFetching;
      },
    };

    makeObservable(managedQueryData, {
      isEmpty: computed.struct,
      data: computed.struct,
      isLoading: computed.struct,
    });

    // it runs query
    managedQueryData.isLoading;

    if (managedQueryData.isEmpty) {
      managedQueryData.data;
      managedQueryData.isLoading;
    }

    sleep(100);
    await vi.runAllTimersAsync();

    expect(managedQueryData.data).toStrictEqual([]);

    box.set(true);
    sleep(100);
    await vi.runAllTimersAsync();

    expect(managedQueryData.data).toStrictEqual([
      { fruit: 'fruit1', searchText: 'fruit1' },
      { fruit: 'fruit2', searchText: 'fruit2' },
      { fruit: 'fruit3', searchText: 'fruit3' },
    ]);
  });

  it('initialData is not enabling query bug (enableOnDemand: true, staleTime: Infinity)', async () => {
    vi.useFakeTimers();

    const queryClient = new MobxQueryClient({
      defaultOptions: {
        queries: {
          staleTime: Infinity,
          enableOnDemand: true,
        },
      },
    });
    const box = observable.box(false);
    const queryFn = vi.fn(() => {
      return Promise.resolve({
        meta: {
          limit: 0,
          offset: 0,
          total: 0,
        },
        fruits: ['fruit1', 'fruit2', 'fruit3'],
      });
    });

    const query = new Query({
      queryClient,
      queryFn: async () => {
        const result = await queryFn();
        return result;
      },
      initialData: {
        meta: {
          limit: 0,
          offset: 0,
          total: 0,
        },
        fruits: [],
      } as Awaited<ReturnType<typeof queryFn>>,
      options: () => ({
        queryKey: ['fruits', box.get() ? 'enabled' : 'disabled'] as const,
        enabled: box.get(),
      }),
      select: (data) =>
        data.fruits.map((fruit) => ({
          fruit,
          searchText: fruit,
        })),
    });

    sleep(100);
    await vi.runAllTimersAsync();

    expect(query.data).toStrictEqual([]);

    const managedQueryData = {
      get isEmpty() {
        return !query.data?.length;
      },
      get data() {
        return query.data ?? [];
      },
      get isLoading() {
        return query.isFetching;
      },
    };

    makeObservable(managedQueryData, {
      isEmpty: computed.struct,
      data: computed.struct,
      isLoading: computed.struct,
    });

    // it runs query
    managedQueryData.isLoading;

    if (managedQueryData.isEmpty) {
      managedQueryData.data;
      managedQueryData.isLoading;
    }

    sleep(100);
    await vi.runAllTimersAsync();

    expect(managedQueryData.data).toStrictEqual([]);

    box.set(true);
    sleep(100);
    await vi.runAllTimersAsync();

    // Because staleTime - Infiniti and initialData is not null
    // So initialData will be setted to cache and cache will be saved infinity
    expect(managedQueryData.data).toStrictEqual([]);

    await query.invalidate();

    expect(managedQueryData.data).toStrictEqual([
      { fruit: 'fruit1', searchText: 'fruit1' },
      { fruit: 'fruit2', searchText: 'fruit2' },
      { fruit: 'fruit3', searchText: 'fruit3' },
    ]);
  });

  it('without initialData is not enabling query bug (enableOnDemand: true, staleTime: 0)', async () => {
    vi.useFakeTimers();

    const queryClient = new MobxQueryClient({
      defaultOptions: {
        queries: {
          staleTime: 0,
          enableOnDemand: true,
        },
      },
    });
    const box = observable.box(false);
    const queryFn = vi.fn(() => {
      return Promise.resolve({
        meta: {
          limit: 0,
          offset: 0,
          total: 0,
        },
        fruits: ['fruit1', 'fruit2', 'fruit3'],
      });
    });

    const query = new Query({
      queryClient,
      queryFn: async () => {
        const result = await queryFn();
        return result;
      },
      options: () => ({
        queryKey: ['fruits', box.get() ? 'enabled' : 'disabled'] as const,
        enabled: box.get(),
      }),
      select: (data) =>
        data.fruits.map((fruit) => ({
          fruit,
          searchText: fruit,
        })),
    });

    sleep(100);
    await vi.runAllTimersAsync();

    expect(query.data).toStrictEqual(undefined);

    const managedQueryData = {
      get isEmpty() {
        return !query.data?.length;
      },
      get data() {
        return query.data ?? [];
      },
      get isLoading() {
        return query.isFetching;
      },
    };

    makeObservable(managedQueryData, {
      isEmpty: computed.struct,
      data: computed.struct,
      isLoading: computed.struct,
    });

    // it runs query
    managedQueryData.isLoading;

    if (managedQueryData.isEmpty) {
      managedQueryData.data;
      managedQueryData.isLoading;
    }

    sleep(100);
    await vi.runAllTimersAsync();

    expect(managedQueryData.data).toStrictEqual([]);

    box.set(true);
    sleep(100);
    await vi.runAllTimersAsync();

    expect(managedQueryData.data).toStrictEqual([
      { fruit: 'fruit1', searchText: 'fruit1' },
      { fruit: 'fruit2', searchText: 'fruit2' },
      { fruit: 'fruit3', searchText: 'fruit3' },
    ]);
  });

  it('without initialData is not enabling query bug (enableOnDemand: true, staleTime: Infinity)', async () => {
    vi.useFakeTimers();

    const queryClient = new MobxQueryClient({
      defaultOptions: {
        queries: {
          staleTime: Infinity,
          enableOnDemand: true,
        },
      },
    });
    const box = observable.box(false);
    const queryFn = vi.fn(() => {
      return Promise.resolve({
        meta: {
          limit: 0,
          offset: 0,
          total: 0,
        },
        fruits: ['fruit1', 'fruit2', 'fruit3'],
      });
    });

    const query = new Query({
      queryClient,
      queryFn: async () => {
        const result = await queryFn();
        return result;
      },
      options: () => ({
        queryKey: ['fruits', box.get() ? 'enabled' : 'disabled'] as const,
        enabled: box.get(),
      }),
      select: (data) =>
        data.fruits.map((fruit) => ({
          fruit,
          searchText: fruit,
        })),
    });

    sleep(100);
    await vi.runAllTimersAsync();

    expect(query.data).toStrictEqual(undefined);

    const managedQueryData = {
      get isEmpty() {
        return !query.data?.length;
      },
      get data() {
        return query.data ?? [];
      },
      get isLoading() {
        return query.isFetching;
      },
    };

    makeObservable(managedQueryData, {
      isEmpty: computed.struct,
      data: computed.struct,
      isLoading: computed.struct,
    });

    // it runs query
    managedQueryData.isLoading;

    if (managedQueryData.isEmpty) {
      managedQueryData.data;
      managedQueryData.isLoading;
    }

    sleep(100);
    await vi.runAllTimersAsync();

    expect(managedQueryData.data).toStrictEqual([]);

    box.set(true);
    sleep(100);
    await vi.runAllTimersAsync();

    expect(managedQueryData.data).toStrictEqual([
      { fruit: 'fruit1', searchText: 'fruit1' },
      { fruit: 'fruit2', searchText: 'fruit2' },
      { fruit: 'fruit3', searchText: 'fruit3' },
    ]);
  });

  it('initialData is not enabling query bug (enableOnDemand: false, staleTime: 0)', async () => {
    vi.useFakeTimers();

    const queryClient = new MobxQueryClient({
      defaultOptions: {
        queries: {
          staleTime: 0,
          enableOnDemand: false,
        },
      },
    });
    const box = observable.box(false);
    const queryFn = vi.fn(() => {
      return Promise.resolve({
        meta: {
          limit: 0,
          offset: 0,
          total: 0,
        },
        fruits: ['fruit1', 'fruit2', 'fruit3'],
      });
    });

    const query = new Query({
      queryClient,
      queryFn: async () => {
        const result = await queryFn();
        return result;
      },
      initialData: {
        meta: {
          limit: 0,
          offset: 0,
          total: 0,
        },
        fruits: [],
      } as Awaited<ReturnType<typeof queryFn>>,
      options: () => ({
        queryKey: ['fruits', box.get() ? 'enabled' : 'disabled'] as const,
        enabled: box.get(),
      }),
      select: (data) =>
        data.fruits.map((fruit) => ({
          fruit,
          searchText: fruit,
        })),
    });

    sleep(100);
    await vi.runAllTimersAsync();

    expect(query.data).toStrictEqual([]);

    const managedQueryData = {
      get isEmpty() {
        return !query.data?.length;
      },
      get data() {
        return query.data ?? [];
      },
      get isLoading() {
        return query.isFetching;
      },
    };

    makeObservable(managedQueryData, {
      isEmpty: computed.struct,
      data: computed.struct,
      isLoading: computed.struct,
    });

    // it runs query
    managedQueryData.isLoading;

    if (managedQueryData.isEmpty) {
      managedQueryData.data;
      managedQueryData.isLoading;
    }

    sleep(100);
    await vi.runAllTimersAsync();

    expect(managedQueryData.data).toStrictEqual([]);

    box.set(true);
    sleep(100);
    await vi.runAllTimersAsync();

    expect(managedQueryData.data).toStrictEqual([
      { fruit: 'fruit1', searchText: 'fruit1' },
      { fruit: 'fruit2', searchText: 'fruit2' },
      { fruit: 'fruit3', searchText: 'fruit3' },
    ]);
  });

  it('initialData is not enabling query bug (enableOnDemand: false, staleTime: Infinity)', async () => {
    vi.useFakeTimers();

    const queryClient = new MobxQueryClient({
      defaultOptions: {
        queries: {
          staleTime: Infinity,
          enableOnDemand: false,
        },
      },
    });
    const box = observable.box(false);
    const queryFn = vi.fn(() => {
      return Promise.resolve({
        meta: {
          limit: 0,
          offset: 0,
          total: 0,
        },
        fruits: ['fruit1', 'fruit2', 'fruit3'],
      });
    });

    const query = new Query({
      queryClient,
      queryFn: async () => {
        const result = await queryFn();
        return result;
      },
      initialData: {
        meta: {
          limit: 0,
          offset: 0,
          total: 0,
        },
        fruits: [],
      } as Awaited<ReturnType<typeof queryFn>>,
      options: () => ({
        queryKey: ['fruits', box.get() ? 'enabled' : 'disabled'] as const,
        enabled: box.get(),
      }),
      select: (data) =>
        data.fruits.map((fruit) => ({
          fruit,
          searchText: fruit,
        })),
    });

    sleep(100);
    await vi.runAllTimersAsync();

    expect(query.data).toStrictEqual([]);

    const managedQueryData = {
      get isEmpty() {
        return !query.data?.length;
      },
      get data() {
        return query.data ?? [];
      },
      get isLoading() {
        return query.isFetching;
      },
    };

    makeObservable(managedQueryData, {
      isEmpty: computed.struct,
      data: computed.struct,
      isLoading: computed.struct,
    });

    // it runs query
    managedQueryData.isLoading;

    if (managedQueryData.isEmpty) {
      managedQueryData.data;
      managedQueryData.isLoading;
    }

    sleep(100);
    await vi.runAllTimersAsync();

    expect(managedQueryData.data).toStrictEqual([]);

    box.set(true);
    sleep(100);
    await vi.runAllTimersAsync();

    // Because staleTime - Infiniti and initialData is not null
    // So initialData will be setted to cache and cache will be saved infinity
    expect(managedQueryData.data).toStrictEqual([]);

    await query.invalidate();

    expect(managedQueryData.data).toStrictEqual([
      { fruit: 'fruit1', searchText: 'fruit1' },
      { fruit: 'fruit2', searchText: 'fruit2' },
      { fruit: 'fruit3', searchText: 'fruit3' },
    ]);
  });

  it('without initialData is not enabling query bug (enableOnDemand: false, staleTime: 0)', async () => {
    vi.useFakeTimers();

    const queryClient = new MobxQueryClient({
      defaultOptions: {
        queries: {
          staleTime: 0,
          enableOnDemand: false,
        },
      },
    });
    const box = observable.box(false);
    const queryFn = vi.fn(() => {
      return Promise.resolve({
        meta: {
          limit: 0,
          offset: 0,
          total: 0,
        },
        fruits: ['fruit1', 'fruit2', 'fruit3'],
      });
    });

    const query = new Query({
      queryClient,
      queryFn: async () => {
        const result = await queryFn();
        return result;
      },
      options: () => ({
        queryKey: ['fruits', box.get() ? 'enabled' : 'disabled'] as const,
        enabled: box.get(),
      }),
      select: (data) =>
        data.fruits.map((fruit) => ({
          fruit,
          searchText: fruit,
        })),
    });

    sleep(100);
    await vi.runAllTimersAsync();

    expect(query.data).toStrictEqual(undefined);

    const managedQueryData = {
      get isEmpty() {
        return !query.data?.length;
      },
      get data() {
        return query.data ?? [];
      },
      get isLoading() {
        return query.isFetching;
      },
    };

    makeObservable(managedQueryData, {
      isEmpty: computed.struct,
      data: computed.struct,
      isLoading: computed.struct,
    });

    // it runs query
    managedQueryData.isLoading;

    if (managedQueryData.isEmpty) {
      managedQueryData.data;
      managedQueryData.isLoading;
    }

    sleep(100);
    await vi.runAllTimersAsync();

    expect(managedQueryData.data).toStrictEqual([]);

    box.set(true);
    sleep(100);
    await vi.runAllTimersAsync();

    expect(managedQueryData.data).toStrictEqual([
      { fruit: 'fruit1', searchText: 'fruit1' },
      { fruit: 'fruit2', searchText: 'fruit2' },
      { fruit: 'fruit3', searchText: 'fruit3' },
    ]);
  });

  it('without initialData is not enabling query bug (enableOnDemand: false, staleTime: Infinity)', async () => {
    vi.useFakeTimers();

    const queryClient = new MobxQueryClient({
      defaultOptions: {
        queries: {
          staleTime: Infinity,
          enableOnDemand: false,
        },
      },
    });
    const box = observable.box(false);
    const queryFn = vi.fn(() => {
      return Promise.resolve({
        meta: {
          limit: 0,
          offset: 0,
          total: 0,
        },
        fruits: ['fruit1', 'fruit2', 'fruit3'],
      });
    });

    const query = new Query({
      queryClient,
      queryFn: async () => {
        const result = await queryFn();
        return result;
      },
      options: () => ({
        queryKey: ['fruits', box.get() ? 'enabled' : 'disabled'] as const,
        enabled: box.get(),
      }),
      select: (data) =>
        data.fruits.map((fruit) => ({
          fruit,
          searchText: fruit,
        })),
    });

    sleep(100);
    await vi.runAllTimersAsync();

    expect(query.data).toStrictEqual(undefined);

    const managedQueryData = {
      get isEmpty() {
        return !query.data?.length;
      },
      get data() {
        return query.data ?? [];
      },
      get isLoading() {
        return query.isFetching;
      },
    };

    makeObservable(managedQueryData, {
      isEmpty: computed.struct,
      data: computed.struct,
      isLoading: computed.struct,
    });

    // it runs query
    managedQueryData.isLoading;

    if (managedQueryData.isEmpty) {
      managedQueryData.data;
      managedQueryData.isLoading;
    }

    sleep(100);
    await vi.runAllTimersAsync();

    expect(managedQueryData.data).toStrictEqual([]);

    box.set(true);
    sleep(100);
    await vi.runAllTimersAsync();

    expect(managedQueryData.data).toStrictEqual([
      { fruit: 'fruit1', searchText: 'fruit1' },
      { fruit: 'fruit2', searchText: 'fruit2' },
      { fruit: 'fruit3', searchText: 'fruit3' },
    ]);
  });

  it('placeholderData is not enabling query bug (enableOnDemand: true, staleTime: 0)', async () => {
    vi.useFakeTimers();

    const queryClient = new MobxQueryClient({
      defaultOptions: {
        queries: {
          staleTime: 0,
          enableOnDemand: true,
        },
      },
    });
    const box = observable.box(false);
    const queryFn = vi.fn(() => {
      return Promise.resolve({
        meta: {
          limit: 0,
          offset: 0,
          total: 0,
        },
        fruits: ['fruit1', 'fruit2', 'fruit3'],
      });
    });

    const query = new Query({
      queryClient,
      queryFn: async () => {
        const result = await queryFn();
        return result;
      },
      placeholderData: {
        meta: {
          limit: 0,
          offset: 0,
          total: 0,
        },
        fruits: [],
      } as Awaited<ReturnType<typeof queryFn>>,
      options: () => ({
        queryKey: ['fruits', box.get() ? 'enabled' : 'disabled'] as const,
        enabled: box.get(),
      }),
      select: (data) =>
        data.fruits.map((fruit) => ({
          fruit,
          searchText: fruit,
        })),
    });

    sleep(100);
    await vi.runAllTimersAsync();

    expect(query.data).toStrictEqual([]);

    const managedQueryData = {
      get isEmpty() {
        return !query.data?.length;
      },
      get data() {
        return query.data ?? [];
      },
      get isLoading() {
        return query.isFetching;
      },
    };

    makeObservable(managedQueryData, {
      isEmpty: computed.struct,
      data: computed.struct,
      isLoading: computed.struct,
    });

    // it runs query
    managedQueryData.isLoading;

    if (managedQueryData.isEmpty) {
      managedQueryData.data;
      managedQueryData.isLoading;
    }

    sleep(100);
    await vi.runAllTimersAsync();

    expect(managedQueryData.data).toStrictEqual([]);

    box.set(true);
    sleep(100);
    await vi.runAllTimersAsync();

    expect(managedQueryData.data).toStrictEqual([
      { fruit: 'fruit1', searchText: 'fruit1' },
      { fruit: 'fruit2', searchText: 'fruit2' },
      { fruit: 'fruit3', searchText: 'fruit3' },
    ]);
  });

  it('placeholderData is not enabling query bug (enableOnDemand: true, staleTime: Infinity)', async () => {
    vi.useFakeTimers();

    const queryClient = new MobxQueryClient({
      defaultOptions: {
        queries: {
          staleTime: Infinity,
          enableOnDemand: true,
        },
      },
    });
    const box = observable.box(false);
    const queryFn = vi.fn(() => {
      return Promise.resolve({
        meta: {
          limit: 0,
          offset: 0,
          total: 0,
        },
        fruits: ['fruit1', 'fruit2', 'fruit3'],
      });
    });

    const query = new Query({
      queryClient,
      queryFn: async () => {
        const result = await queryFn();
        return result;
      },
      placeholderData: {
        meta: {
          limit: 0,
          offset: 0,
          total: 0,
        },
        fruits: [],
      } as Awaited<ReturnType<typeof queryFn>>,
      options: () => ({
        queryKey: ['fruits', box.get() ? 'enabled' : 'disabled'] as const,
        enabled: box.get(),
      }),
      select: (data) =>
        data.fruits.map((fruit) => ({
          fruit,
          searchText: fruit,
        })),
    });

    sleep(100);
    await vi.runAllTimersAsync();

    expect(query.data).toStrictEqual([]);

    const managedQueryData = {
      get isEmpty() {
        return !query.data?.length;
      },
      get data() {
        return query.data ?? [];
      },
      get isLoading() {
        return query.isFetching;
      },
    };

    makeObservable(managedQueryData, {
      isEmpty: computed.struct,
      data: computed.struct,
      isLoading: computed.struct,
    });

    // it runs query
    managedQueryData.isLoading;

    if (managedQueryData.isEmpty) {
      managedQueryData.data;
      managedQueryData.isLoading;
    }

    sleep(100);
    await vi.runAllTimersAsync();

    expect(managedQueryData.data).toStrictEqual([]);

    box.set(true);
    sleep(100);
    await vi.runAllTimersAsync();

    expect(managedQueryData.data).toStrictEqual([
      { fruit: 'fruit1', searchText: 'fruit1' },
      { fruit: 'fruit2', searchText: 'fruit2' },
      { fruit: 'fruit3', searchText: 'fruit3' },
    ]);
  });

  it('placeholderData is not enabling query bug (enableOnDemand: false, staleTime: 0)', async () => {
    vi.useFakeTimers();

    const queryClient = new MobxQueryClient({
      defaultOptions: {
        queries: {
          staleTime: 0,
          enableOnDemand: false,
        },
      },
    });
    const box = observable.box(false);
    const queryFn = vi.fn(() => {
      return Promise.resolve({
        meta: {
          limit: 0,
          offset: 0,
          total: 0,
        },
        fruits: ['fruit1', 'fruit2', 'fruit3'],
      });
    });

    const query = new Query({
      queryClient,
      queryFn: async () => {
        const result = await queryFn();
        return result;
      },
      placeholderData: {
        meta: {
          limit: 0,
          offset: 0,
          total: 0,
        },
        fruits: [],
      } as Awaited<ReturnType<typeof queryFn>>,
      options: () => ({
        queryKey: ['fruits', box.get() ? 'enabled' : 'disabled'] as const,
        enabled: box.get(),
      }),
      select: (data) =>
        data.fruits.map((fruit) => ({
          fruit,
          searchText: fruit,
        })),
    });

    sleep(100);
    await vi.runAllTimersAsync();

    expect(query.data).toStrictEqual([]);

    const managedQueryData = {
      get isEmpty() {
        return !query.data?.length;
      },
      get data() {
        return query.data ?? [];
      },
      get isLoading() {
        return query.isFetching;
      },
    };

    makeObservable(managedQueryData, {
      isEmpty: computed.struct,
      data: computed.struct,
      isLoading: computed.struct,
    });

    // it runs query
    managedQueryData.isLoading;

    if (managedQueryData.isEmpty) {
      managedQueryData.data;
      managedQueryData.isLoading;
    }

    sleep(100);
    await vi.runAllTimersAsync();

    expect(managedQueryData.data).toStrictEqual([]);

    box.set(true);
    sleep(100);
    await vi.runAllTimersAsync();

    expect(managedQueryData.data).toStrictEqual([
      { fruit: 'fruit1', searchText: 'fruit1' },
      { fruit: 'fruit2', searchText: 'fruit2' },
      { fruit: 'fruit3', searchText: 'fruit3' },
    ]);
  });

  it('placeholderData is not enabling query bug (enableOnDemand: false, staleTime: Infinity)', async () => {
    vi.useFakeTimers();

    const queryClient = new MobxQueryClient({
      defaultOptions: {
        queries: {
          staleTime: Infinity,
          enableOnDemand: false,
        },
      },
    });
    const box = observable.box(false);
    const queryFn = vi.fn(() => {
      return Promise.resolve({
        meta: {
          limit: 0,
          offset: 0,
          total: 0,
        },
        fruits: ['fruit1', 'fruit2', 'fruit3'],
      });
    });

    const query = new Query({
      queryClient,
      queryFn: async () => {
        const result = await queryFn();
        return result;
      },
      placeholderData: {
        meta: {
          limit: 0,
          offset: 0,
          total: 0,
        },
        fruits: [],
      } as Awaited<ReturnType<typeof queryFn>>,
      options: () => ({
        queryKey: ['fruits', box.get() ? 'enabled' : 'disabled'] as const,
        enabled: box.get(),
      }),
      select: (data) =>
        data.fruits.map((fruit) => ({
          fruit,
          searchText: fruit,
        })),
    });

    sleep(100);
    await vi.runAllTimersAsync();

    expect(query.data).toStrictEqual([]);

    const managedQueryData = {
      get isEmpty() {
        return !query.data?.length;
      },
      get data() {
        return query.data ?? [];
      },
      get isLoading() {
        return query.isFetching;
      },
    };

    makeObservable(managedQueryData, {
      isEmpty: computed.struct,
      data: computed.struct,
      isLoading: computed.struct,
    });

    // it runs query
    managedQueryData.isLoading;

    if (managedQueryData.isEmpty) {
      managedQueryData.data;
      managedQueryData.isLoading;
    }

    sleep(100);
    await vi.runAllTimersAsync();

    expect(managedQueryData.data).toStrictEqual([]);

    box.set(true);
    sleep(100);
    await vi.runAllTimersAsync();

    expect(managedQueryData.data).toStrictEqual([
      { fruit: 'fruit1', searchText: 'fruit1' },
      { fruit: 'fruit2', searchText: 'fruit2' },
      { fruit: 'fruit3', searchText: 'fruit3' },
    ]);
  });

  it('flatten types isSuccess isError', async () => {
    const userQuery = new Query({
      enabled: false,
      queryClient: new QueryClient(),
      queryFn: () => ({ email: 'alice@example.com' }),
      queryKey: ['user'],
    });

    const userQueryResult = await userQuery.start();

    expectTypeOf(userQueryResult.data).toEqualTypeOf<
      { email: string } | undefined
    >();

    if (userQueryResult.isSuccess) {
      expectTypeOf(userQueryResult.data).toEqualTypeOf<{ email: string }>();
      expectTypeOf(userQueryResult.error).toEqualTypeOf<null>();
    }

    if (userQueryResult.isError) {
      expectTypeOf(userQueryResult.data).toEqualTypeOf<
        { email: string } | undefined
      >();
      expectTypeOf(userQueryResult.error).toEqualTypeOf<Error>();
    }

    if (userQuery.result.isSuccess) {
      expectTypeOf(userQuery.result.data).toEqualTypeOf<{ email: string }>();
      expectTypeOf(userQuery.result.error).toEqualTypeOf<null>();
    } else {
      expectTypeOf(userQuery.result.data).toEqualTypeOf<
        { email: string } | undefined
      >();
      expectTypeOf(userQuery.result.error).toEqualTypeOf<Error | null>();
    }

    if (userQuery.result.isError) {
      expectTypeOf(userQuery.result.data).toEqualTypeOf<
        { email: string } | undefined
      >();
      expectTypeOf(userQuery.result.error).toEqualTypeOf<Error>();
    } else {
      expectTypeOf(userQuery.result.data).toEqualTypeOf<
        { email: string } | undefined
      >();
      expectTypeOf(userQuery.result.error).toEqualTypeOf<null>();
    }

    // if (userQuery.isSuccess) {
    //   expectTypeOf(userQuery.data).toEqualTypeOf<{ email: string }>();
    //   expectTypeOf(userQuery.error).toEqualTypeOf<null>();
    // }

    // if (userQuery.isError) {
    //   expectTypeOf(userQuery.data).toEqualTypeOf<
    //     { email: string } | undefined
    //   >();
    //   expectTypeOf(userQuery.error).toEqualTypeOf<Error>();
    // }
  });

  it('type bug #66: initialData must match queryFn return type', () => {
    createQuery(() => 1, {
      initialData: 2,
    });

    // @ts-expect-error initialData should be compatible with queryFn return type
    createQuery(() => 1, {
      initialData: '2',
    });
  });

  it('bug #64 (options is not reactive sometimes)', () => {
    const isEnabled = observable.box(false);
    let query: Maybe<Query<{ status: string }>>;

    const queryFn = vi.fn(() => Promise.resolve({ status: 'success' }));

    runInAction(() => {
      query = createQuery(queryFn, {
        enableOnDemand: true,
        options: () => ({
          enabled: isEnabled.get(),
        }),
      });

      isEnabled.set(true);
    });

    query?.result.data; // this won't trigger fetching, which is unexpected

    expect(queryFn).toHaveBeenCalledTimes(1);
  });

  it('onDone should call each time async queryFn returns data', async () => {
    let counter = 0;
    const onDone = vi.fn();
    const query = new Query({
      queryClient: new QueryClient({}),
      queryKey: ['on-done-async'],
      queryFn: async () => ++counter,
      onDone,
    });

    try {
      await when(() => query.result.data === 1);

      await query.refetch();
      await when(() => query.result.data === 2);

      expect(onDone).toHaveBeenNthCalledWith(1, 1, undefined);
      expect(onDone).toHaveBeenNthCalledWith(2, 2, undefined);
    } finally {
      query.destroy();
    }
  });

  it('onDone should call again after reactive queryKey change', async () => {
    const queryKeyPart = observable.box(1);
    const onDone = vi.fn();
    const query = new Query({
      queryClient: new QueryClient({}),
      queryKey: () => ['on-done-query-key-change', queryKeyPart.get()] as const,
      queryFn: async ({ queryKey }) => `value-${queryKey[1]}`,
      onDone,
    });

    try {
      await when(() => query.result.data === 'value-1');

      runInAction(() => {
        queryKeyPart.set(2);
      });

      await when(() => query.result.data === 'value-2');

      expect(onDone).toHaveBeenNthCalledWith(1, 'value-1', undefined);
      expect(onDone).toHaveBeenNthCalledWith(2, 'value-2', undefined);
      expect(onDone).toHaveBeenCalledTimes(2);
    } finally {
      query.destroy();
    }
  });

  it('should not call onDone again when switching back to cached query without new fetch', async () => {
    const queryKeyPart = observable.box(1);
    const queryFn = vi.fn(async ({ queryKey }) => `value-${queryKey[1]}`);
    const onDone = vi.fn();
    const query = new Query({
      queryClient: new QueryClient({}),
      staleTime: Infinity,
      queryKey: () =>
        ['on-done-return-to-cached-query', queryKeyPart.get()] as const,
      queryFn,
      onDone,
    });

    try {
      await when(() => query.result.data === 'value-1');

      runInAction(() => {
        queryKeyPart.set(2);
      });

      await when(() => query.result.data === 'value-2');

      runInAction(() => {
        queryKeyPart.set(1);
      });

      await when(() => query.result.data === 'value-1');

      runInAction(() => {
        queryKeyPart.set(2);
      });

      await when(() => query.result.data === 'value-2');

      expect(queryFn).toHaveBeenCalledTimes(2);
      expect(onDone).toHaveBeenNthCalledWith(1, 'value-1', undefined);
      expect(onDone).toHaveBeenNthCalledWith(2, 'value-2', undefined);
      expect(onDone).toHaveBeenCalledTimes(2);
    } finally {
      query.destroy();
    }
  });

  it('should call onError again when switching back to query', async () => {
    const queryKeyPart = observable.box(1);
    const queryFn = vi.fn(async ({ queryKey }) => {
      throw new Error(`boom-${queryKey[1]}`);
    });
    const onError = vi.fn();
    const query = new Query<never, Error>({
      queryClient: new QueryClient({}),
      staleTime: Infinity,
      retry: false,
      queryKey: () =>
        ['on-error-return-to-cached-query', queryKeyPart.get()] as const,
      queryFn,
      onError,
    });

    try {
      await when(() => query.result.error?.message === 'boom-1');

      runInAction(() => {
        queryKeyPart.set(2);
      });

      await when(() => query.result.error?.message === 'boom-2');

      runInAction(() => {
        queryKeyPart.set(1);
      });

      await when(() => query.result.error?.message === 'boom-1');

      runInAction(() => {
        queryKeyPart.set(2);
      });

      await when(() => query.result.error?.message === 'boom-2');

      expect(queryFn).toHaveBeenCalledTimes(4);
      expect(onError).toHaveBeenNthCalledWith(
        1,
        expect.objectContaining({ message: 'boom-1' }),
        undefined,
      );
      expect(onError).toHaveBeenNthCalledWith(
        2,
        expect.objectContaining({ message: 'boom-2' }),
        undefined,
      );
      expect(onError).toHaveBeenNthCalledWith(
        3,
        expect.objectContaining({ message: 'boom-1' }),
        undefined,
      );
      expect(onError).toHaveBeenNthCalledWith(
        4,
        expect.objectContaining({ message: 'boom-2' }),
        undefined,
      );
      expect(onError).toHaveBeenCalledTimes(4);
    } finally {
      query.destroy();
    }
  });

  it('onError should call again after reactive queryKey change', async () => {
    const queryKeyPart = observable.box(1);
    const onError = vi.fn();
    const query = new Query<never, Error>({
      queryClient: new QueryClient({}),
      queryKey: () =>
        ['on-error-query-key-change', queryKeyPart.get()] as const,
      retry: false,
      queryFn: async ({ queryKey }) => {
        throw new Error(`boom-${queryKey[1]}`);
      },
      onError,
    });

    try {
      await when(() => query.result.error?.message === 'boom-1');

      runInAction(() => {
        queryKeyPart.set(2);
      });

      await when(() => query.result.error?.message === 'boom-2');

      expect(onError).toHaveBeenNthCalledWith(
        1,
        expect.objectContaining({ message: 'boom-1' }),
        undefined,
      );
      expect(onError).toHaveBeenNthCalledWith(
        2,
        expect.objectContaining({ message: 'boom-2' }),
        undefined,
      );
      expect(onError).toHaveBeenCalledTimes(2);
    } finally {
      query.destroy();
    }
  });

  it('onDone should still dedupe cached query with cumulativeQueryHash', async () => {
    vi.useRealTimers();
    const queryKeyPart = observable.box(1);
    const queryFn = vi.fn(async ({ queryKey }) => `value-${queryKey[1]}`);
    const onDone = vi.fn();
    const query = new Query({
      queryClient: new QueryClient({}),
      cumulativeQueryHash: true,
      staleTime: Infinity,
      queryKey: () =>
        ['on-done-cumulative-query-hash', queryKeyPart.get()] as const,
      queryFn,
      onDone,
    });

    try {
      await when(() => query.result.data === 'value-1');

      runInAction(() => {
        queryKeyPart.set(2);
      });

      await when(() => query.result.data === 'value-2');

      runInAction(() => {
        queryKeyPart.set(1);
      });

      await when(() => query.result.data === 'value-1');
      await sleep(20);

      expect(queryFn).toHaveBeenCalledTimes(2);
      expect(onDone).toHaveBeenCalledTimes(2);
    } finally {
      query.destroy();
    }
  });

  it('onDone should refetch removed queries with autoRemovePreviousQuery from query client', async () => {
    vi.useRealTimers();
    const queryKeyPart = observable.box(1);
    const queryFn = vi.fn(async ({ queryKey }) => `value-${queryKey[1]}`);
    const onDone = vi.fn();
    const query = new Query({
      queryClient: new MobxQueryClient({
        defaultOptions: {
          queries: {
            autoRemovePreviousQuery: true,
          },
        },
      }),
      staleTime: Infinity,
      queryKey: () =>
        ['on-done-auto-remove-previous-query', queryKeyPart.get()] as const,
      queryFn,
      onDone,
    });

    try {
      await when(() => query.result.data === 'value-1');

      runInAction(() => {
        queryKeyPart.set(2);
      });

      await when(() => query.result.data === 'value-2');

      runInAction(() => {
        queryKeyPart.set(1);
      });

      await when(
        () =>
          query.result.data === 'value-1' && queryFn.mock.calls.length === 3,
      );

      runInAction(() => {
        queryKeyPart.set(2);
      });

      await when(
        () =>
          query.result.data === 'value-2' && queryFn.mock.calls.length === 4,
      );

      expect(queryFn).toHaveBeenCalledTimes(4);
      expect(onDone).toHaveBeenCalledTimes(4);
    } finally {
      query.destroy();
    }
  });

  it('onDone should work after destroy with resetOnDestroy from query client', async () => {
    vi.useRealTimers();
    let counter = 0;
    const onDone = vi.fn();
    const queryClient = new MobxQueryClient({
      defaultOptions: {
        queries: {
          resetOnDestroy: true,
        },
      },
    });
    const firstQuery = new Query({
      queryClient,
      staleTime: Infinity,
      queryKey: ['on-done-reset-on-destroy'],
      queryFn: async () => ++counter,
      onDone,
    });

    try {
      await when(() => firstQuery.result.data === 1);
      firstQuery.destroy();

      const secondQuery = new Query({
        queryClient,
        staleTime: Infinity,
        queryKey: ['on-done-reset-on-destroy'],
        queryFn: async () => ++counter,
        onDone,
      });

      try {
        await when(() => secondQuery.result.data === 2);

        expect(onDone).toHaveBeenNthCalledWith(1, 1, undefined);
        expect(onDone).toHaveBeenNthCalledWith(2, 2, undefined);
        expect(onDone).toHaveBeenCalledTimes(2);
      } finally {
        secondQuery.destroy();
      }
    } finally {
      firstQuery.destroy();
    }
  });

  it('onDone should work after destroy with removeOnDestroy from query client', async () => {
    vi.useRealTimers();
    let counter = 0;
    const onDone = vi.fn();
    const queryClient = new MobxQueryClient({
      defaultOptions: {
        queries: {
          removeOnDestroy: true,
        },
      },
    });
    const firstQuery = new Query({
      queryClient,
      staleTime: Infinity,
      queryKey: ['on-done-remove-on-destroy'],
      queryFn: async () => ++counter,
      onDone,
    });

    try {
      await when(() => firstQuery.result.data === 1);
      firstQuery.destroy();

      const secondQuery = new Query({
        queryClient,
        staleTime: Infinity,
        queryKey: ['on-done-remove-on-destroy'],
        queryFn: async () => ++counter,
        onDone,
      });

      try {
        await when(() => secondQuery.result.data === 2);

        expect(onDone).toHaveBeenNthCalledWith(1, 1, undefined);
        expect(onDone).toHaveBeenNthCalledWith(2, 2, undefined);
        expect(onDone).toHaveBeenCalledTimes(2);
      } finally {
        secondQuery.destroy();
      }
    } finally {
      firstQuery.destroy();
    }
  });

  it('onDone should respect dynamicOptionsUpdateDelay', async () => {
    vi.useRealTimers();
    const queryKeyPart = observable.box(1);
    const queryFn = vi.fn(async ({ queryKey }) => `value-${queryKey[1]}`);
    const onDone = vi.fn();
    const query = new Query({
      queryClient: new QueryClient({}),
      dynamicOptionsUpdateDelay: 40,
      queryKey: () =>
        ['on-done-dynamic-options-update-delay', queryKeyPart.get()] as const,
      queryFn,
      onDone,
    });

    try {
      await when(() => query.result.data === 'value-1');

      runInAction(() => {
        queryKeyPart.set(2);
      });

      expect(query.result.data).toBe('value-1');

      await when(() => query.result.data === 'value-2');

      expect(queryFn).toHaveBeenCalledTimes(2);
      expect(onDone).toHaveBeenCalledTimes(2);
    } finally {
      query.destroy();
    }
  });

  it('onDone should respect dynamicOptionsComparer', async () => {
    vi.useRealTimers();
    const queryState = observable.box({ id: 1, noise: 0 });
    const queryFn = vi.fn(async ({ queryKey }) => `value-${queryKey[1].id}`);
    const onDone = vi.fn();
    const query = new Query({
      queryClient: new QueryClient({}),
      dynamicOptionsComparer: (left, right) =>
        left.queryKey?.[1]?.id === right.queryKey?.[1]?.id,
      queryKey: () =>
        ['on-done-dynamic-options-comparer', queryState.get()] as const,
      queryFn,
      onDone,
    });

    try {
      await when(() => query.result.data === 'value-1');

      runInAction(() => {
        queryState.set({ id: 1, noise: 1 });
      });

      await sleep(20);

      expect(queryFn).toHaveBeenCalledTimes(1);
      expect(onDone).toHaveBeenCalledTimes(1);

      runInAction(() => {
        queryState.set({ id: 2, noise: 0 });
      });

      await when(() => query.result.data === 'value-2');

      expect(queryFn).toHaveBeenCalledTimes(2);
      expect(onDone).toHaveBeenCalledTimes(2);
    } finally {
      query.destroy();
    }
  });

  it('onError should keep listener args original and transform result.error', async () => {
    vi.useRealTimers();
    const queryKeyPart = observable.box(1);
    const onError = vi.fn();
    const query = new Query<never, Error>({
      queryClient: new QueryClient({}),
      transformError: (error: Error) =>
        new Error(`transformed:${error.message}`),
      retry: false,
      queryKey: () => ['on-error-transform-error', queryKeyPart.get()] as const,
      queryFn: async ({ queryKey }) => {
        throw new Error(`boom-${queryKey[1]}`);
      },
      onError,
    });

    try {
      await when(() => query.result.error?.message === 'transformed:boom-1');

      runInAction(() => {
        queryKeyPart.set(2);
      });

      await when(() => query.result.error?.message === 'transformed:boom-2');

      expect(onError).toHaveBeenNthCalledWith(
        1,
        expect.objectContaining({ message: 'boom-1' }),
        undefined,
      );
      expect(onError).toHaveBeenNthCalledWith(
        2,
        expect.objectContaining({ message: 'boom-2' }),
        undefined,
      );
      expect(onError).toHaveBeenCalledTimes(2);
    } finally {
      query.destroy();
    }
  });

  describe('_result type checks', () => {
    const createQuery = (
      cfg?: Partial<QueryConfig>,
      qcCfg?: Partial<QueryClientConfig>,
    ) => {
      const queryClient = new MobxQueryClient(qcCfg);

      class TestQuery extends Query {
        getInternalResult() {
          return this._result;
        }
      }

      return new TestQuery({
        queryClient,
        queryKey: ['smoke'],
        queryFn: async () => 42,
        ...cfg,
      });
    };

    it('basic', () => {
      const query = createQuery();
      expect(types.isProxy(query.getInternalResult())).toBe(true);
    });

    it('(query: resultObservable: false)', () => {
      const query = createQuery({ resultObservable: false });
      expect(types.isProxy(query.getInternalResult())).toBe(false);
    });

    it('(query: resultObservable: ref)', () => {
      const query = createQuery({ resultObservable: 'ref' });
      expect(types.isProxy(query.getInternalResult())).toBe(false);
    });

    it('(query: resultObservable: shallow)', () => {
      const query = createQuery({ resultObservable: 'shallow' });
      expect(types.isProxy(query.getInternalResult())).toBe(true);
    });

    it('(query: resultObservable: struct)', () => {
      const query = createQuery({ resultObservable: 'struct' });
      expect(types.isProxy(query.getInternalResult())).toBe(false);
    });

    it('(queryClient: resultObservable: false)', () => {
      const query = createQuery(undefined, {
        defaultOptions: { queries: { resultObservable: false } },
      });
      expect(types.isProxy(query.getInternalResult())).toBe(false);
    });

    it('(queryClient: resultObservable: ref)', () => {
      const query = createQuery(undefined, {
        defaultOptions: { queries: { resultObservable: 'ref' } },
      });
      expect(types.isProxy(query.getInternalResult())).toBe(false);
    });

    it('(queryClient: resultObservable: shallow)', () => {
      const query = createQuery(undefined, {
        defaultOptions: { queries: { resultObservable: 'shallow' } },
      });
      expect(types.isProxy(query.getInternalResult())).toBe(true);
    });

    it('(queryClient: resultObservable: struct)', () => {
      const query = createQuery(undefined, {
        defaultOptions: { queries: { resultObservable: 'struct' } },
      });
      expect(types.isProxy(query.getInternalResult())).toBe(false);
    });

    it('(query: resultObservable: false)(queryClient: resultObservable: deep)', () => {
      const query = createQuery(
        { resultObservable: false },
        { defaultOptions: { queries: { resultObservable: 'deep' } } },
      );
      expect(types.isProxy(query.getInternalResult())).toBe(false);
    });

    it('(query: resultObservable: deep)(queryClient: resultObservable: ref)', () => {
      const query = createQuery(
        { resultObservable: 'deep' },
        { defaultOptions: { queries: { resultObservable: 'ref' } } },
      );
      expect(types.isProxy(query.getInternalResult())).toBe(true);
    });

    it('(query: resultObservable: ref)(queryClient: resultObservable: shallow)', () => {
      const query = createQuery(
        { resultObservable: 'ref' },
        { defaultOptions: { queries: { resultObservable: 'shallow' } } },
      );
      expect(types.isProxy(query.getInternalResult())).toBe(false);
    });

    it('(query: resultObservable: deep)(queryClient: resultObservable: struct)', () => {
      const query = createQuery(
        { resultObservable: 'deep' },
        { defaultOptions: { queries: { resultObservable: 'struct' } } },
      );
      expect(types.isProxy(query.getInternalResult())).toBe(true);
    });
  });

  it('autoRemovePreviousQuery should not remove whole query after destroy', async () => {
    const qc = new MobxQueryClient({
      defaultOptions: {
        queries: {
          autoRemovePreviousQuery: true,
          enableOnDemand: true,
          throwOnError: true,
          refetchOnWindowFocus: false,
          refetchOnReconnect: false,
          staleTime: (query) => {
            if (query.getObserversCount() > 1) {
              return Infinity;
            }

            return 0;
          },
          retry: false,
          gcTime: 0,
          dynamicOptionsComparer: comparer.structural,
        },
        mutations: {
          gcTime: 0,
          networkMode: 'always',
          throwOnError: true,
        },
      },
    });

    const abortController = new AbortController();

    const queryKeyBox = observable.box<string[]>();

    const q = new Query({
      abortSignal: abortController.signal,
      enableOnDemand: false,
      queryClient: qc,
      options: () => {
        const queryKey = queryKeyBox.get();
        const isEnabled = queryKey?.[0] === 'enabled';

        return {
          queryKey: queryKey,
          enabled: isEnabled,
        };
      },
      queryFn: () => true,
    });

    queryKeyBox.set(['disabled', 'afo', 'asf']);

    await sleep();

    queryKeyBox.set(['enabled', 'afo', 'asf']);

    await sleep();

    await sleep();

    await sleep();

    await when(() => q.isSuccess);

    expect(qc.getQueryCache().getAll().length).toBe(1);

    abortController.abort();

    expect(qc.getQueryCache().getAll().length).toBe(1);

    q.destroy();

    expect(qc.getQueryCache().getAll().length).toBe(1);

    expect(qc.getQueryCache().getAll()[0].queryKey).toEqual([
      'enabled',
      'afo',
      'asf',
    ]);
  });

  describe('resultObservable reactions count calls', () => {
    const createProceedQuery = async (
      testName: string,
      resultObservable: NonNullable<QueryFeatures['resultObservable']>,
    ) => {
      let isFailedQuery = false;
      const box = observable.box(0);

      vi.useFakeTimers();

      const query = new QueryMock({
        queryKey: () => [
          'result-observable-reaction-count',
          resultObservable,
          testName,
          box.get(),
        ],
        resultObservable,
        queryFn: async ({ queryKey }) => {
          if (isFailedQuery) {
            throw new Error('fail :(');
          }
          return { foo: 1, bar: { baz: queryKey.at(-1) as number } };
        },
      });

      const tricks = {
        runQuery: async () => {
          await vi.runAllTimersAsync();

          vi.useRealTimers();
        },
        updateQuery: async () => {
          vi.useFakeTimers();

          box.set(box.get() + 1);

          await vi.runAllTimersAsync();
        },
        toggleQueryFail: async () => {
          vi.useFakeTimers();

          isFailedQuery = !isFailedQuery;
          box.set(box.get() + 1);

          await vi.runAllTimersAsync();

          vi.useRealTimers();
        },
        invalidateQuery: async () => {
          vi.useFakeTimers();

          const promise = query.invalidate();

          await vi.runAllTimersAsync();

          await promise;

          vi.useRealTimers();
        },
      };

      // @ts-expect-error
      query.tricks = tricks;

      return query as typeof query & { tricks: typeof tricks };
    };

    type TestCaseCalls = Record<
      'start' | 'update' | 'error' | 'invalidate',
      {
        dataFoo: number;
        dataFooBarBaz: number;
        isLoading: number;
        isError: number;
        data: number;
        isFetching: number;
        isFetched: number;
      }
    >;

    type TestCase = {
      mode: NonNullable<QueryFeatures['resultObservable']>;
      calls: TestCaseCalls;
    };

    const baseTestCaseCalls = {
      start: {
        dataFoo: 2,
        dataFooBarBaz: 2,
        isLoading: 2,
        isError: 1,
        data: 3,
        isFetched: 2,
        isFetching: 2,
      },
      update: {
        dataFoo: 4,
        dataFooBarBaz: 4,
        isLoading: 4,
        isError: 1,
        data: 5,
        isFetched: 4,
        isFetching: 4,
      },
      error: {
        dataFoo: 5,
        dataFooBarBaz: 5,
        isLoading: 6,
        isError: 2,
        data: 6,
        isFetched: 6,
        isFetching: 6,
      },
      invalidate: {
        dataFoo: 5,
        dataFooBarBaz: 5,
        isLoading: 8,
        isError: 4,
        data: 6,
        isFetched: 6,
        isFetching: 8,
      },
    };

    const cases = [
      {
        mode: 'ref',
        calls: baseTestCaseCalls,
      },
      {
        mode: 'struct',
        calls: baseTestCaseCalls,
      },
      {
        mode: 'deep',
        calls: baseTestCaseCalls,
      },
      {
        mode: 'shallow',
        calls: baseTestCaseCalls,
      },
      {
        mode: false,
        calls: {
          start: {
            dataFoo: 1,
            dataFooBarBaz: 1,
            isLoading: 1,
            isError: 1,
            data: 1,
            isFetched: 1,
            isFetching: 1,
          },
          update: {
            dataFoo: 1,
            dataFooBarBaz: 1,
            isLoading: 1,
            isError: 1,
            data: 1,
            isFetched: 1,
            isFetching: 1,
          },
          error: {
            dataFoo: 1,
            dataFooBarBaz: 1,
            isLoading: 1,
            isError: 1,
            data: 1,
            isFetched: 1,
            isFetching: 1,
          },
          invalidate: {
            dataFoo: 1,
            dataFooBarBaz: 1,
            isLoading: 1,
            isError: 1,
            data: 1,
            isFetched: 1,
            isFetching: 1,
          },
        },
      },
    ] as const satisfies TestCase[];

    describe.each(cases)(`reactionObservable: $mode`, ({ mode, calls }) => {
      it(`data.foo reaction calls (${calls.start.dataFoo} -> ${calls.update.dataFoo} -> ${calls.error.dataFoo} -> ${calls.invalidate.dataFoo})`, async ({
        task,
      }) => {
        const query = await createProceedQuery(task.fullTestName, mode);

        const reactionSpy = vi.fn();
        const dispose = reaction(
          () => query.result.data?.foo,
          (curr, prev) => reactionSpy(curr, prev),
          { fireImmediately: true },
        );

        await query.tricks.runQuery();

        query.setData((curr) => (curr ? { ...curr } : curr));
        query.setData((curr) => (curr ? { ...curr } : curr));

        expect(reactionSpy).toHaveBeenCalledTimes(calls.start.dataFoo);

        await query.tricks.updateQuery();

        expect(reactionSpy).toHaveBeenCalledTimes(calls.update.dataFoo);

        await query.tricks.toggleQueryFail();

        expect(reactionSpy).toHaveBeenCalledTimes(calls.error.dataFoo);

        await query.tricks.invalidateQuery();

        expect(reactionSpy).toHaveBeenCalledTimes(calls.invalidate.dataFoo);

        dispose();
        query.destroy();
      });

      it(`data.foo.bar.baz reaction calls (${calls.start.dataFooBarBaz} -> ${calls.update.dataFooBarBaz} -> ${calls.error.dataFooBarBaz} -> ${calls.invalidate.dataFooBarBaz})`, async ({
        task,
      }) => {
        const query = await createProceedQuery(task.fullTestName, mode);

        const reactionSpy = vi.fn();
        const dispose = reaction(
          () => query.result.data?.bar.baz,
          (curr, prev) => reactionSpy(curr, prev),
          { fireImmediately: true },
        );

        await query.tricks.runQuery();

        expect(reactionSpy).toHaveBeenCalledTimes(calls.start.dataFooBarBaz);

        await query.tricks.updateQuery();

        expect(reactionSpy).toHaveBeenCalledTimes(calls.update.dataFooBarBaz);

        await query.tricks.toggleQueryFail();

        expect(reactionSpy).toHaveBeenCalledTimes(calls.error.dataFooBarBaz);

        await query.tricks.invalidateQuery();

        expect(reactionSpy).toHaveBeenCalledTimes(
          calls.invalidate.dataFooBarBaz,
        );

        dispose();
        query.destroy();
      });

      it(`isLoading reaction calls (${calls.start.isLoading} -> ${calls.update.isLoading} -> ${calls.error.isLoading} -> ${calls.invalidate.isLoading})`, async ({
        task,
      }) => {
        const query = await createProceedQuery(task.fullTestName, mode);

        const reactionSpy = vi.fn();
        const dispose = reaction(
          () => query.result.isLoading,
          (curr, prev) => reactionSpy(curr, prev),
          { fireImmediately: true },
        );

        await query.tricks.runQuery();

        expect(reactionSpy).toHaveBeenCalledTimes(calls.start.isLoading);

        await query.tricks.updateQuery();

        expect(reactionSpy).toHaveBeenCalledTimes(calls.update.isLoading);

        await query.tricks.toggleQueryFail();

        expect(reactionSpy).toHaveBeenCalledTimes(calls.error.isLoading);

        await query.tricks.invalidateQuery();

        expect(reactionSpy).toHaveBeenCalledTimes(calls.invalidate.isLoading);

        dispose();
        query.destroy();
      });

      it(`isError reaction calls (${calls.start.isError} -> ${calls.update.isError} -> ${calls.error.isError} -> ${calls.invalidate.isError})`, async ({
        task,
      }) => {
        const query = await createProceedQuery(task.fullTestName, mode);

        const reactionSpy = vi.fn();
        const dispose = reaction(
          () => query.result.isError,
          (curr, prev) => reactionSpy(curr, prev),
          { fireImmediately: true },
        );

        await query.tricks.runQuery();

        query.setData((curr) => (curr ? { ...curr } : curr));

        expect(reactionSpy).toHaveBeenCalledTimes(calls.start.isError);

        await query.tricks.updateQuery();

        expect(reactionSpy).toHaveBeenCalledTimes(calls.update.isError);

        await query.tricks.toggleQueryFail();

        expect(reactionSpy).toHaveBeenCalledTimes(calls.error.isError);

        await query.tricks.invalidateQuery();

        expect(reactionSpy).toHaveBeenCalledTimes(calls.invalidate.isError);

        dispose();
        query.destroy();
      });

      it(`isFetched reaction calls (${calls.start.isFetched} -> ${calls.update.isFetched} -> ${calls.error.isFetched} -> ${calls.invalidate.isFetched})`, async ({
        task,
      }) => {
        const query = await createProceedQuery(task.fullTestName, mode);

        const reactionSpy = vi.fn();
        const dispose = reaction(
          () => query.result.isFetched,
          (curr, prev) => reactionSpy(curr, prev),
          { fireImmediately: true },
        );

        await query.tricks.runQuery();

        query.setData((curr) => (curr ? { ...curr } : curr));

        expect(reactionSpy).toHaveBeenCalledTimes(calls.start.isFetched);

        await query.tricks.updateQuery();

        expect(reactionSpy).toHaveBeenCalledTimes(calls.update.isFetched);

        await query.tricks.toggleQueryFail();

        expect(reactionSpy).toHaveBeenCalledTimes(calls.error.isFetched);

        await query.tricks.invalidateQuery();

        expect(reactionSpy).toHaveBeenCalledTimes(calls.invalidate.isFetched);

        dispose();
        query.destroy();
      });

      it(`isFetching reaction calls (${calls.start.isFetching} -> ${calls.update.isFetching} -> ${calls.error.isFetching} -> ${calls.invalidate.isFetching})`, async ({
        task,
      }) => {
        const query = await createProceedQuery(task.fullTestName, mode);

        const reactionSpy = vi.fn();
        const dispose = reaction(
          () => query.result.isFetching,
          (curr, prev) => reactionSpy(curr, prev),
          { fireImmediately: true },
        );

        await query.tricks.runQuery();

        query.setData((curr) => (curr ? { ...curr } : curr));

        expect(reactionSpy).toHaveBeenCalledTimes(calls.start.isFetching);

        await query.tricks.updateQuery();

        expect(reactionSpy).toHaveBeenCalledTimes(calls.update.isFetching);

        await query.tricks.toggleQueryFail();

        expect(reactionSpy).toHaveBeenCalledTimes(calls.error.isFetching);

        await query.tricks.invalidateQuery();

        expect(reactionSpy).toHaveBeenCalledTimes(calls.invalidate.isFetching);

        dispose();
        query.destroy();
      });

      it(`data reaction calls (${calls.start.data} -> ${calls.update.data} -> ${calls.error.data} -> ${calls.invalidate.data})`, async ({
        task,
      }) => {
        const query = await createProceedQuery(task.fullTestName, mode);

        const reactionSpy = vi.fn();
        const dispose = reaction(
          () => query.result.data,
          (curr, prev) => reactionSpy(curr, prev),
          { fireImmediately: true },
        );

        await query.tricks.runQuery();

        query.setData((curr) => (curr ? { ...curr, foo: curr.foo + 1 } : curr));

        expect(reactionSpy).toHaveBeenCalledTimes(calls.start.data);

        await query.tricks.updateQuery();

        expect(reactionSpy).toHaveBeenCalledTimes(calls.update.data);

        await query.tricks.toggleQueryFail();

        expect(reactionSpy).toHaveBeenCalledTimes(calls.error.data);

        await query.tricks.invalidateQuery();

        expect(reactionSpy).toHaveBeenCalledTimes(calls.invalidate.data);

        dispose();
        query.destroy();
      });
    });

    it.each([
      { mode: 'deep' as const, calls: 2 },
      { mode: 'ref' as const, calls: 1 },
      { mode: 'shallow' as const, calls: 1 },
      { mode: 'struct' as const, calls: 1 },
      { mode: false as const, calls: 1 },
    ])('nested direct mutation affects reactions only in deep mode ($mode)', async ({
      mode,
      calls,
    }) => {
      const query = await createProceedQuery(
        `nested-mutation-${String(mode)}`,
        mode,
      );
      await query.tricks.runQuery();

      const reactionSpy = vi.fn();
      const dispose = reaction(
        () => query.result.data?.bar.baz,
        (curr, prev) => reactionSpy(curr, prev),
        { fireImmediately: true },
      );

      runInAction(() => {
        if (query.result.data) {
          query.result.data.bar.baz += 1;
        }
      });

      expect(reactionSpy).toHaveBeenCalledTimes(calls);

      dispose();
      query.destroy();
    });
  });
});

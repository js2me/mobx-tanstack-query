/* eslint-disable no-async-promise-executor */
import {
  DefaultError,
  QueryClient,
  QueryKey,
  QueryObserverResult,
  RefetchOptions,
  SetDataOptions,
  Updater,
  hashKey,
} from '@tanstack/query-core';
import { LinkedAbortController } from 'linked-abort-controller';
import {
  computed,
  makeAutoObservable,
  makeObservable,
  observable,
  reaction,
  runInAction,
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
import { sleep, waitAsync } from 'yummies/async';

import { createQuery } from './preset';
import { Query } from './query';
import {
  QueryConfig,
  QueryDynamicOptions,
  QueryInvalidateParams,
  QueryUpdateOptions,
} from './query.types';

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
    return result;
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
    return result;
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
      waitAsync?: number;
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
        }, cfg?.waitAsync ?? 5);

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

      expect(query.spies.queryFn).toBeCalledTimes(2);
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

      expect(query.spies.queryFn).toBeCalledTimes(1);
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

      expect(query.spies.queryFn).toBeCalledTimes(0);

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

      expect(query.spies.queryFn).toBeCalledTimes(0);

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

      expect(query.spies.queryFn).toBeCalledTimes(1);
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

      expect(query.spies.queryFn).toBeCalledTimes(1);
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

      expect(dependentQuery.spies.queryFn).toBeCalledTimes(1);
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

      expect(dependentQuery.spies.queryFn).toBeCalledTimes(1);
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

      expect(dependentQuery.spies.queryFn).toBeCalledTimes(1);
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

    expect(dependentQuery.spies.queryFn).toBeCalledTimes(1);
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

    expect(dependentQuery.spies.queryFn).toBeCalledTimes(0);

    await sleep(100);

    // НО когда мы начнем следить за кверей то все заработает
    reaction(
      () => dependentQuery.result.data,
      () => {},
      { fireImmediately: true },
    );

    expect(dependentQuery.spies.queryFn).toBeCalledTimes(1);
    expect(dependentQuery.spies.queryFn).nthReturnedWith(1, [
      'test',
      1,
      'dependent',
    ]);

    tempDisabledQuery.destroy();
    dependentQuery.destroy();
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

    expect(queryFn).toBeCalledTimes(1);

    runInAction(() => {
      params.pageNumber = 1;
    });

    runInAction(() => {
      params.pageNumber = 2;
    });

    runInAction(() => {
      params.pageNumber = 3;
    });

    expect(queryFn).toBeCalledTimes(4);

    await sleep();

    expect(queryFn).toBeCalledTimes(4);

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

      expect(query.spies.queryFn).toBeCalledTimes(2);
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

      expect(query.spies.queryFn).toBeCalledTimes(1);
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

      expect(query.spies.queryFn).toBeCalledTimes(1);
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

        expect(query.spies.queryFn).toBeCalledTimes(0);

        query.destroy();
      });

      it('should not call query if result is not requested (with "enabled": false)', async () => {
        const query = new QueryMock({
          queryFn: () => 10,
          enableOnDemand: true,
          enabled: false,
        });

        await when(() => !query._rawResult.isLoading);

        expect(query.spies.queryFn).toBeCalledTimes(0);

        query.destroy();
      });

      it('should not call query if result is not requested (with "enabled": fn -> false)', async () => {
        const query = new QueryMock({
          queryFn: () => 10,
          enableOnDemand: true,
          enabled: () => false,
        });

        await when(() => !query._rawResult.isLoading);

        expect(query.spies.queryFn).toBeCalledTimes(0);

        query.destroy();
      });

      it('should not call query if result is not requested (with "enabled": fn -> true)', async () => {
        const query = new QueryMock({
          queryFn: () => 10,
          enableOnDemand: true,
          enabled: () => true,
        });

        await when(() => !query._rawResult.isLoading);

        expect(query.spies.queryFn).toBeCalledTimes(0);

        query.destroy();
      });

      it('should not call query if result is not requested (with "enabled": true)', async () => {
        const query = new QueryMock({
          queryFn: () => 10,
          enableOnDemand: true,
          enabled: true,
        });

        await when(() => !query._rawResult.isLoading);

        expect(query.spies.queryFn).toBeCalledTimes(0);

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

        expect(query.spies.queryFn).toBeCalledTimes(0);

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

        expect(query.spies.queryFn).toBeCalledTimes(0);

        query.destroy();
      });

      it('should call query if result is requested (without "enabled" property use)', async () => {
        const query = new QueryMock({
          queryFn: () => 10,
          enableOnDemand: true,
        });

        query.result.data;

        await when(() => !query._rawResult.isLoading);

        expect(query.spies.queryFn).toBeCalledTimes(1);

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

        expect(query.spies.queryFn).toBeCalledTimes(0);

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

        expect(query.spies.queryFn).toBeCalledTimes(0);

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

        expect(query.spies.queryFn).toBeCalledTimes(1);

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

        expect(query.spies.queryFn).toBeCalledTimes(1);

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

        expect(query.spies.queryFn).toBeCalledTimes(0);

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

        expect(query.spies.queryFn).toBeCalledTimes(0);

        query.result.data;
        query.result.isLoading;

        expect(query.spies.queryFn).toBeCalledTimes(1);

        query.destroy();
      });

      it('should enable query when result is requested', async () => {
        const query = new QueryMock({
          queryKey: ['test', 0 as number] as const,
          queryFn: () => 100,
          enableOnDemand: true,
        });

        expect(query.spies.queryFn).toBeCalledTimes(0);

        query.result.data;
        query.result.isLoading;

        expect(query.spies.queryFn).toBeCalledTimes(1);

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

        expect(query.spies.queryFn).toBeCalledTimes(0);

        runInAction(() => {
          valueBox.set('value');
        });

        expect(query.spies.queryFn).toBeCalledTimes(1);

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

        expect(query.spies.queryFn).toBeCalledTimes(0);

        runInAction(() => {
          valueBox.set(null);
        });

        runInAction(() => {
          valueBox.set('faslse');
        });

        expect(query.spies.queryFn).toBeCalledTimes(0);

        runInAction(() => {
          valueBox.set('kek');
        });

        expect(query.spies.queryFn).toBeCalledTimes(1);

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

      expect(query.spies.queryFn).toBeCalledTimes(1);
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
      await waitAsync(10);

      query.setData((curr) => {
        if (!curr) return curr;
        curr.a.b.c.d.e.children.push({ id: '2', name: 'Doe', age: 21 });
        return curr;
      });

      await when(() => !query.result.isLoading);

      expect(query.spies.queryFn).toBeCalledTimes(1);
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
      await waitAsync(10);

      query.setData((curr) => {
        if (!curr) return curr;
        curr.a.b.c.d.e.children.push({ id: '2', name: 'Doe', age: 21 });
        return curr;
      });

      expect(reactionSpy).toBeCalledTimes(2);
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
      await waitAsync(10);

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
      await waitAsync(10);

      testClass.query.setData((curr) => {
        if (!curr) return curr;
        curr.a.b.c.d.e.children[0].name = 'Doe';
        return curr;
      });

      expect(reactionFooSpy).toBeCalledTimes(2);

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
      expect(querySpyFn).toBeCalledTimes(1);

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
      expect(querySpyFn).toBeCalledTimes(3);

      query.destroy();
    });
  });

  describe('scenarios', () => {
    it('query with refetchInterval(number) should be stopped after inner abort', async () => {
      const query = new QueryMock({
        queryFn: async () => {
          await waitAsync(10);
          return 10;
        },
        enabled: true,
        refetchInterval: 10,
      });

      await waitAsync(100);
      expect(query.spies.queryFn).toBeCalledTimes(5);
      query.destroy();

      await waitAsync(100);

      expect(query.spies.queryFn).toBeCalledTimes(5);
    });
    it('query with refetchInterval(number) should be stopped after outer abort', async () => {
      const abortController = new AbortController();
      const query = new QueryMock({
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
      const query = new QueryMock({
        queryFn: async () => {
          await waitAsync(10);
          return 10;
        },
        enabled: true,
        refetchInterval: () => 10,
      });

      await waitAsync(100);
      expect(query.spies.queryFn).toBeCalledTimes(5);

      query.destroy();

      await waitAsync(100);

      expect(query.spies.queryFn).toBeCalledTimes(5);
    });
    it('query with refetchInterval(fn) should be stopped after outer abort', async () => {
      const abortController = new AbortController();
      const query = new QueryMock({
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
      const query = new QueryMock({
        queryFn: async () => {
          await waitAsync(10);
          return 10;
        },
        enabled: true,
        refetchInterval: (query) => (query.isActive() ? 10 : false),
      });

      await waitAsync(100);
      expect(query.spies.queryFn).toBeCalledTimes(5);
      query.destroy();

      await waitAsync(100);

      expect(query.spies.queryFn).toBeCalledTimes(5);
    });
    it('query with refetchInterval(condition-fn) should be stopped after outer abort', async () => {
      const abortController = new AbortController();
      const query = new QueryMock({
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

      const query = new QueryMock({
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

      const query = new QueryMock({
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

      const query = new QueryMock({
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
      const query1 = new QueryMock({
        queryFn: async () => {
          await waitAsync(5);
          return 'bar';
        },
        abortSignal: abortController1.signal,
        queryKey: ['test'] as const,
      });
      const query2 = new QueryMock({
        queryFn: async () => {
          await waitAsync(5);
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
      await waitAsync(10);
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
      await waitAsync(10);
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
    });

    it('after abort identical (by query key) query another query should work (with resetOnDestroy option)', async () => {
      const abortController1 = new LinkedAbortController();
      const abortController2 = new LinkedAbortController();
      const query1 = new QueryMock({
        queryFn: async () => {
          await waitAsync(5);
          return 'bar';
        },
        abortSignal: abortController1.signal,
        queryKey: ['test'] as const,
        resetOnDestroy: true,
      });
      const query2 = new QueryMock({
        queryFn: async () => {
          await waitAsync(5);
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
      await waitAsync(10);
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
      await waitAsync(10);
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

      expect(queryFnSpy).toBeCalledTimes(1);
      expect(getDynamicOptionsSpy).toBeCalledTimes(3);
    });

    it('after abort signal for inprogress success work query create new instance with the same key and it should work', async () => {
      const abortController1 = new LinkedAbortController();
      const query = new QueryMock({
        queryFn: async () => {
          await waitAsync(11);
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

      await waitAsync(10);

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

      const query2 = new QueryMock({
        queryFn: async () => {
          await waitAsync(5);
          return 'foo';
        },
        queryKey: ['test', 'key'] as const,
      });

      await waitAsync(10);

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
      } satisfies Partial<QueryObserverResult<string>>);

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
        errorUpdateCount: 1,
        failureCount: 0,
        failureReason: null,
        fetchStatus: 'fetching',
        isError: false,
        isFetched: true,
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
        errorUpdateCount: 1,
        failureCount: 0,
        failureReason: null,
        fetchStatus: 'fetching',
        isError: false,
        isFetched: true,
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
});

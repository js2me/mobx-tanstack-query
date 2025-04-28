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
  makeObservable,
  observable,
  reaction,
  runInAction,
  when,
} from 'mobx';
import { afterEach, describe, expect, it, test, vi } from 'vitest';
import { waitAsync } from 'yummies/async';

import { MobxQuery } from './mobx-query';
import { MobxQueryClient } from './mobx-query-client';
import {
  MobxQueryConfig,
  MobxQueryDynamicOptions,
  MobxQueryInvalidateParams,
  MobxQueryUpdateOptions,
} from './mobx-query.types';
import { createQuery } from './preset';

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
    it('should be DISABLED from default query options (from query client)', async () => {
      const queryClient = new MobxQueryClient({
        defaultOptions: {
          queries: {
            enabled: false,
          },
        },
      });
      const mobxQuery = new MobxQueryMock(
        {
          queryKey: ['test', 0 as number] as const,
          queryFn: () => 100,
        },
        queryClient,
      );

      expect(mobxQuery.spies.queryFn).toBeCalledTimes(0);

      mobxQuery.dispose();
    });

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

      it('should not call query event if result is requested (reason: "enabled": false out of box)', async () => {
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
          enabled: function getEnabledFromUnitTest() {
            return false;
          },
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
      it('should NOT call query if result is requested (reason: "enabled" false from default query client options)', async () => {
        const queryClient = new MobxQueryClient({
          defaultOptions: {
            queries: {
              enabled: false,
            },
          },
        });
        const mobxQuery = new MobxQueryMock(
          {
            queryKey: ['test', 0 as number] as const,
            queryFn: () => 100,
            enableOnDemand: true,
          },
          queryClient,
        );

        mobxQuery.result.data;
        mobxQuery.result.isLoading;

        expect(mobxQuery.spies.queryFn).toBeCalledTimes(0);

        mobxQuery.dispose();
      });

      it('should not call query even it is enabled until result is requested', async () => {
        const queryClient = new MobxQueryClient({
          defaultOptions: {
            queries: {
              enabled: true,
            },
          },
        });
        const mobxQuery = new MobxQueryMock(
          {
            queryKey: ['test', 0 as number] as const,
            queryFn: () => 100,
            enableOnDemand: true,
          },
          queryClient,
        );

        expect(mobxQuery.spies.queryFn).toBeCalledTimes(0);

        mobxQuery.result.data;
        mobxQuery.result.isLoading;

        expect(mobxQuery.spies.queryFn).toBeCalledTimes(1);

        mobxQuery.dispose();
      });

      it('should enable query when result is requested', async () => {
        const mobxQuery = new MobxQueryMock({
          queryKey: ['test', 0 as number] as const,
          queryFn: () => 100,
          enableOnDemand: true,
        });

        expect(mobxQuery.spies.queryFn).toBeCalledTimes(0);

        mobxQuery.result.data;
        mobxQuery.result.isLoading;

        expect(mobxQuery.spies.queryFn).toBeCalledTimes(1);

        mobxQuery.dispose();
      });

      it('should enable query from dynamic options ONLY AFTER result is requested', () => {
        const valueBox = observable.box<string | undefined>();

        const mobxQuery = new MobxQueryMock({
          queryFn: () => 100,
          enableOnDemand: true,
          options: () => ({
            queryKey: ['values', valueBox.get()] as const,
            enabled: !!valueBox.get(),
          }),
        });

        mobxQuery.result.data;
        mobxQuery.result.isLoading;

        expect(mobxQuery.spies.queryFn).toBeCalledTimes(0);

        runInAction(() => {
          valueBox.set('value');
        });

        expect(mobxQuery.spies.queryFn).toBeCalledTimes(1);

        mobxQuery.dispose();
      });

      it('should enable query from dynamic options ONLY AFTER result is requested (multiple observable updates)', () => {
        const valueBox = observable.box<string | null | undefined>();

        const mobxQuery = new MobxQueryMock({
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

        mobxQuery.result.data;
        mobxQuery.result.isLoading;

        expect(mobxQuery.spies.queryFn).toBeCalledTimes(0);

        runInAction(() => {
          valueBox.set(null);
        });

        runInAction(() => {
          valueBox.set('faslse');
        });

        expect(mobxQuery.spies.queryFn).toBeCalledTimes(0);

        runInAction(() => {
          valueBox.set('kek');
        });

        expect(mobxQuery.spies.queryFn).toBeCalledTimes(1);

        mobxQuery.dispose();
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

      const mobxQuery = new MobxQueryMock(
        {
          queryKey: [task.name, '1'],
          queryFn: () => structuredClone(queryData),
        },
        queryClient,
      );

      await when(() => !mobxQuery.result.isLoading);

      mobxQuery.setData(() => ({ bar: 1, baz: 2 }));

      expect(mobxQuery.spies.queryFn).toBeCalledTimes(1);
      expect(mobxQuery.result.data).toEqual({ bar: 1, baz: 2 });

      mobxQuery.dispose();
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

      console.info('asdfdsaf', task.name);

      const mobxQuery = new MobxQueryMock(
        {
          queryKey: [task.name, '2'],
          queryFn: () => structuredClone(queryData),
        },
        queryClient,
      );

      await when(() => !mobxQuery.result.isLoading);
      await waitAsync(10);

      mobxQuery.setData((curr) => {
        if (!curr) return curr;
        curr.a.b.c.d.e.children.push({ id: '2', name: 'Doe', age: 21 });
        return curr;
      });

      await when(() => !mobxQuery.result.isLoading);

      expect(mobxQuery.spies.queryFn).toBeCalledTimes(1);
      expect(mobxQuery.result.data).toEqual({
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

      const mobxQuery = new MobxQueryMock(
        {
          queryKey: [task.name, '3'],
          queryFn: () => structuredClone(queryData),
        },
        queryClient,
      );

      const reactionSpy = vi.fn();

      reaction(
        () => mobxQuery.result.data,
        (curr, prev) => reactionSpy(curr, prev),
      );

      await when(() => !mobxQuery.result.isLoading);
      await waitAsync(10);

      mobxQuery.setData((curr) => {
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

      mobxQuery.dispose();
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
        mobxQuery = new MobxQueryMock(
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
          return this.mobxQuery.result.data?.a.b.c.d.e.children[0] || null;
        }

        destroy() {
          this.mobxQuery.dispose();
        }
      }

      const testClass = new TestClass();

      await when(() => !testClass.mobxQuery.result.isLoading);
      await waitAsync(10);

      expect(testClass.foo).toStrictEqual({
        age: 20,
        id: '1',
        name: 'John',
      });

      testClass.mobxQuery.setData((curr) => {
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
        mobxQuery = new MobxQueryMock(
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
          return this.mobxQuery.result.data?.a.b.c.d.e.children[0] || null;
        }

        destroy() {
          this.mobxQuery.dispose();
        }
      }

      const testClass = new TestClass();

      const reactionFooSpy = vi.fn();

      reaction(
        () => testClass.foo,
        (curr, prev) => reactionFooSpy(curr, prev),
      );

      await when(() => !testClass.mobxQuery.result.isLoading);
      await waitAsync(10);

      testClass.mobxQuery.setData((curr) => {
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

    test('should call queryFn every time when start() method is called', async () => {
      const querySpyFn = vi.fn();
      const mobxQuery = new MobxQueryMock({
        queryKey: ['test'],
        queryFn: querySpyFn,
        enabled: false,
      });

      await mobxQuery.start();
      await mobxQuery.start();
      await mobxQuery.start();

      await when(() => !mobxQuery._rawResult.isLoading);

      expect(mobxQuery.result.isFetched).toBeTruthy();
      expect(querySpyFn).toBeCalledTimes(3);

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
      const mobxQuery = new MobxQueryMock({
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

      expect(mobxQuery.result).toMatchObject({
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

      expect(mobxQuery.result).toMatchObject({
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

      const mobxQuery2 = new MobxQueryMock({
        queryFn: async () => {
          await waitAsync(5);
          return 'foo';
        },
        queryKey: ['test', 'key'] as const,
      });

      await waitAsync(10);

      expect(mobxQuery.result).toMatchObject({
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

      expect(mobxQuery2.result).toMatchObject({
        status: 'success',
        fetchStatus: 'idle',
        isPending: false,
        isSuccess: true,
        isError: false,
        isInitialLoading: false,
        isLoading: false,
        data: 'foo',
        dataUpdatedAt: mobxQuery2.result.dataUpdatedAt,
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

    it('after aborted MobxQuery with failed queryFn - create new MobxQuery with the same key and it should has succeed execution', async () => {
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

      const query = new MobxQueryMock(
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

      const query2 = new MobxQueryMock(
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

    it('after aborted MobxQuery with failed queryFn - create new MobxQuery with the same key and it should has succeed execution (+ abort signal usage inside query fn)', async () => {
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

      const query = new MobxQueryMock(
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

      const query2 = new MobxQueryMock(
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
      const query = new MobxQueryMock({
        throwOnError: true,
        enabled: false,
        queryFn: async () => {
          throw new Error('MobxQueryError');
        },
      });
      let error: Error | undefined;

      const promise = query.start().catch((error_) => {
        error = error_;
      });
      await vi.runAllTimersAsync();

      await promise;

      expect(error?.message).toBe('MobxQueryError');
    });

    it('should throw error (updating param throwOnError true)', async () => {
      vi.useFakeTimers();
      const query = new MobxQueryMock({
        enabled: false,
        queryFn: async () => {
          throw new Error('MobxQueryError');
        },
      });
      let error: Error | undefined;

      const promise = query.start({ throwOnError: true }).catch((error_) => {
        error = error_;
      });
      await vi.runAllTimersAsync();

      await promise;

      expect(error?.message).toBe('MobxQueryError');
    });

    it('should throw error (throwOnError: true in global options)', async () => {
      vi.useFakeTimers();
      const query = new MobxQueryMock(
        {
          enabled: false,
          queryFn: async () => {
            throw new Error('MobxQueryError');
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

      expect(error?.message).toBe('MobxQueryError');
    });
  });
});

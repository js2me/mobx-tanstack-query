import {
  DefaultError,
  QueryClient,
  QueryKey,
  QueryObserverOptions,
  QueryObserverResult,
  RefetchOptions,
  SetDataOptions,
  Updater,
} from '@tanstack/query-core';
import { observable, reaction, runInAction, when } from 'mobx';
import { describe, expect, it, vi } from 'vitest';

import {
  MobxQuery,
  MobxQueryConfig,
  MobxQueryInvalidateParams,
} from './mobx-query';

class MobxQueryMock<
  TData,
  TError = DefaultError,
  TQueryKey extends QueryKey = any,
> extends MobxQuery<TData, TError, TQueryKey> {
  spies = {
    queryFn: vi.fn(),
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
      queryFn: vi.fn(options.queryFn),
    });

    // @ts-ignore
    this.spies.queryFn = this.options.queryFn;

    this.onDone(this.spies.onDone);
    this.onError(this.spies.onError);
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
    options: Partial<
      QueryObserverOptions<TData, TError, TQueryKey, TData, QueryKey, never>
    >,
  ): void {
    this.spies.update(options);
    return super.update(options);
  }

  setData(
    updater: Updater<NoInfer<TData> | undefined, NoInfer<TData> | undefined>,
    options?: SetDataOptions | undefined,
  ): void {
    this.spies.setData(updater, options);
    return super.setData(updater, options);
  }

  dispose(): void {
    this.spies.dispose();
    return super.dispose();
  }
}

describe('MobxQuery', () => {
  it('"result" field to be defined', () => {
    const mobxQuery = new MobxQueryMock({
      queryKey: ['test'],
      queryFn: () => {},
    });
    expect(mobxQuery.result).toBeDefined();
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

    await when(() => mobxQuery.result.isLoading);

    expect(reactionSpy).toBeCalled();
    expect(reactionSpy).toBeCalledWith({ ...mobxQuery.result });

    dispose();
  });

  describe('"queryKey" reactive parameter', () => {
    it('should rerun queryFn after queryKey change', () => {
      const boxCounter = observable.box(0);
      const mobxQuery = new MobxQueryMock({
        queryFn: ({ queryKey }) => {
          return queryKey[1];
        },
        queryKey: () => ['test', boxCounter.get()] as const,
      });

      runInAction(() => {
        boxCounter.set(1);
      });

      expect(mobxQuery.spies.queryFn).toBeCalledTimes(2);
      expect(mobxQuery.spies.queryFn).nthReturnedWith(1, 0);
    });

    it('should rerun queryFn after queryKey change', () => {
      const boxEnabled = observable.box(false);
      const mobxQuery = new MobxQueryMock({
        queryFn: () => 10,
        queryKey: () => ['test', boxEnabled.get()] as const,
        enabled: ({ queryKey }) => queryKey[1],
      });

      runInAction(() => {
        boxEnabled.set(true);
      });

      expect(mobxQuery.spies.queryFn).toBeCalledTimes(1);
      expect(mobxQuery.spies.queryFn).nthReturnedWith(1, 10);
    });
  });

  describe('"enabled" reactive parameter', () => {
    it('should be reactive after change queryKey', () => {
      const mobxQuery = new MobxQueryMock({
        queryKey: ['test', 0] as const,
        enabled: ({ queryKey }) => queryKey[1] > 0,
        queryFn: () => 100,
      });

      mobxQuery.update({ queryKey: ['test', 1] as const });

      expect(mobxQuery.spies.queryFn).toBeCalledTimes(1);
      expect(mobxQuery.spies.queryFn).nthReturnedWith(1, 100);
    });

    it('should be reactive dependent on another query (runs before declartion)', () => {
      const disabledMobxQuery = new MobxQueryMock({
        queryKey: ['test', 0] as const,
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

      expect(dependentMobxQuery.spies.queryFn).toBeCalledTimes(1);
      expect(dependentMobxQuery.spies.queryFn).nthReturnedWith(1, [
        'test',
        1,
        'dependent',
      ]);
    });

    it('should be reactive dependent on another query (runs after declaration)', () => {
      const tempDisabledMobxQuery = new MobxQueryMock({
        queryKey: ['test', 0] as const,
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

      expect(dependentMobxQuery.spies.queryFn).toBeCalledTimes(1);
      // результат с 0 потому что options.enabled у первой квери - это функция и
      // !!tempDisabledMobxQuery.options.enabled будет всегда true
      expect(dependentMobxQuery.spies.queryFn).nthReturnedWith(1, [
        'test',
        0,
        'dependent',
      ]);
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

      expect(mobxQuery.spies.queryFn).toBeCalledTimes(2);
      expect(mobxQuery.spies.queryFn).nthReturnedWith(1, 0);
      expect(mobxQuery.spies.queryFn).nthReturnedWith(2, 10);
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

      expect(mobxQuery.spies.queryFn).toBeCalledTimes(1);
      expect(mobxQuery.spies.queryFn).nthReturnedWith(1, 10);
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

      expect(mobxQuery.spies.queryFn).toBeCalledTimes(1);
      expect(mobxQuery.spies.queryFn).nthReturnedWith(1, true);
    });
  });
});

import {
  type DefaultError,
  QueryClient as QueryClientCore,
} from '@tanstack/query-core';
import { reaction } from 'mobx';
import { describe, expect, expectTypeOf, it, vi } from 'vitest';

import { Mutation } from './mutation.js';
import type {
  MutationConfig,
  MutationFn,
  MutationFunctionContext,
} from './mutation.types.js';

class MutationMock<
  TData = unknown,
  TVariables = void,
  TError = DefaultError,
  TContext = unknown,
> extends Mutation<TData, TVariables, TError, TContext> {
  spies = {
    mutationFn: null as unknown as ReturnType<typeof vi.fn>,
    dispose: vi.fn(),
    reset: vi.fn(),
    onDone: vi.fn(),
    onError: vi.fn(),
  };

  constructor(
    options: Omit<
      MutationConfig<TData, TVariables, TError, TContext>,
      'queryClient'
    >,
  ) {
    const mutationFn: MutationFn<TData, TVariables> = vi.fn(
      (variables: TVariables, context: MutationFunctionContext) => {
        return options.mutationFn!(variables, context);
      },
    );
    super({
      ...options,
      queryClient: new QueryClientCore({}),
      mutationFn,
    });

    this.spies.mutationFn = mutationFn as any;

    this.onDone(this.spies.onDone);
    this.onError(this.spies.onError);
  }

  reset(): void {
    const result = super.reset();
    this.spies.reset.mockReturnValue(result)();
  }

  dispose(): void {
    const result = super.dispose();
    this.spies.dispose.mockReturnValue(result)();
  }
}

describe('Mutation', () => {
  it('should call mutationFn', async () => {
    const mutation = new MutationMock({
      mutationKey: ['test'],
      mutationFn: async () => {},
    });

    await mutation.mutate();

    expect(mutation.spies.mutationFn).toHaveBeenCalled();
  });

  it('should have result with finished data', async () => {
    const mutation = new MutationMock({
      mutationKey: ['test'],
      mutationFn: async () => {
        return 'OK';
      },
    });

    await mutation.mutate();

    expect(mutation.result).toStrictEqual({
      ...mutation.result,
      context: undefined,
      data: 'OK',
      error: null,
      failureCount: 0,
      failureReason: null,
      isError: false,
      isIdle: false,
      isPaused: false,
      isPending: false,
      isSuccess: true,
      status: 'success',
      variables: undefined,
    });
  });

  it('should change mutation status (success)', async () => {
    const mutation = new MutationMock({
      mutationKey: ['test'],
      mutationFn: async () => {
        return 'OK';
      },
    });

    const statuses: (typeof mutation)['result']['status'][] = [];

    reaction(
      () => mutation.result.status,
      (status) => {
        statuses.push(status);
      },
      {
        fireImmediately: true,
      },
    );

    await mutation.mutate();

    expect(statuses).toStrictEqual(['idle', 'pending', 'success']);
  });

  it('should change mutation status (failure)', async () => {
    const mutation = new MutationMock({
      mutationKey: ['test'],
      mutationFn: async () => {
        throw new Error('BAD');
      },
    });

    const statuses: (typeof mutation)['result']['status'][] = [];

    reaction(
      () => mutation.result.status,
      (status) => {
        statuses.push(status);
      },
      {
        fireImmediately: true,
      },
    );

    try {
      await mutation.mutate();
      // eslint-disable-next-line no-empty
    } catch {}

    expect(statuses).toStrictEqual(['idle', 'pending', 'error']);
  });

  it('should throw exception', async () => {
    const mutation = new MutationMock({
      mutationKey: ['test'],
      mutationFn: async () => {
        throw new Error('BAD');
      },
    });

    expect(async () => {
      await mutation.mutate();
    }).rejects.toThrowError('BAD');
  });

  it('should be able to do abort using second argument in mutationFn', async () => {
    vi.useFakeTimers();

    let mutationSignal: AbortSignal | undefined;

    const fakeFetch = (data: any = 'OK', signal?: AbortSignal) => {
      return new Promise((resolve, reject) => {
        setTimeout(() => {
          // eslint-disable-next-line @typescript-eslint/no-use-before-define
          mutation.destroy();
        }, 200);
        const timer = setTimeout(() => resolve(data), 1000);
        signal?.addEventListener('abort', () => {
          clearTimeout(timer);
          reject(signal.reason);
        });
        vi.runAllTimers();
      });
    };

    const mutation = new MutationMock({
      mutationKey: ['test'],
      mutationFn: async (_, { signal }) => {
        mutationSignal = signal;
        await fakeFetch('OK', signal);
      },
    });
    try {
      await mutation.mutate();
      await vi.runAllTimersAsync();
      expect(false).toBe('abort should happen');
    } catch (error) {
      expect(mutationSignal).toBeDefined();
      expect(mutationSignal!.aborted).toBe(true);
      // Same reference as signal.reason from the abort listener — not an unrelated AbortError
      expect(error).toBe(mutationSignal!.reason);
      expect(error).toEqual(expect.objectContaining({ name: 'AbortError' }));
    }

    vi.useRealTimers();
  });

  it('typings query client core test', () => {
    const queryClientCore = new QueryClientCore();

    const testMutation = new Mutation({
      queryClient: queryClientCore,
      mutationFn: async () => {},
    });

    expectTypeOf(testMutation).toEqualTypeOf<
      Mutation<void, void, Error, unknown>
    >();
  });
});
